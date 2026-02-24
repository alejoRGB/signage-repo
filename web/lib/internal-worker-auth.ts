import { NextResponse } from "next/server";

function getConfiguredWorkerSecret() {
    return process.env.INTERNAL_WORKER_SECRET?.trim() || null;
}

export function requireInternalWorkerAuth(request: Request): NextResponse | null {
    const configuredSecret = getConfiguredWorkerSecret();
    if (!configuredSecret) {
        console.error("[INTERNAL_WORKER_AUTH] INTERNAL_WORKER_SECRET is not configured");
        return NextResponse.json({ error: "Worker not configured" }, { status: 503 });
    }

    const authHeader = request.headers.get("authorization") ?? "";
    const bearerPrefix = "Bearer ";
    if (!authHeader.startsWith(bearerPrefix)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const provided = authHeader.slice(bearerPrefix.length).trim();
    if (!provided || provided !== configuredSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return null;
}

