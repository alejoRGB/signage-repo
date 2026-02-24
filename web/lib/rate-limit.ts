import { RateLimiterMemory } from "rate-limiter-flexible";
import crypto from "crypto";

type RateLimitScope =
    | "default"
    | "contact"
    | "device_register"
    | "device_sync"
    | "device_status"
    | "device_commands"
    | "device_ack"
    | "device_heartbeat"
    | "device_preview"
    | "device_logs";

const RATE_LIMIT_CONFIG: Record<RateLimitScope, { points: number; duration: number }> = {
    default: { points: 60, duration: 60 },
    contact: { points: 6, duration: 60 },
    device_register: { points: 20, duration: 60 },
    device_sync: { points: 120, duration: 60 },
    device_status: { points: 60, duration: 60 },
    device_commands: { points: 180, duration: 60 },
    device_ack: { points: 120, duration: 60 },
    device_heartbeat: { points: 180, duration: 60 },
    device_preview: { points: 120, duration: 60 },
    device_logs: { points: 240, duration: 60 },
};

type RateLimitBackend = {
    kind: "memory" | "upstash" | "postgres";
    consume: (key: string, scope: RateLimitScope) => Promise<boolean>;
};

type UpstashLimiterResult = { success: boolean };
type UpstashLimiter = { limit: (identifier: string) => Promise<UpstashLimiterResult> };

let backendPromise: Promise<RateLimitBackend> | null = null;
let initWarningShown = false;
let runtimeWarningShown = false;
let postgresCleanupInFlight = false;
let lastPostgresCleanupAtMs = 0;

const memoryScopedLimiters = new Map<RateLimitScope, RateLimiterMemory>();

function warnOnce(kind: "init" | "runtime", message: string, error?: unknown) {
    if (kind === "init") {
        if (initWarningShown) return;
        initWarningShown = true;
    } else {
        if (runtimeWarningShown) return;
        runtimeWarningShown = true;
    }

    if (error) {
        console.warn(`[rate-limit] ${message}`, error);
        return;
    }
    console.warn(`[rate-limit] ${message}`);
}

function getMemoryLimiter(scope: RateLimitScope) {
    const cached = memoryScopedLimiters.get(scope);
    if (cached) {
        return cached;
    }

    const config = RATE_LIMIT_CONFIG[scope];
    const limiter = new RateLimiterMemory({
        points: config.points,
        duration: config.duration,
    });
    memoryScopedLimiters.set(scope, limiter);
    return limiter;
}

function createMemoryBackend(): RateLimitBackend {
    return {
        kind: "memory",
        async consume(key, scope) {
            try {
                await getMemoryLimiter(scope).consume(key);
                return true;
            } catch {
                return false;
            }
        },
    };
}

