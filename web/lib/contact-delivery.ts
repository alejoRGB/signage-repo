import nodemailer from "nodemailer";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ContactLeadSchema } from "@/lib/validations";

export type ContactLead = z.infer<typeof ContactLeadSchema>;

const DEFAULT_CONTACT_EMAIL = "info.senaldigital@gmail.com";
const DEFAULT_CONTACT_WEBHOOK_TIMEOUT_MS = 5000;
const MIN_CONTACT_WEBHOOK_TIMEOUT_MS = 500;
const MAX_CONTACT_WEBHOOK_TIMEOUT_MS = 30000;
const DEFAULT_CONTACT_WEBHOOK_RETRIES = 1;
const DEFAULT_CONTACT_WEBHOOK_RETRY_BACKOFF_MS = 250;
const DEFAULT_CONTACT_JOB_MAX_ATTEMPTS = 6;
const DEFAULT_CONTACT_JOB_RETRY_BACKOFF_MS = 15_000;
const MAX_CONTACT_JOB_RETRY_BACKOFF_MS = 10 * 60_000;

const CONTACT_JOB_STATUS = {
    PENDING: "PENDING",
    PROCESSING: "PROCESSING",
    RETRY: "RETRY",
    SUCCEEDED: "SUCCEEDED",
    DEAD_LETTER: "DEAD_LETTER",
} as const;

type ContactJobStatus = (typeof CONTACT_JOB_STATUS)[keyof typeof CONTACT_JOB_STATUS];

function getSmtpConfig() {
    const host = (process.env.CONTACT_SMTP_HOST ?? "smtp.gmail.com").trim();
    const portRaw = (process.env.CONTACT_SMTP_PORT ?? "465").trim();
    const user = (process.env.CONTACT_SMTP_USER ?? DEFAULT_CONTACT_EMAIL).trim();
    const pass = process.env.CONTACT_SMTP_PASS?.trim();
    const to = (process.env.CONTACT_TO_EMAIL ?? DEFAULT_CONTACT_EMAIL).trim();

    if (!host || !portRaw || !user || !pass || !to) {
        return null;
    }

    const port = Number(portRaw);
    if (!Number.isFinite(port) || port <= 0) {
        return null;
    }

    const secureFromEnv = process.env.CONTACT_SMTP_SECURE;
    const secure = secureFromEnv ? secureFromEnv.toLowerCase() === "true" : port === 465;

    return {
        host,
        port,
        secure,
        user,
        pass,
        to,
        from: process.env.CONTACT_FROM_EMAIL ?? user,
    };
}

