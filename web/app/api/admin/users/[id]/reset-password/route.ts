import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const resetPasswordSchema = z.object({
    password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = params;
        const body = await request.json();
        const validation = resetPasswordSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 });
        }

        const { password } = validation.data;
        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.update({
            where: { id },
            data: { password: hashedPassword },
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Error resetting password:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
