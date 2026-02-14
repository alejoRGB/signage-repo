import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const envCheck = {
            DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED ? "Present (Starts with " + process.env.DATABASE_URL_UNPOOLED.substring(0, 10) + "...)" : "MISSING",
            DATABASE_URL: process.env.DATABASE_URL ? "Present (Starts with " + process.env.DATABASE_URL.substring(0, 10) + "...)" : "MISSING",
            NODE_ENV: process.env.NODE_ENV,
        };

        // Try to connect
        let dbStatus = "Unknown";
        try {
            await prisma.$connect();
            dbStatus = "Connected";
        } catch (e: any) {
            dbStatus = "Connection Failed: " + e.message;
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
