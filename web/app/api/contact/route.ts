import { NextRequest, NextResponse } from "next/server";
import { ContactLeadSchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";

function getClientIp(request: NextRequest) {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
        return forwardedFor.split(",")[0]?.trim() ?? "unknown";
    }

    return request.headers.get("x-real-ip") ?? "unknown";
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

    const webhookUrl = process.env.CONTACT_WEBHOOK_URL;
    if (!webhookUrl) {
        console.warn("CONTACT_WEBHOOK_URL is not configured. Lead was not forwarded.", {
            company: validation.data.company,
            businessType: validation.data.businessType,
            screens: validation.data.screens,
            branches: validation.data.branches,
            zone: validation.data.zone,
        });

        return NextResponse.json({ ok: true, forwarded: false }, { status: 202 });
    }

    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            cache: "no-store",
            body: JSON.stringify({
                ...validation.data,
                source: "senaldigital.xyz",
                submittedAt: new Date().toISOString(),
            }),
        });

        if (!response.ok) {
            console.error("Contact webhook error", { status: response.status });
            return NextResponse.json({ error: "No se pudo procesar la solicitud" }, { status: 502 });
        }

        return NextResponse.json({ ok: true, forwarded: true }, { status: 200 });
    } catch (error) {
        console.error("Failed to submit contact lead", {
            message: error instanceof Error ? error.message : "unknown error",
        });
        return NextResponse.json({ error: "No se pudo procesar la solicitud" }, { status: 502 });
    }
}