export function hasAnyContactDeliveryChannelConfigured() {
    return Boolean(getSmtpConfig()) || Boolean(process.env.CONTACT_WEBHOOK_URL?.trim());
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function buildLeadEmailContent(lead: ContactLead) {
    const message = lead.message && lead.message.trim().length > 0 ? lead.message : "(sin mensaje)";

    const text = [
        "Nueva solicitud de cotizacion (Expanded Signage)",
        "",
        `Nombre: ${lead.name}`,
        `Empresa: ${lead.company}`,
        `Email: ${lead.email}`,
        `Telefono: ${lead.phone}`,
        `Rubro: ${lead.businessType}`,
        `Pantallas: ${lead.screens}`,
        `Sucursales: ${lead.branches}`,
        `Zona: ${lead.zone}`,
        `Mensaje: ${message}`,
    ].join("\n");

    const html = `
        <h2>Nueva solicitud de cotizacion</h2>
        <p><strong>Nombre:</strong> ${escapeHtml(lead.name)}</p>
        <p><strong>Empresa:</strong> ${escapeHtml(lead.company)}</p>
        <p><strong>Email:</strong> ${escapeHtml(lead.email)}</p>
        <p><strong>Telefono:</strong> ${escapeHtml(lead.phone)}</p>
        <p><strong>Rubro:</strong> ${escapeHtml(lead.businessType)}</p>
        <p><strong>Pantallas:</strong> ${lead.screens}</p>
        <p><strong>Sucursales:</strong> ${lead.branches}</p>
        <p><strong>Zona:</strong> ${escapeHtml(lead.zone)}</p>
        <p><strong>Mensaje:</strong><br />${escapeHtml(message).replace(/\n/g, "<br />")}</p>
    `;

    return { text, html };
}

function getContactWebhookTimeoutMs() {
    const raw = process.env.CONTACT_WEBHOOK_TIMEOUT_MS?.trim();
    if (!raw) return DEFAULT_CONTACT_WEBHOOK_TIMEOUT_MS;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_CONTACT_WEBHOOK_TIMEOUT_MS;
    return Math.min(MAX_CONTACT_WEBHOOK_TIMEOUT_MS, Math.max(MIN_CONTACT_WEBHOOK_TIMEOUT_MS, Math.round(parsed)));
}

function getContactWebhookRetries() {
    const raw = process.env.CONTACT_WEBHOOK_RETRIES?.trim();
    if (!raw) return DEFAULT_CONTACT_WEBHOOK_RETRIES;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_CONTACT_WEBHOOK_RETRIES;
    return Math.min(3, Math.max(0, Math.round(parsed)));
}

function getContactWebhookRetryBackoffMs() {
    const raw = process.env.CONTACT_WEBHOOK_RETRY_BACKOFF_MS?.trim();
    if (!raw) return DEFAULT_CONTACT_WEBHOOK_RETRY_BACKOFF_MS;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_CONTACT_WEBHOOK_RETRY_BACKOFF_MS;
    return Math.min(2000, Math.max(50, Math.round(parsed)));
}

function getContactJobMaxAttempts() {
    const raw = process.env.CONTACT_JOB_MAX_ATTEMPTS?.trim();
    if (!raw) return DEFAULT_CONTACT_JOB_MAX_ATTEMPTS;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_CONTACT_JOB_MAX_ATTEMPTS;
    return Math.min(20, Math.max(1, Math.round(parsed)));
}

function getContactJobRetryBackoffMs() {
    const raw = process.env.CONTACT_JOB_RETRY_BACKOFF_MS?.trim();
    if (!raw) return DEFAULT_CONTACT_JOB_RETRY_BACKOFF_MS;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_CONTACT_JOB_RETRY_BACKOFF_MS;
    return Math.min(MAX_CONTACT_JOB_RETRY_BACKOFF_MS, Math.max(1000, Math.round(parsed)));
}

export async function enqueueContactLeadJob(lead: ContactLead) {
    return prisma.contactLeadJob.create({
        data: {
            lead,
            status: CONTACT_JOB_STATUS.PENDING,
            nextAttemptAt: new Date(),
        },
        select: {
            id: true,
            status: true,
            createdAt: true,
        },
    });
}

async function sendLeadByEmail(lead: ContactLead, smtp: NonNullable<ReturnType<typeof getSmtpConfig>>) {
    const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.pass },
    });
    const content = buildLeadEmailContent(lead);
    await transporter.sendMail({
        from: smtp.from,
        to: smtp.to,
        replyTo: lead.email,
        subject: `Nueva solicitud de cotizacion - ${lead.company}`,
        text: content.text,
        html: content.html,
    });
}

async function postLeadToWebhookOnce(lead: ContactLead, webhookUrl: string) {
    const controller = new AbortController();
    const timeoutMs = getContactWebhookTimeoutMs();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
        response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            signal: controller.signal,
            body: JSON.stringify({
                ...lead,
                source: "senaldigital.xyz",
                submittedAt: new Date().toISOString(),
            }),
        });
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw new Error(`Webhook timeout after ${timeoutMs}ms`);
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
    if (!response.ok) {
        throw new Error(`Webhook returned status ${response.status}`);
    }
}

function shouldRetryWebhookError(error: unknown) {
    if (!(error instanceof Error)) return false;
    if (error.name === "AbortError") return true;
    const match = error.message.match(/status\s+(\d+)/i);
    if (!match) return true;
    const status = Number(match[1]);
    return status === 429 || status >= 500;
}

async function sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function forwardLeadToWebhook(lead: ContactLead, webhookUrl: string) {
    const retries = getContactWebhookRetries();
    const baseBackoffMs = getContactWebhookRetryBackoffMs();
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            await postLeadToWebhookOnce(lead, webhookUrl);
            return;
        } catch (error) {
            lastError = error;
            const canRetry = attempt < retries && shouldRetryWebhookError(error);
            if (!canRetry) throw error;
            await sleep(baseBackoffMs * (attempt + 1));
        }
    }
    throw (lastError instanceof Error ? lastError : new Error("Webhook delivery failed"));
}

type DeliveryAttemptResult = {
    attemptedEmail: boolean;
    attemptedWebhook: boolean;
    emailed: boolean;
    forwarded: boolean;
    errors: string[];
};

