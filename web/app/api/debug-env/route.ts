import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const envCheck = {
            POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL ? "Present (Starts with " + process.env.POSTGRES_PRISMA_URL.substring(0, 10) + "...)" : "MISSING",
            POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING ? "Present" : "MISSING",
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
    } catch (error: any) {
        return NextResponse.json({
            error: "Fatal Error",
            message: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
