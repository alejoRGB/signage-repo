import { NextRequest, NextResponse } from "next/server";
import { ContactLeadSchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitKeyForContactLead, rateLimitKeyForIp } from "@/lib/rate-limit-key";
import { enqueueContactLeadJob, hasAnyContactDeliveryChannelConfigured } from "@/lib/contact-delivery";

export const runtime = "nodejs";

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

    const job = await enqueueContactLeadJob(lead);
    const deliveryConfigured = hasAnyContactDeliveryChannelConfigured();
    if (!deliveryConfigured) {
        console.warn("No delivery channel configured for contact leads. Queued job will dead-letter until SMTP or webhook is configured.");
    }

    return NextResponse.json(
        {
            ok: true,
            queued: true,
            jobId: job.id,
            deliveryConfigured,
        },
        { status: 202 }
    );
}

