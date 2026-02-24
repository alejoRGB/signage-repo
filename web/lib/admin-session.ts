type AdminTokenLike = {
    role?: unknown;
    loginTimestamp?: unknown;
    error?: unknown;
};

export const ADMIN_SESSION_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

export function isAdminSessionExpiredToken(
    token: unknown,
    nowMs = Date.now()
) {
    if (!token || typeof token !== "object") {
        return false;
    }

    const candidate = token as AdminTokenLike;

    if (candidate.role !== "ADMIN") {
        return false;
    }

    if (candidate.error === "AdminSessionExpired") {
        return true;
    }

    const loginTimestamp =
        typeof candidate.loginTimestamp === "number" && Number.isFinite(candidate.loginTimestamp)
            ? candidate.loginTimestamp
            : 0;

    if (loginTimestamp <= 0) {
        return true;
    }

    return nowMs - loginTimestamp > ADMIN_SESSION_MAX_AGE_MS;
}