function hasUpstashRedisConfig() {
    return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function hasDatabaseConfig() {
    return Boolean(process.env.DATABASE_URL);
}

async function createUpstashBackend(): Promise<RateLimitBackend> {
    const [{ Ratelimit }, { Redis }] = await Promise.all([
        import("@upstash/ratelimit"),
        import("@upstash/redis"),
    ]);

    const redis = Redis.fromEnv();
    const fallbackMemory = createMemoryBackend();
    const upstashScopedLimiters = new Map<RateLimitScope, UpstashLimiter>();

    function getUpstashLimiter(scope: RateLimitScope): UpstashLimiter {
        const cached = upstashScopedLimiters.get(scope);
        if (cached) {
            return cached;
        }

        const config = RATE_LIMIT_CONFIG[scope];
        const limiter = new Ratelimit({
            redis,
            limiter: Ratelimit.fixedWindow(config.points, `${config.duration} s`),
            prefix: `expanded-signage:${scope}`,
        }) as unknown as UpstashLimiter;

        upstashScopedLimiters.set(scope, limiter);
        return limiter;
    }

    return {
        kind: "upstash",
        async consume(key, scope) {
            try {
                const result = await getUpstashLimiter(scope).limit(key);
                return result.success;
            } catch (error) {
                // Degrade to local limiter to preserve availability if Redis is temporarily unavailable.
                warnOnce("runtime", "Upstash rate-limit call failed, degrading to local memory limiter", error);
                return fallbackMemory.consume(key, scope);
            }
        },
    };
}

function hashRateLimitKey(rawKey: string) {
    return crypto.createHash("sha256").update(rawKey, "utf8").digest("hex");
}

async function createPostgresBackend(): Promise<RateLimitBackend> {
    const { prisma } = await import("@/lib/prisma");

    async function maybeCleanupExpiredBuckets(nowMs: number) {
        if (postgresCleanupInFlight) {
            return;
        }
        // Throttle cleanup to at most once per 5 minutes per process.
        if (nowMs - lastPostgresCleanupAtMs < 5 * 60_000) {
            return;
        }
        lastPostgresCleanupAtMs = nowMs;
        postgresCleanupInFlight = true;
        try {
            await prisma.rateLimitBucket.deleteMany({
                where: {
                    expiresAt: {
                        lt: new Date(nowMs),
                    },
                },
            });
        } catch (error) {
            warnOnce("runtime", "Postgres rate-limit cleanup failed", error);
        } finally {
            postgresCleanupInFlight = false;
        }
    }

    return {
        kind: "postgres",
        async consume(key, scope) {
            const config = RATE_LIMIT_CONFIG[scope];
            const nowMs = Date.now();
            const windowMs = config.duration * 1000;
            const windowStartMs = Math.floor(nowMs / windowMs) * windowMs;
            const windowStartAt = new Date(windowStartMs);
            const expiresAt = new Date(windowStartMs + (windowMs * 2));
            const keyHash = hashRateLimitKey(key);

            try {
                const bucket = await prisma.rateLimitBucket.upsert({
                    where: {
                        scope_keyHash_windowStartAt: {
                            scope,
                            keyHash,
                            windowStartAt,
                        },
                    },
                    create: {
                        scope,
                        keyHash,
                        windowStartAt,
                        count: 1,
                        expiresAt,
                    },
                    update: {
                        count: {
                            increment: 1,
                        },
                        expiresAt,
                    },
                    select: {
                        count: true,
                    },
                });

                void maybeCleanupExpiredBuckets(nowMs);
                return bucket.count <= config.points;
            } catch (error) {
                warnOnce("runtime", "Postgres rate-limit call failed, degrading to local memory limiter", error);
                return createMemoryBackend().consume(key, scope);
            }
        },
    };
}

async function getBackend(): Promise<RateLimitBackend> {
    if (!backendPromise) {
        backendPromise = (async () => {
            const requestedBackend = process.env.RATE_LIMIT_BACKEND?.trim().toLowerCase();
            const forceMemory = requestedBackend === "memory";
            const forcePostgres = requestedBackend === "postgres";
            const forceUpstash = requestedBackend === "upstash";

            if (forceMemory) {
                return createMemoryBackend();
            }

            if (forceUpstash) {
                if (!hasUpstashRedisConfig()) {
                    warnOnce("init", "RATE_LIMIT_BACKEND=upstash but Upstash env vars are missing, using local memory fallback");
                    return createMemoryBackend();
                }
                try {
                    return await createUpstashBackend();
                } catch (error) {
                    warnOnce("init", "Failed to initialize Upstash rate limiter, using local memory fallback", error);
                    return createMemoryBackend();
                }
            }

            if (forcePostgres) {
                if (!hasDatabaseConfig()) {
                    warnOnce("init", "RATE_LIMIT_BACKEND=postgres but DATABASE_URL is missing, using local memory fallback");
                    return createMemoryBackend();
                }
                try {
                    return await createPostgresBackend();
                } catch (error) {
                    warnOnce("init", "Failed to initialize Postgres rate limiter, using local memory fallback", error);
                    return createMemoryBackend();
                }
            }

            if (hasUpstashRedisConfig()) {
                try {
                    return await createUpstashBackend();
                } catch (error) {
                    warnOnce("init", "Failed to initialize Upstash rate limiter, trying Postgres backend", error);
                }
            }

            if (hasDatabaseConfig() && process.env.NODE_ENV === "production") {
                try {
                    return await createPostgresBackend();
                } catch (error) {
                    warnOnce("init", "Failed to initialize Postgres rate limiter, using local memory fallback", error);
                    return createMemoryBackend();
                }
            }

            try {
                return createMemoryBackend();
            } catch {
                return createMemoryBackend();
            }
        })();
    }

    return backendPromise;
}

export async function checkRateLimit(key: string, scope: RateLimitScope = "default") {
    const backend = await getBackend();
    return backend.consume(key, scope);
}

export async function __getRateLimitBackendKindForTests() {
    return (await getBackend()).kind;
}

export function __resetRateLimitForTests() {
    backendPromise = null;
    initWarningShown = false;
    runtimeWarningShown = false;
    postgresCleanupInFlight = false;
    lastPostgresCleanupAtMs = 0;
    memoryScopedLimiters.clear();
}
