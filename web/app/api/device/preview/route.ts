import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_PREVIEW_SIZE_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const deviceToken = formData.get("device_token");
        const playingPlaylistIdValue = formData.get("playing_playlist_id");
        const currentContentNameValue = formData.get("current_content_name");
        const previewFile = formData.get("preview");

        if (!deviceToken || typeof deviceToken !== "string") {
            return NextResponse.json({ error: "device_token is required" }, { status: 400 });
        }

        const { checkRateLimit } = await import("@/lib/rate-limit");
        const isAllowed = await checkRateLimit(deviceToken);
        if (!isAllowed) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const device = await prisma.device.findUnique({
            where: { token: deviceToken },
            include: {
                user: {
                    select: { isActive: true }
                }
            }
        });

        if (!device) {
            return NextResponse.json({ error: "Invalid device token" }, { status: 401 });
        }

        if (device.user && !device.user.isActive) {
            return NextResponse.json({ error: "Account suspended" }, { status: 403 });
        }

        const updateData: {
            status: string;
            lastSeenAt: Date;
            playingPlaylistId?: string | null;
            currentContentName?: string | null;
            previewImageUrl?: string;
            previewCapturedAt?: Date;
        } = {
            status: "online",
            lastSeenAt: new Date(),
        };

        if (typeof playingPlaylistIdValue === "string") {
            updateData.playingPlaylistId = playingPlaylistIdValue || null;
        }

        if (typeof currentContentNameValue === "string") {
            updateData.currentContentName = currentContentNameValue || null;
        }

        if (previewFile instanceof File) {
            const isImageFile = previewFile.type.startsWith("image/");

            if (!isImageFile) {
                console.warn(`[DEVICE_PREVIEW_POST] Ignoring non-image preview (${previewFile.type}) for device ${device.id}`);
            } else if (previewFile.size > MAX_PREVIEW_SIZE_BYTES) {
                console.warn(`[DEVICE_PREVIEW_POST] Ignoring oversized preview (${previewFile.size} bytes) for device ${device.id}`);
            } else {
                try {
                    const blob = await put(
                        `device-previews/${device.id}/latest.jpg`,
                        previewFile,
                        {
                            access: "public",
                            addRandomSuffix: false,
                            contentType: "image/jpeg",
                            cacheControlMaxAge: 5,
                        }
                    );

                    updateData.previewImageUrl = blob.url;
                    updateData.previewCapturedAt = new Date();
                } catch (blobError) {
                    console.error("[DEVICE_PREVIEW_UPLOAD]", blobError);
                }
            }

        }

        await prisma.device.update({
            where: { id: device.id },
            data: updateData,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[DEVICE_PREVIEW_POST]", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
