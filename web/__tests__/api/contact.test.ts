/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/contact/route";
import { checkRateLimit } from "@/lib/rate-limit";

jest.mock("@/lib/rate-limit", () => ({
    checkRateLimit: jest.fn(),
}));

const mockedCheckRateLimit = jest.mocked(checkRateLimit);

const validPayload = {
    name: "Juan Perez",
    company: "Kiosco Central",
    email: "juan@example.com",
    phone: "1155551234",
    businessType: "retail",
    screens: 3,
    branches: 1,
    zone: "CABA",
    message: "Quiero una cotizacion para 3 pantallas",
};

function createRequest(body: unknown) {
    return new NextRequest("http://localhost:3000/api/contact", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-forwarded-for": "203.0.113.10",
        },
        body: JSON.stringify(body),
    });
}

describe("POST /api/contact", () => {
    const originalWebhook = process.env.CONTACT_WEBHOOK_URL;

    beforeEach(() => {
        mockedCheckRateLimit.mockReset();
        jest.restoreAllMocks();
        delete process.env.CONTACT_WEBHOOK_URL;
    });

    afterAll(() => {
        process.env.CONTACT_WEBHOOK_URL = originalWebhook;
    });

    it("returns 429 when rate limit is exceeded", async () => {
        mockedCheckRateLimit.mockResolvedValue(false);

        const response = await POST(createRequest(validPayload));
        const data = await response.json();

        expect(response.status).toBe(429);
        expect(data.error).toMatch(/Demasiadas solicitudes/);
    });

    it("returns 400 when payload is invalid", async () => {
        mockedCheckRateLimit.mockResolvedValue(true);

        const response = await POST(createRequest({ email: "invalid" }));

        expect(response.status).toBe(400);
    });

    it("returns 202 when webhook is not configured", async () => {
        mockedCheckRateLimit.mockResolvedValue(true);
        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

        const response = await POST(createRequest(validPayload));
        const data = await response.json();

        expect(response.status).toBe(202);
        expect(data).toEqual({ ok: true, forwarded: false });
        expect(warnSpy).toHaveBeenCalled();
    });

    it("returns 200 when webhook accepts lead", async () => {
        mockedCheckRateLimit.mockResolvedValue(true);
        process.env.CONTACT_WEBHOOK_URL = "https://example.com/webhook";
        const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
            ok: true,
            status: 200,
        } as Response);

        const response = await POST(createRequest(validPayload));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({ ok: true, forwarded: true });
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
});
