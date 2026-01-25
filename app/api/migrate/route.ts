import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    try {
        // Require authentication
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Execute the migration SQL
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "WatchdogEvent" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "deviceId" TEXT NOT NULL,
                "eventType" TEXT NOT NULL,
                "details" TEXT NOT NULL,
                "restartCount" INTEGER NOT NULL DEFAULT 0,
                "timestamp" TIMESTAMP(3) NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "WatchdogEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
            );
        `);

        // Create indexes
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "WatchdogEvent_deviceId_idx" ON "WatchdogEvent"("deviceId");
        `);

        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "WatchdogEvent_timestamp_idx" ON "WatchdogEvent"("timestamp");
        `);

        return NextResponse.json({
            success: true,
            message: "WatchdogEvent table created successfully"
        });
    } catch (error: any) {
        console.error("[MIGRATION] Error:", error);

        // If table already exists, that's fine
        if (error.message?.includes("already exists")) {
            return NextResponse.json({
                success: true,
                message: "WatchdogEvent table already exists"
            });
        }

        return NextResponse.json(
            { error: "Migration failed", details: error.message },
            { status: 500 }
        );
    }
}
