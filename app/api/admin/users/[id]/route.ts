
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    // 1. Security Check: Must be ADMIN
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { isActive } = body;

    try {
        // 2. Prevent deactivating yourself
        if (id === session.user.id && isActive === false) {
            return NextResponse.json(
                { error: "You cannot deactivate your own admin account." },
                { status: 400 }
            );
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: { isActive },
        });

        return NextResponse.json(updatedUser);
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to update user." },
            { status: 500 }
        );
    }
}
