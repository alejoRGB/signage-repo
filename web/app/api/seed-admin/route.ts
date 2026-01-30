import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
    try {
        const email = 'admin@example.invalid';
        const username = 'admin';
        const password = '[REDACTED_ADMIN_PASSWORD]';
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check if user exists by email
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            await prisma.user.update({
                where: { email },
                data: {
                    username,
                    password: hashedPassword,
                },
            });
            return NextResponse.json({ message: "Admin user updated successfully. Login with username: admin" });
        } else {
            // Check if username taken
            const existingUsername = await prisma.user.findUnique({
                where: { username }
            });

            if (existingUsername) {
                await prisma.user.delete({ where: { username } });
            }

            await prisma.user.create({
                data: {
                    email,
                    username,
                    password: hashedPassword,
                    name: 'Admin User',
                    role: 'ADMIN',
                    isActive: true,
                },
            });
            return NextResponse.json({ message: "Admin user created successfully. Login with username: admin" });
        }
    } catch (error) {
        console.error("Seed error:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
