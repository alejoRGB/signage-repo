import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDebugEndpointAccess } from "@/lib/debug-endpoint-access";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const denied = await requireDebugEndpointAccess();
        if (denied) {
            return denied;
        }

        const envCheck = {
            DATABASE_URL_UNPOOLED: Boolean(process.env.DATABASE_URL_UNPOOLED),
            DATABASE_URL: Boolean(process.env.DATABASE_URL),
            NODE_ENV: process.env.NODE_ENV,
        };

        // Try to connect
        let dbStatus = "Unknown";
        try {
            await prisma.$connect();
            dbStatus = "Connected";
        } catch {
            dbStatus = "Connection Failed";
        }

        return NextResponse.json({
            status: "Debug Info",
            env: envCheck,
            dbStatus
        });
    } catch (error) {
        console.error("[DEBUG_ENV_GET]", error);
        return NextResponse.json({
            error: "Internal server error",
        }, { status: 500 });
    }
}
