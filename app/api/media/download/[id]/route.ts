import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        // Get token from query params
        const url = new URL(request.url);
        const token = url.searchParams.get("token");

        if (!token) {
            return NextResponse.json(
                { error: "Authentication token required" },
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

        // Get file path
        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        const filePath = path.join(uploadsDir, mediaItem.filename);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return NextResponse.json(
                { error: "File not found on server" },
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
