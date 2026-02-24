import {
    getClientIpForRateLimit,
    rateLimitKeyForContactLead,
    rateLimitKeyForDeviceToken,
    rateLimitKeyForIp,
    shouldTrustProxyHeadersForRateLimit,
} from "@/lib/rate-limit-key";

function makeRequest(headers: Record<string, string>) {
    return { headers: new Headers(headers) } as unknown as Request;
}

describe("rate-limit-key helpers", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it("uses the first x-forwarded-for IP and strips port", () => {
        const request = makeRequest({
            "x-forwarded-for": "203.0.113.10:443, 10.0.0.4",
        });

        expect(getClientIpForRateLimit(request)).toBe("203.0.113.10");
        expect(rateLimitKeyForIp(request)).toBe("ip:203.0.113.10");
    });

    it("falls back to x-real-ip / forwarded header", () => {
        const realIpRequest = makeRequest({
            "x-real-ip": "198.51.100.20",
        });
        const forwardedRequest = makeRequest({
            forwarded: 'for="[2001:db8::1]:1234";proto=https',
        });

        expect(getClientIpForRateLimit(realIpRequest)).toBe("198.51.100.20");
        expect(getClientIpForRateLimit(forwardedRequest)).toBe("2001:db8::1");
    });

    it("supports explicit disabling of proxy header trust via env policy", () => {
        process.env.RATE_LIMIT_TRUST_PROXY_HEADERS = "false";
        const request = makeRequest({
            "x-forwarded-for": "203.0.113.10",
        });

        expect(shouldTrustProxyHeadersForRateLimit()).toBe(false);
        expect(getClientIpForRateLimit(request)).toBe("unknown");
    });

    it("hashes device tokens so raw secrets are not used as backend keys", () => {
        const token = "secret-device-token";
        const key = rateLimitKeyForDeviceToken(token);

        expect(key).toMatch(/^device-token:[a-f0-9]{32}$/);
        expect(key).not.toContain(token);
        expect(rateLimitKeyForDeviceToken(token)).toBe(key);
    });

    it("hashes contact lead fingerprint so rate limiting is not only IP-based", () => {
        const key = rateLimitKeyForContactLead({
            email: "Juan@Example.com ",
            phone: "11 5555 1234",
        });

        expect(key).toMatch(/^contact-lead:[a-f0-9]{32}$/);
        expect(key).not.toContain("juan@example.com");
        expect(key).not.toContain("5555");
        expect(
            rateLimitKeyForContactLead({
                email: "juan@example.com",
                phone: "1155551234",
            })
        ).toBe(key);
    });
});
