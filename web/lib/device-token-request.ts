export type DeviceTokenSource = "x-device-token" | "authorization" | "query" | "missing";

export type DeviceTokenExtractionResult =
    | { token: string; source: Exclude<DeviceTokenSource, "missing"> }
    | { token: null; source: "missing" };

function normalizeToken(value: string | null): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function getBearerToken(request: Request): string | null {
    const authorization = request.headers.get("authorization");
    if (!authorization) {
        return null;
    }

    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match?.[1]) {
        return null;
    }

    return normalizeToken(match[1]);
}

export function getDeviceTokenFromRequest(
    request: Request,
    options?: { allowQueryFallback?: boolean }
): DeviceTokenExtractionResult {
    const allowQueryFallback = options?.allowQueryFallback ?? true;

    const headerToken = normalizeToken(request.headers.get("x-device-token"));
    if (headerToken) {
        return { token: headerToken, source: "x-device-token" };
    }

    const bearerToken = getBearerToken(request);
    if (bearerToken) {
        return { token: bearerToken, source: "authorization" };
    }

    if (allowQueryFallback) {
        const url = new URL(request.url);
        const queryToken = normalizeToken(url.searchParams.get("token"));
        if (queryToken) {
            return { token: queryToken, source: "query" };
        }
    }

    return { token: null, source: "missing" };
}
