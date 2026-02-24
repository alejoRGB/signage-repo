import { NextResponse } from "next/server";
import { processContactLeadJobs } from "@/lib/contact-delivery";
import { requireInternalWorkerAuth } from "@/lib/internal-worker-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseLimit(input: string | null) {
    if (!input) return 10;
    const parsed = Number(input);
    if (!Number.isFinite(parsed)) return 10;
    return Math.min(100, Math.max(1, Math.round(parsed)));
}

async function handle(request: Request) {
    const authError = requireInternalWorkerAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"));
    const result = await processContactLeadJobs(limit);

    return NextResponse.json({
        ok: true,
        limit,
        ...result,
    });
}

export async function POST(request: Request) {
    return handle(request);
}

export async function GET(request: Request) {
    return handle(request);
}

