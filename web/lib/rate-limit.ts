import { RateLimiterMemory } from "rate-limiter-flexible";

// Rate limiter for device endpoints
// Allow 60 requests per minute per IP or Token
// In a serverless environment (Vercel), this memory cache is per-instance.
// For strict global limiting, we would need Redis (Upstash).
// But this provides a basic layer of protection against rapid spam on a single instance.
const rateLimiter = new RateLimiterMemory({
    points: 60, // 60 requests
    duration: 60, // Per 60 seconds
});

export async function checkRateLimit(key: string) {
    try {
        await rateLimiter.consume(key);
        return true;
    } catch (rejRes) {
        return false;
    }
}
