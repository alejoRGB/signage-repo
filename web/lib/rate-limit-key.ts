import crypto from "crypto";

const MAX_KEY_PART_LENGTH = 128;

function clamp(value: string) {
    return value.trim().slice(0, MAX_KEY_PART_LENGTH);
}

function stripPortFromIp(candidate: string) {
    const value = candidate.trim();
    if (!value) {
        return "";
    }

    // IPv6 in RFC 3986 style: [::1]:1234
    const bracketedMatch = value.match(/^\[([^\]]+)\](?::\d+)?$/);
    if (bracketedMatch?.[1]) {
        return bracketedMatch[1];
    }

    // IPv4 with port: 203.0.113.10:443
    const ipv4PortMatch = value.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
    if (ipv4PortMatch?.[1]) {
        return ipv4PortMatch[1];
    }

    return value;
}

function getFirstHeaderValue(headers: Headers, name: string) {
    const raw = headers.get(name);
    if (!raw) {
        return null;
    }

    const first = raw
        .split(",")
        .map((part) => part.trim())
        .find(Boolean);

    return first ? clamp(stripPortFromIp(first)) : null;
}

function getForwardedHeaderIp(headers: Headers) {
    const forwarded = headers.get("forwarded");
    if (!forwarded) {
        return null;
    }

    const forMatch = forwarded.match(/for=(?:"?\[?)([^;\],"]+)/i);
    if (!forMatch?.[1]) {
        return null;
    }

    return clamp(stripPortFromIp(forMatch[1]));
}

export function getClientIpForRateLimit(request: Request) {
    return (
        getFirstHeaderValue(request.headers, "x-forwarded-for") ??
        getFirstHeaderValue(request.headers, "x-real-ip") ??
        getForwardedHeaderIp(request.headers) ??
        "unknown"
    );
}

function hashIdentifier(value: string) {
    return crypto.createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function rateLimitKeyForIp(request: Request) {
    const ip = getClientIpForRateLimit(request);
    return `ip:${ip}`;
}

export function rateLimitKeyForDeviceToken(deviceToken: string) {
    return `device-token:${hashIdentifier(deviceToken)}`;
}

export function rateLimitKeyForUserId(userId: string) {
    return `user:${clamp(userId)}`;
}

export function rateLimitKeyForContactLead(input: { email: string; phone: string }) {
    const email = clamp(input.email.trim().toLowerCase());
    const phone = clamp(input.phone.replace(/\s+/g, ""));
    return `contact-lead:${hashIdentifier(`${email}|${phone}`)}`;
}
