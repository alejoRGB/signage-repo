import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DIRECTIVE_TAB } from "@/lib/directive-tabs";

const UpdateDirectiveTabSchema = z.object({
    activeDirectiveTab: z.enum([DIRECTIVE_TAB.SCHEDULES, DIRECTIVE_TAB.SYNC_VIDEOWALL]),
});

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "USER") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { activeDirectiveTab: true },
    });

    return NextResponse.json({
        activeDirectiveTab: user?.activeDirectiveTab ?? DIRECTIVE_TAB.SCHEDULES,
    });
}

export async function PATCH(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "USER") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const json = await request.json();
        const result = UpdateDirectiveTabSchema.safeParse(json);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0]?.message ?? "Invalid payload" },
                { status: 400 }
            );
        }

        const user = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                activeDirectiveTab: result.data.activeDirectiveTab,
            },
            select: { activeDirectiveTab: true },
        });

        return NextResponse.json({ activeDirectiveTab: user.activeDirectiveTab });
    } catch (error) {
        console.error("Update active directive tab error:", error);
        return NextResponse.json(
            { error: "Failed to update active tab" },
            { status: 500 }
        );
    }
}
