import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import type { z } from "zod";
import { ContactLeadSchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitKeyForContactLead, rateLimitKeyForIp } from "@/lib/rate-limit-key";

export const runtime = "nodejs";

type ContactLead = z.infer<typeof ContactLeadSchema>;
const DEFAULT_CONTACT_EMAIL = "info.senaldigital@gmail.com";
const DEFAULT_CONTACT_WEBHOOK_TIMEOUT_MS = 5000;
const MIN_CONTACT_WEBHOOK_TIMEOUT_MS = 500;
const MAX_CONTACT_WEBHOOK_TIMEOUT_MS = 30000;
const DEFAULT_CONTACT_WEBHOOK_RETRIES = 1;
const DEFAULT_CONTACT_WEBHOOK_RETRY_BACKOFF_MS = 250;

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
    if (!raw) {
        return DEFAULT_CONTACT_WEBHOOK_TIMEOUT_MS;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
        return DEFAULT_CONTACT_WEBHOOK_TIMEOUT_MS;
    }

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

async function sendLeadByEmail(lead: ContactLead, smtp: NonNullable<ReturnType<typeof getSmtpConfig>>) {
    const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
            user: smtp.user,
            pass: smtp.pass,
        },
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

    return { delivered: true };
}

async function postLeadToWebhookOnce(lead: ContactLead, webhookUrl: string) {
    const controller = new AbortController();
    const timeoutMs = getContactWebhookTimeoutMs();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;

    try {
        response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
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

    return { forwarded: true };
}

function shouldRetryWebhookError(error: unknown) {
    if (!(error instanceof Error)) {
        return false;
    }
    if (error.name === "AbortError") {
        return true;
    }
    const match = error.message.match(/status\s+(\d+)/i);
    if (!match) {
        return true; // network-ish / unknown fetch error
    }
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
            return await postLeadToWebhookOnce(lead, webhookUrl);
        } catch (error) {
            lastError = error;
            const canRetry = attempt < retries && shouldRetryWebhookError(error);
            if (!canRetry) {
                throw error;
            }
            await sleep(baseBackoffMs * (attempt + 1));
        }
    }

    throw lastError instanceof Error ? lastError : new Error("Webhook delivery failed");
}

export async function POST(request: NextRequest) {
    const isAllowed = await checkRateLimit(rateLimitKeyForIp(request), "contact");

    if (!isAllowed) {
        return NextResponse.json(
            { error: "Demasiadas solicitudes. Intenta nuevamente en un minuto." },
            { status: 429 }
        );
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
    }

    const validation = ContactLeadSchema.safeParse(body);
    if (!validation.success) {
        const firstIssue = validation.error.issues[0]?.message ?? "Datos invalidos";
        return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const lead = validation.data;
    const isLeadAllowed = await checkRateLimit(rateLimitKeyForContactLead(lead), "contact");
    if (!isLeadAllowed) {
        return NextResponse.json(
            { error: "Demasiadas solicitudes. Intenta nuevamente en un minuto." },
            { status: 429 }
        );
    }
    let emailed = false;
    let forwarded = false;
    let attemptedEmail = false;
    let attemptedWebhook = false;

    const smtpConfig = getSmtpConfig();
    attemptedEmail = smtpConfig !== null;
    if (smtpConfig) {
        try {
            const emailResult = await sendLeadByEmail(lead, smtpConfig);
            emailed = emailResult.delivered;
        } catch (error) {
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
            const webhookResult = await forwardLeadToWebhook(lead, webhookUrl);
            forwarded = webhookResult.forwarded;
        } catch (error) {
            console.error("Failed to forward contact lead to webhook", {
                message: error instanceof Error ? error.message : "unknown error",
                company: lead.company,
            });
        }
    }

    if (!attemptedEmail && !attemptedWebhook) {
        console.warn("No delivery channel configured for contact leads. Configure SMTP or webhook.");
        return NextResponse.json({ ok: true, emailed: false, forwarded: false }, { status: 202 });
    }

    if (!emailed && !forwarded) {
        return NextResponse.json({ error: "No se pudo procesar la solicitud" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, emailed, forwarded }, { status: 200 });
}
