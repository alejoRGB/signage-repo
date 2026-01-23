import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get("token");

        if (!token) {
            return NextResponse.json({ error: "Token required" }, { status: 400 });
        }

        const device = await prisma.device.findUnique({
            where: { token },
        });

        if (!device) {
            return NextResponse.json({ error: "Device not found" }, { status: 404 });
        }

        // Check if device is paired (has a userId)
        if (device.userId) {
            return NextResponse.json({
                status: "paired",
                device_name: device.name,
            });
        }

        return NextResponse.json({
            status: "unpaired",
            pairing_code: device.pairingCode,
        });

    } catch (error) {
        console.error("Status API error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
