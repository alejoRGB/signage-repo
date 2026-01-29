import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    try {
        console.log("[TEST-DB] Attempting to create dummy user...");
        // Attempt to count users to check read access
        const count = await prisma.user.count();

        return NextResponse.json({
            success: true,
            message: "DB Read Successful",
            userCount: count
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
