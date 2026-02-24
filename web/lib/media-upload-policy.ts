export const MAX_MEDIA_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB
export const DEFAULT_MEDIA_UPLOAD_USER_QUOTA_BYTES = 20 * 1024 * 1024 * 1024; // 20 GiB

export function getMediaUploadUserQuotaBytes() {
    const raw = process.env.MEDIA_UPLOAD_USER_QUOTA_BYTES?.trim();
    if (!raw) {
        return DEFAULT_MEDIA_UPLOAD_USER_QUOTA_BYTES;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
        return DEFAULT_MEDIA_UPLOAD_USER_QUOTA_BYTES;
    }

    return Math.max(MAX_MEDIA_UPLOAD_SIZE_BYTES, Math.round(parsed));
}
