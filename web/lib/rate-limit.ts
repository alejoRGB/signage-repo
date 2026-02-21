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

const scopedLimiters = new Map<RateLimitScope, RateLimiterMemory>();

function getLimiter(scope: RateLimitScope) {
    const cached = scopedLimiters.get(scope);
    if (cached) {
        return cached;
    }

    const config = RATE_LIMIT_CONFIG[scope];
    const limiter = new RateLimiterMemory({
        points: config.points,
        duration: config.duration,
    });
    scopedLimiters.set(scope, limiter);
    return limiter;
}

export async function checkRateLimit(key: string, scope: RateLimitScope = "default") {
    try {
        await getLimiter(scope).consume(key);
        return true;
    } catch {
        return false;
    }
}
