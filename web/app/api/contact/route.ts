import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import type { z } from "zod";
import { ContactLeadSchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type ContactLead = z.infer<typeof ContactLeadSchema>;
const DEFAULT_CONTACT_EMAIL = "info.senaldigital@gmail.com";

function getClientIp(request: NextRequest) {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
        return forwardedFor.split(",")[0]?.trim() ?? "unknown";
    }

    return request.headers.get("x-real-ip") ?? "unknown";
}

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

async function forwardLeadToWebhook(lead: ContactLead, webhookUrl: string) {
    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
            ...lead,
            source: "senaldigital.xyz",
            submittedAt: new Date().toISOString(),
        }),
    });

    if (!response.ok) {
        throw new Error(`Webhook returned status ${response.status}`);
    }

    return { forwarded: true };
}

export async function POST(request: NextRequest) {
    const ip = getClientIp(request);
    const isAllowed = await checkRateLimit(`contact:${ip}`, "contact");

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

    const webhookUrl = process.env.CONTACT_WEBHOOK_URL;
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
