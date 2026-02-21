/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/contact/route";
import { checkRateLimit } from "@/lib/rate-limit";
import nodemailer from "nodemailer";

jest.mock("@/lib/rate-limit", () => ({
    checkRateLimit: jest.fn(),
}));

jest.mock("nodemailer", () => ({
    __esModule: true,
    default: {
        createTransport: jest.fn(),
    },
}));

const mockedCheckRateLimit = jest.mocked(checkRateLimit);
const mockedCreateTransport = jest.mocked(nodemailer.createTransport);
const mockedSendMail = jest.fn();

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

function setSmtpEnv() {
    process.env.CONTACT_SMTP_HOST = "smtp.example.com";
    process.env.CONTACT_SMTP_PORT = "587";
    process.env.CONTACT_SMTP_USER = "no-reply@example.com";
    process.env.CONTACT_SMTP_PASS = "secret";
    process.env.CONTACT_TO_EMAIL = "ventas@example.com";
}

function clearDeliveryEnv() {
    delete process.env.CONTACT_WEBHOOK_URL;
    delete process.env.CONTACT_SMTP_HOST;
    delete process.env.CONTACT_SMTP_PORT;
    delete process.env.CONTACT_SMTP_USER;
    delete process.env.CONTACT_SMTP_PASS;
    delete process.env.CONTACT_TO_EMAIL;
    delete process.env.CONTACT_FROM_EMAIL;
    delete process.env.CONTACT_SMTP_SECURE;
}

describe("POST /api/contact", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        mockedCheckRateLimit.mockReset();
        mockedCreateTransport.mockReset();
        mockedSendMail.mockReset();
        mockedCreateTransport.mockReturnValue({
            sendMail: mockedSendMail,
        } as unknown as ReturnType<typeof nodemailer.createTransport>);
        jest.restoreAllMocks();
        clearDeliveryEnv();
    });

    afterAll(() => {
        process.env = originalEnv;
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

    it("returns 202 when no delivery channel is configured", async () => {
        mockedCheckRateLimit.mockResolvedValue(true);
        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

        const response = await POST(createRequest(validPayload));
        const data = await response.json();

        expect(response.status).toBe(202);
        expect(data).toEqual({ ok: true, emailed: false, forwarded: false });
        expect(warnSpy).toHaveBeenCalled();
    });

    it("returns 200 when smtp delivery succeeds", async () => {
        mockedCheckRateLimit.mockResolvedValue(true);
        mockedSendMail.mockResolvedValue({ messageId: "abc123" });
        setSmtpEnv();

        const response = await POST(createRequest(validPayload));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({ ok: true, emailed: true, forwarded: false });
        expect(mockedCreateTransport).toHaveBeenCalledTimes(1);
        expect(mockedSendMail).toHaveBeenCalledTimes(1);
    });

    it("returns 200 when webhook forwarding succeeds", async () => {
        mockedCheckRateLimit.mockResolvedValue(true);
        process.env.CONTACT_WEBHOOK_URL = "https://example.com/webhook";
        const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
            ok: true,
            status: 200,
        } as Response);

        const response = await POST(createRequest(validPayload));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({ ok: true, emailed: false, forwarded: true });
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("returns 502 when smtp is configured but delivery fails and no webhook exists", async () => {
        mockedCheckRateLimit.mockResolvedValue(true);
        mockedSendMail.mockRejectedValue(new Error("smtp failed"));
        setSmtpEnv();
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

        const response = await POST(createRequest(validPayload));
        const data = await response.json();

        expect(response.status).toBe(502);
        expect(data.error).toMatch(/No se pudo procesar/);
        expect(errorSpy).toHaveBeenCalled();
    });
});
