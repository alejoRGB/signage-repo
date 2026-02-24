describe("rate-limit backend", () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...ORIGINAL_ENV };
        delete process.env.UPSTASH_REDIS_REST_URL;
        delete process.env.UPSTASH_REDIS_REST_TOKEN;
        delete process.env.RATE_LIMIT_BACKEND;
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    it("uses memory backend when Upstash env vars are not configured", async () => {
        const rateLimit = await import("@/lib/rate-limit");
        const allowed = await rateLimit.checkRateLimit("device-1", "contact");
        const backendKind = await rateLimit.__getRateLimitBackendKindForTests();

        expect(allowed).toBe(true);
        expect(backendKind).toBe("memory");
    });

    it("enforces scope limits with memory fallback", async () => {
        const rateLimit = await import("@/lib/rate-limit");

        for (let i = 0; i < 6; i += 1) {
            await expect(rateLimit.checkRateLimit("same-key", "contact")).resolves.toBe(true);
        }

        await expect(rateLimit.checkRateLimit("same-key", "contact")).resolves.toBe(false);
    });
});
