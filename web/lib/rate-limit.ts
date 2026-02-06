/**
 * Simple in-memory rate limiter
 * Stores request counts in a Map with a TTL (Time To Live).
 * Note: This state is per-serverless-instance, so it's not absolute protection
 * but helps prevent automated abuse from a single source.
 */

interface RateLimitConfig {
    uniqueTokenPerInterval: number; // Max number of unique IPs to track (prevents memory leaks)
    interval: number; // Window size in ms
}

export function rateLimit(options: RateLimitConfig) {
    const tokenCache = new Map<string, number[]>();

    return {
        check: (limit: number, token: string) =>
            new Promise<void>((resolve, reject) => {
                const tokenCount = tokenCache.get(token) || [0];
                if (tokenCount[0] === 0) {
                    tokenCache.set(token, tokenCount);
                }
                tokenCount[0] += 1;

                const currentUsage = tokenCount[0];
                const isRateLimited = currentUsage >= limit;

                // Cleanup logic usually goes here or relies on external store.
                // For simple in-memory with auto-reset, we can just use setTimeout to decrement/clear
                // But simplified: reset count after interval
                if (currentUsage === 1) {
                    setTimeout(() => {
                        tokenCache.delete(token);
                    }, options.interval);
                }

                isRateLimited ? reject() : resolve();
            }),
    };
}
