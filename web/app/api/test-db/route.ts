import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    try {
        console.log("[TEST-DB] Attempting to create dummy user...");
        // Attempt to count users to check read access
        const count = await prisma.user.count();

        // Attempt to count devices
        const deviceCount = await prisma.device.count();

        // Attempt WRITE operation
        const dummyDevice = await prisma.device.create({
            data: {
                name: "Test Write Device " + Date.now(),
                status: "test_write",
                // token is auto-generated
            }
        });

        // Cleanup (optional, or leave it to verify in dashboard)
        await prisma.device.delete({ where: { id: dummyDevice.id } });

        return NextResponse.json({
            success: true,
            message: "DB Write & Delete Successful",
            userCount: count,
            deviceCount,
            writeTest: "Passed"
        });
    } catch (error: any) {
        console.error("[TEST-DB] Error:", error);
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
