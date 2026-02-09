import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UpdateDeviceSchema } from "@/lib/validations";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const { id } = await params;
        const json = await request.json();

        // Validate input
        const result = UpdateDeviceSchema.safeParse(json);
        if (!result.success) {
            return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
        }

        const body = result.data;

        const device = await prisma.device.update({
            where: {
                id: id,
            },
            data: {
                name: body.name,
                activePlaylistId: body.activePlaylistId,
                defaultPlaylistId: body.defaultPlaylistId,
                scheduleId: body.scheduleId,
            },
        });

        return NextResponse.json(device);
    } catch (error) {
        console.error("[DEVICE_PATCH]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const { id } = await params;

        const device = await prisma.device.delete({
            where: {
                id: id,
            },
        });

        return NextResponse.json(device);
    } catch (error) {
        console.error("[DEVICE_DELETE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
