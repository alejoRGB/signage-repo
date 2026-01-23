import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { join } from "path";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Ensure filename is safe and unique-ish
        const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "")}`;

        // Determine type
        const type = file.type.startsWith("video")
            ? "video"
            : file.type.startsWith("image")
                ? "image"
                : "web"; // Default fallthrough

        let url = "";

        // Check if Vercel Blob is configured (Cloud Deployment)
        if (process.env.BLOB_READ_WRITE_TOKEN) {
            const { put } = await import("@vercel/blob");
            const blob = await put(filename, file, { access: "public" });
            url = blob.url;
            console.log("Uploaded to Vercel Blob:", url);
        } else {
            // Fallback to Local Filesystem
            const uploadDir = join(process.cwd(), "public", "uploads");
            try {
                await mkdir(uploadDir, { recursive: true });
            } catch (e) { }

            const filepath = join(uploadDir, filename);
            await writeFile(filepath, buffer);
            url = `/uploads/${filename}`;
            console.log("Uploaded to Local Disk:", url);
        }

        const mediaItem = await prisma.mediaItem.create({
            data: {
                userId: session.user.id,
                name: file.name,
                type: type,
                url: url,
                filename: filename,
                duration: 0,
            },
        });

        return NextResponse.json(mediaItem);
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json(
            { error: "Something went wrong during upload" },
            { status: 500 }
        );
    }
}
