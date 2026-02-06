import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const PairDeviceSchema = z.object({
    code: z.string().length(6, "Code must be 6 characters"),
    name: z.string().min(1, "Name is required").max(50, "Name too long"),
});

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const json = await request.json();

        // Zod Validation
        const result = PairDeviceSchema.safeParse(json);
        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0].message },
                { status: 400 }
            );
        }

        const { code, name } = result.data;

        // Find device by pairing code
        const device = await prisma.device.findUnique({
            where: { pairingCode: code },
        });

        if (!device) {
            return NextResponse.json(
                { error: "Invalid pairing code" },
                { status: 404 }
            );
        }

        // Check if already paired
        if (device.userId) {
            return NextResponse.json(
                { error: "Device is already paired" },
                { status: 400 }
            );
        }

        // Update device
        const updatedDevice = await prisma.device.update({
            where: { id: device.id },
            data: {
                userId: session.user.id,
                name: name,
                pairingCode: null, // Clear code after pairing
                pairingCodeExpiresAt: null,
                status: "online", // Assume it's online since it's being paired
            },
        });

        return NextResponse.json(updatedDevice);

    } catch (error) {
        console.error("Pair API error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
