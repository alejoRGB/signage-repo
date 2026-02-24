import { NextResponse } from "next/server";
import { requireInternalWorkerAuth } from "@/lib/internal-worker-auth";
import { reconcileMediaUploadReceipts } from "@/lib/media-upload-receipts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseLimit(input: string | null) {
    if (!input) return 25;
    const parsed = Number(input);
    if (!Number.isFinite(parsed)) return 25;
    return Math.min(100, Math.max(1, Math.round(parsed)));
}

async function handle(request: Request) {
    const authError = requireInternalWorkerAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"));
    const result = await reconcileMediaUploadReceipts(limit);
    return NextResponse.json({ ok: true, limit, ...result });
}

export async function POST(request: Request) {
    return handle(request);
}

export async function GET(request: Request) {
    return handle(request);
}

