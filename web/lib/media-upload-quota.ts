import { prisma } from "@/lib/prisma";
import { getMediaUploadUserQuotaBytes } from "@/lib/media-upload-policy";

export type DeclaredUploadClientPayload = {
    size?: number;
    contentType?: string;
    originalName?: string;
};

export function parseDeclaredUploadClientPayload(clientPayload: string | null | undefined): DeclaredUploadClientPayload {
    if (!clientPayload) {
        return {};
    }
    try {
        const parsed = JSON.parse(clientPayload) as Record<string, unknown>;
        const size = typeof parsed.size === "number" && Number.isFinite(parsed.size) ? Math.max(0, Math.round(parsed.size)) : undefined;
        const contentType = typeof parsed.contentType === "string" ? parsed.contentType.trim().slice(0, 100) : undefined;
        const originalName = typeof parsed.originalName === "string" ? parsed.originalName.trim().slice(0, 255) : undefined;
        return { size, contentType, originalName };
    } catch {
        throw new Error("Invalid upload client payload");
    }
}

export async function getUserMediaUsageBytes(userId: string) {
    const aggregate = await prisma.mediaItem.aggregate({
        where: { userId },
        _sum: { size: true },
    });
    return Number(aggregate._sum.size ?? 0);
}

export async function assertUserMediaQuotaAvailable(userId: string, incomingBytes: number) {
    const quotaBytes = getMediaUploadUserQuotaBytes();
    const usageBytes = await getUserMediaUsageBytes(userId);
    const projected = usageBytes + Math.max(0, Math.round(incomingBytes));

    if (projected > quotaBytes) {
        const quotaGiB = (quotaBytes / (1024 ** 3)).toFixed(1);
        throw new Error(`Media storage quota exceeded (${quotaGiB} GB)`);
    }

    return { usageBytes, quotaBytes, projectedBytes: projected };
}
