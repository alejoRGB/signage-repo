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

        // Verify device exists and belongs to user
        const existingDevice = await prisma.device.findUnique({
            where: { id: id },
            select: { userId: true }
        });

        if (!existingDevice) {
            return NextResponse.json({ error: "Device not found" }, { status: 404 });
        }

        if (existingDevice.userId !== session.user.id) {
            return NextResponse.json({ error: "Unauthorized access to device" }, { status: 403 });
        }

        // Verify foreign keys ownership if provided
        if (body.activePlaylistId) {
            const playlist = await prisma.playlist.findUnique({
                where: { id: body.activePlaylistId },
                select: { userId: true },
            });
            if (!playlist) {
                return NextResponse.json({ error: "activePlaylistId not found" }, { status: 404 });
            }
            if (playlist.userId !== session.user.id) {
                return NextResponse.json({ error: "Unauthorized activePlaylistId" }, { status: 403 });
            }
        }

        if (body.defaultPlaylistId) {
            const playlist = await prisma.playlist.findUnique({
                where: { id: body.defaultPlaylistId },
                select: { userId: true },
            });
            if (!playlist) {
                return NextResponse.json({ error: "defaultPlaylistId not found" }, { status: 404 });
            }
            if (playlist.userId !== session.user.id) {
                return NextResponse.json({ error: "Unauthorized defaultPlaylistId" }, { status: 403 });
            }
        }

        if (body.scheduleId) {
            const schedule = await prisma.schedule.findUnique({
                where: { id: body.scheduleId },
                select: { userId: true },
            });
            if (!schedule) {
                return NextResponse.json({ error: "scheduleId not found" }, { status: 404 });
            }
            if (schedule.userId !== session.user.id) {
                return NextResponse.json({ error: "Unauthorized scheduleId" }, { status: 403 });
            }
        }

        // Clean up IDs: Empty string "" should be treated as null
        const activePlaylistId = body.activePlaylistId === "" ? null : body.activePlaylistId;
        const defaultPlaylistId = body.defaultPlaylistId === "" ? null : body.defaultPlaylistId;
        const scheduleId = body.scheduleId === "" ? null : body.scheduleId;

        const device = await prisma.device.update({
            where: {
                id: id,
            },
            data: {
                name: body.name,
                // Only update if provided (undefined means no change, null means disconnect)
                ...(body.activePlaylistId !== undefined && { activePlaylistId }),
                ...(body.defaultPlaylistId !== undefined && { defaultPlaylistId }),
                ...(body.scheduleId !== undefined && { scheduleId }),
            },
        });

        return NextResponse.json(device);
    } catch (error: any) {
        console.error("[DEVICE_PATCH]", error);
        return NextResponse.json({ error: error.message || String(error) || "Internal Server Error" }, { status: 500 });
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

        const existingDevice = await prisma.device.findUnique({
            where: { id },
            select: { userId: true },
        });

        if (!existingDevice) {
            return new NextResponse("Device not found", { status: 404 });
        }

        if (existingDevice.userId !== session.user.id) {
            return new NextResponse("Unauthorized access to device", { status: 403 });
        }

        await prisma.device.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[DEVICE_DELETE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
