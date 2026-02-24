import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSafeStoredMediaFilename } from "@/lib/validations";
import { getDeviceTokenFromRequest } from "@/lib/device-token-request";
import fs from "fs";
import path from "path";

function parseRedirectUrl(rawUrl: string): string | null {
    try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return null;
        }
        return parsed.toString();
    } catch {
        return null;
    }
}

function resolveSafeUploadFilePath(uploadsDir: string, filename: string): string | null {
    if (!isSafeStoredMediaFilename(filename)) {
        return null;
    }

    const uploadsRoot = path.resolve(uploadsDir);
    const resolvedFilePath = path.resolve(uploadsRoot, filename);
    const relative = path.relative(uploadsRoot, resolvedFilePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        return null;
    }

    return resolvedFilePath;
}

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> } // Force rebuild
) {
    try {
        const { id } = await context.params;
        const { token } = getDeviceTokenFromRequest(request);

        if (!token) {
            return NextResponse.json(
                { error: "Device token required" },
                { status: 401 }
            );
        }

        // Verify device token
        const device = await prisma.device.findUnique({
            where: { token: token },
        });

        if (!device) {
            return NextResponse.json(
                { error: "Invalid token" },
                { status: 401 }
            );
        }

        if (!device.userId) {
            return NextResponse.json(
                { error: "Device is not paired" },
                { status: 403 }
            );
        }

        // Find media item and verify it belongs to the same user as the device
        const mediaItem = await prisma.mediaItem.findFirst({
            where: {
                id: id,
                userId: device.userId,
            },
        });

        if (!mediaItem) {
            return NextResponse.json(
                { error: "Media not found" },
                { status: 404 }
            );
        }

        // Check if it's an external URL (Vercel Blob)
        const redirectUrl = parseRedirectUrl(mediaItem.url);
        if (redirectUrl) {
            return NextResponse.redirect(redirectUrl);
        }

        if (!mediaItem.filename) {
            return NextResponse.json(
                { error: "File not found (no filename)" },
                { status: 404 }
            );
        }

        // Get file path
        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        const filePath = resolveSafeUploadFilePath(uploadsDir, mediaItem.filename);
        if (!filePath) {
            return NextResponse.json(
                { error: "Invalid media filename" },
                { status: 400 }
            );
        }

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return NextResponse.json(
                { error: "File not found throughout server" },
                { status: 404 }
            );
        }

        // Read file
        const fileBuffer = fs.readFileSync(filePath);

        // Determine content type
        const ext = path.extname(mediaItem.filename).toLowerCase();
        const contentTypeMap: { [key: string]: string } = {
            ".mp4": "video/mp4",
            ".webm": "video/webm",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
        };
        const contentType = contentTypeMap[ext] || "application/octet-stream";

        // Return file
        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `attachment; filename="${mediaItem.filename}"`,
                "Content-Length": fileBuffer.length.toString(),
            },
        });
    } catch (error) {
        console.error("Media download error:", error);
        return NextResponse.json(
            { error: "Failed to download media" },
            { status: 500 }
        );
    }
}