async function deliverLeadOnce(lead: ContactLead): Promise<DeliveryAttemptResult> {
    let emailed = false;
    let forwarded = false;
    let attemptedEmail = false;
    let attemptedWebhook = false;
    const errors: string[] = [];

    const smtpConfig = getSmtpConfig();
    attemptedEmail = smtpConfig !== null;
    if (smtpConfig) {
        try {
            await sendLeadByEmail(lead, smtpConfig);
            emailed = true;
        } catch (error) {
            errors.push(`email:${error instanceof Error ? error.message : "unknown error"}`);
            console.error("Failed to deliver contact lead by email", {
                message: error instanceof Error ? error.message : "unknown error",
                company: lead.company,
            });
        }
    }

    const webhookUrl = process.env.CONTACT_WEBHOOK_URL?.trim();
    attemptedWebhook = Boolean(webhookUrl);
    if (webhookUrl) {
        try {
            await forwardLeadToWebhook(lead, webhookUrl);
            forwarded = true;
        } catch (error) {
            errors.push(`webhook:${error instanceof Error ? error.message : "unknown error"}`);
            console.error("Failed to forward contact lead to webhook", {
                message: error instanceof Error ? error.message : "unknown error",
                company: lead.company,
            });
        }
    }

    return { attemptedEmail, attemptedWebhook, emailed, forwarded, errors };
}

function parseQueuedLead(rawLead: unknown): ContactLead | null {
    const result = ContactLeadSchema.safeParse(rawLead);
    if (!result.success) {
        return null;
    }
    return result.data;
}

async function claimNextContactLeadJob() {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
        const job = await tx.contactLeadJob.findFirst({
            where: {
                status: { in: [CONTACT_JOB_STATUS.PENDING, CONTACT_JOB_STATUS.RETRY] },
                nextAttemptAt: { lte: now },
            },
            orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
        });

        if (!job) {
            return null;
        }

        const claimed = await tx.contactLeadJob.updateMany({
            where: {
                id: job.id,
                status: job.status,
            },
            data: {
                status: CONTACT_JOB_STATUS.PROCESSING,
                lockedAt: now,
                lastAttemptAt: now,
            },
        });

        if (claimed.count === 0) {
            return null;
        }

        return job;
    });
}

function computeNextAttemptDate(attempts: number) {
    const base = getContactJobRetryBackoffMs();
    const multiplier = Math.min(8, Math.max(1, attempts));
    const backoff = Math.min(MAX_CONTACT_JOB_RETRY_BACKOFF_MS, base * multiplier);
    return new Date(Date.now() + backoff);
}

export async function processContactLeadJobs(limit = 10) {
    const maxJobs = Math.min(100, Math.max(1, Math.round(limit)));
    let processed = 0;
    let succeeded = 0;
    let requeued = 0;
    let deadLettered = 0;
    let skipped = 0;

    for (let index = 0; index < maxJobs; index += 1) {
        const job = await claimNextContactLeadJob();
        if (!job) {
            break;
        }

        processed += 1;
        const lead = parseQueuedLead(job.lead);
        if (!lead) {
            deadLettered += 1;
            await prisma.contactLeadJob.update({
                where: { id: job.id },
                data: {
                    status: CONTACT_JOB_STATUS.DEAD_LETTER,
                    attempts: { increment: 1 },
                    processedAt: new Date(),
                    lockedAt: null,
                    lastError: "invalid_queued_payload",
                },
            });
            continue;
        }

        const result = await deliverLeadOnce(lead);

        if (!result.attemptedEmail && !result.attemptedWebhook) {
            skipped += 1;
            await prisma.contactLeadJob.update({
                where: { id: job.id },
                data: {
                    status: CONTACT_JOB_STATUS.DEAD_LETTER,
                    attempts: { increment: 1 },
                    processedAt: new Date(),
                    lockedAt: null,
                    lastError: "no_delivery_channel_configured",
                },
            });
            continue;
        }

        if (result.emailed || result.forwarded) {
            succeeded += 1;
            await prisma.contactLeadJob.update({
                where: { id: job.id },
                data: {
                    status: CONTACT_JOB_STATUS.SUCCEEDED as ContactJobStatus,
                    attempts: { increment: 1 },
                    processedAt: new Date(),
                    lockedAt: null,
                    emailed: result.emailed,
                    forwarded: result.forwarded,
                    lastError: result.errors.length > 0 ? result.errors.join(" | ").slice(0, 2000) : null,
                },
            });
            continue;
        }

        const nextAttempts = job.attempts + 1;
        const maxAttempts = getContactJobMaxAttempts();
        const shouldDeadLetter = nextAttempts >= maxAttempts;
        if (shouldDeadLetter) {
            deadLettered += 1;
        } else {
            requeued += 1;
        }

        await prisma.contactLeadJob.update({
            where: { id: job.id },
            data: {
                status: shouldDeadLetter ? CONTACT_JOB_STATUS.DEAD_LETTER : CONTACT_JOB_STATUS.RETRY,
                attempts: { increment: 1 },
                lockedAt: null,
                processedAt: shouldDeadLetter ? new Date() : null,
                nextAttemptAt: shouldDeadLetter ? job.nextAttemptAt : computeNextAttemptDate(nextAttempts),
                lastError: result.errors.join(" | ").slice(0, 2000),
            },
        });
    }

    return { processed, succeeded, requeued, deadLettered, skipped };
}

