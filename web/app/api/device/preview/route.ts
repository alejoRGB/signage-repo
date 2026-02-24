import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimitKeyForDeviceToken } from "@/lib/rate-limit-key";
import { uploadAndPersistDevicePreview } from "@/lib/device-preview";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const deviceToken = formData.get("device_token");
    const previewFile = formData.get("preview");

    if (!deviceToken || typeof deviceToken !== "string") {
      return NextResponse.json({ error: "device_token is required" }, { status: 400 });
    }

    if (!(previewFile instanceof File)) {
      return NextResponse.json({ error: "preview image is required" }, { status: 400 });
    }

    const { checkRateLimit } = await import("@/lib/rate-limit");
    const isAllowed = await checkRateLimit(rateLimitKeyForDeviceToken(deviceToken), "device_preview");
    if (!isAllowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const device = await prisma.device.findUnique({
      where: { token: deviceToken },
      include: {
        user: {
          select: { isActive: true },
        },
      },
    });

    if (!device) {
      return NextResponse.json({ error: "Invalid device token" }, { status: 401 });
    }
    if (device.user && !device.user.isActive) {
      return NextResponse.json({ error: "Account suspended" }, { status: 403 });
    }

    const uploadResult = await uploadAndPersistDevicePreview(device.id, previewFile);
    if (!uploadResult.ok) {
      if (uploadResult.reason === "NON_IMAGE") {
        return NextResponse.json({ error: "preview must be an image" }, { status: 400 });
      }
      if (uploadResult.reason === "TOO_LARGE") {
        return NextResponse.json({ error: "preview too large" }, { status: 413 });
      }
      return NextResponse.json({ error: "preview upload failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, previewUrl: uploadResult.url });
  } catch (error) {
    console.error("[DEVICE_PREVIEW_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

