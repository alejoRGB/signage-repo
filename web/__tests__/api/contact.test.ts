/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/contact/route";
import { checkRateLimit } from "@/lib/rate-limit";
import { enqueueContactLeadJob, hasAnyContactDeliveryChannelConfigured } from "@/lib/contact-delivery";

jest.mock("@/lib/rate-limit", () => ({
    checkRateLimit: jest.fn(),
}));

jest.mock("@/lib/contact-delivery", () => ({
    enqueueContactLeadJob: jest.fn(),
    hasAnyContactDeliveryChannelConfigured: jest.fn(),
}));

const mockedCheckRateLimit = jest.mocked(checkRateLimit);
const mockedEnqueueContactLeadJob = jest.mocked(enqueueContactLeadJob);
const mockedHasAnyContactDeliveryChannelConfigured = jest.mocked(hasAnyContactDeliveryChannelConfigured);

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
    beforeEach(() => {
        jest.clearAllMocks();
        mockedCheckRateLimit.mockResolvedValue(true);
        mockedEnqueueContactLeadJob.mockResolvedValue({
            id: "job-1",
            status: "PENDING",
            createdAt: new Date("2026-02-24T00:00:00.000Z"),
        } as never);
        mockedHasAnyContactDeliveryChannelConfigured.mockReturnValue(true);
    });

    it("returns 429 when IP rate limit is exceeded", async () => {
        mockedCheckRateLimit.mockResolvedValue(false);

        const response = await POST(createRequest(validPayload));
        const data = await response.json();

        expect(response.status).toBe(429);
        expect(data.error).toMatch(/Demasiadas solicitudes/);
        expect(mockedEnqueueContactLeadJob).not.toHaveBeenCalled();
    });

    it("returns 400 when payload is invalid", async () => {
        const response = await POST(createRequest({ email: "invalid" }));
        expect(response.status).toBe(400);
        expect(mockedEnqueueContactLeadJob).not.toHaveBeenCalled();
    });

    it("returns 429 when lead fingerprint rate limit is exceeded", async () => {
        mockedCheckRateLimit.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

        const response = await POST(createRequest(validPayload));
        const data = await response.json();

        expect(response.status).toBe(429);
        expect(data.error).toMatch(/Demasiadas solicitudes/);
        expect(mockedCheckRateLimit).toHaveBeenCalledTimes(2);
        expect(mockedCheckRateLimit.mock.calls[1]?.[0]).toMatch(/^contact-lead:/);
        expect(mockedEnqueueContactLeadJob).not.toHaveBeenCalled();
    });

    it("enqueues a job and returns 202 accepted", async () => {
        const response = await POST(createRequest(validPayload));
        const data = await response.json();

        expect(response.status).toBe(202);
        expect(data).toEqual(
            expect.objectContaining({
                ok: true,
                queued: true,
                jobId: "job-1",
                deliveryConfigured: true,
            })
        );
        expect(mockedEnqueueContactLeadJob).toHaveBeenCalledWith(
            expect.objectContaining({
                email: "juan@example.com",
                company: "Kiosco Central",
            })
        );
    });

    it("returns 202 and flags unconfigured delivery channels", async () => {
        mockedHasAnyContactDeliveryChannelConfigured.mockReturnValue(false);
        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

        const response = await POST(createRequest(validPayload));
        const data = await response.json();

        expect(response.status).toBe(202);
        expect(data.deliveryConfigured).toBe(false);
        expect(warnSpy).toHaveBeenCalled();
    });
});

