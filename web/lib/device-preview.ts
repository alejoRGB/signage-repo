import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

export const MAX_DEVICE_PREVIEW_SIZE_BYTES = 8 * 1024 * 1024;

export async function uploadAndPersistDevicePreview(deviceId: string, previewFile: File) {
  const isImageFile = previewFile.type.startsWith("image/");
  if (!isImageFile) {
    return { ok: false as const, reason: "NON_IMAGE" };
  }

  if (previewFile.size > MAX_DEVICE_PREVIEW_SIZE_BYTES) {
    return { ok: false as const, reason: "TOO_LARGE" };
  }

  const blob = await put(`device-previews/${deviceId}/latest.jpg`, previewFile, {
    access: "public",
    addRandomSuffix: false,
    contentType: "image/jpeg",
    cacheControlMaxAge: 5,
  });

  await prisma.device.update({
    where: { id: deviceId },
    data: {
      previewImageUrl: blob.url,
      previewCapturedAt: new Date(),
    },
  });

  return { ok: true as const, url: blob.url };
}

