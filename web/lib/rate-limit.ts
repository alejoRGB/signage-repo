import { RateLimiterMemory } from "rate-limiter-flexible";

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
    kind: "memory" | "upstash";
    consume: (key: string, scope: RateLimitScope) => Promise<boolean>;
};

type UpstashLimiterResult = { success: boolean };
type UpstashLimiter = { limit: (identifier: string) => Promise<UpstashLimiterResult> };

let backendPromise: Promise<RateLimitBackend> | null = null;
let initWarningShown = false;
let runtimeWarningShown = false;

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

async function getBackend(): Promise<RateLimitBackend> {
    if (!backendPromise) {
        backendPromise = (async () => {
            const forceMemory = process.env.RATE_LIMIT_BACKEND?.toLowerCase() === "memory";
            if (forceMemory || !hasUpstashRedisConfig()) {
                return createMemoryBackend();
            }

            try {
                return await createUpstashBackend();
            } catch (error) {
                warnOnce("init", "Failed to initialize Upstash rate limiter, using local memory fallback", error);
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
    memoryScopedLimiters.clear();
}
