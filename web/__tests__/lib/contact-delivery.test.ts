/**
 * @jest-environment node
 */
import { enqueueContactLeadJob, processContactLeadJobs } from "@/lib/contact-delivery";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

jest.mock("@/lib/prisma", () => ({
    prisma: {
        contactLeadJob: {
            create: jest.fn(),
            findFirst: jest.fn(),
            updateMany: jest.fn(),
            update: jest.fn(),
        },
        $transaction: jest.fn(),
    },
}));

jest.mock("nodemailer", () => ({
    __esModule: true,
    default: {
        createTransport: jest.fn(),
    },
}));

describe("contact-delivery queue processor", () => {
    const originalEnv = { ...process.env };
    const mockedCreateTransport = jest.mocked(nodemailer.createTransport);
    const mockedSendMail = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        delete process.env.CONTACT_WEBHOOK_URL;
        delete process.env.CONTACT_SMTP_HOST;
        delete process.env.CONTACT_SMTP_PORT;
        delete process.env.CONTACT_SMTP_USER;
        delete process.env.CONTACT_SMTP_PASS;
        delete process.env.CONTACT_TO_EMAIL;
        delete process.env.CONTACT_FROM_EMAIL;
        delete process.env.CONTACT_JOB_MAX_ATTEMPTS;
        delete process.env.CONTACT_JOB_RETRY_BACKOFF_MS;
        mockedCreateTransport.mockReturnValue({
            sendMail: mockedSendMail,
        } as unknown as ReturnType<typeof nodemailer.createTransport>);
        (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma));
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it("enqueues a contact lead job as pending", async () => {
        (prisma.contactLeadJob.create as jest.Mock).mockResolvedValue({
            id: "job-1",
            status: "PENDING",
            createdAt: new Date(),
        });

        const job = await enqueueContactLeadJob({
            name: "Juan Perez",
            company: "Kiosco Central",
            email: "juan@example.com",
            phone: "1155551234",
            businessType: "retail",
            screens: 3,
            branches: 1,
            zone: "CABA",
            message: "hola",
        });

        expect(job.id).toBe("job-1");
        expect(prisma.contactLeadJob.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: "PENDING",
                }),
            })
        );
    });

    it("processes a queued job successfully via SMTP and marks it succeeded", async () => {
        process.env.CONTACT_SMTP_HOST = "smtp.example.com";
        process.env.CONTACT_SMTP_PORT = "587";
        process.env.CONTACT_SMTP_USER = "no-reply@example.com";
        process.env.CONTACT_SMTP_PASS = "secret";
        process.env.CONTACT_TO_EMAIL = "ventas@example.com";

        const queuedJob = {
            id: "job-1",
            lead: {
                name: "Juan Perez",
                company: "Kiosco Central",
                email: "juan@example.com",
                phone: "1155551234",
                businessType: "retail",
                screens: 3,
                branches: 1,
                zone: "CABA",
                message: "hola",
            },
            status: "PENDING",
            attempts: 0,
            nextAttemptAt: new Date(Date.now() - 1000),
            createdAt: new Date(),
        };

        (prisma.contactLeadJob.findFirst as jest.Mock)
            .mockResolvedValueOnce(queuedJob)
            .mockResolvedValueOnce(null);
        (prisma.contactLeadJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
        (prisma.contactLeadJob.update as jest.Mock).mockResolvedValue({});
        mockedSendMail.mockResolvedValue({ messageId: "abc" });

        const result = await processContactLeadJobs(5);

        expect(result).toEqual(
            expect.objectContaining({
                processed: 1,
                succeeded: 1,
                requeued: 0,
                deadLettered: 0,
            })
        );
        expect(mockedSendMail).toHaveBeenCalledTimes(1);
        expect(prisma.contactLeadJob.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "job-1" },
                data: expect.objectContaining({
                    status: "SUCCEEDED",
                    emailed: true,
                }),
            })
        );
    });
});

