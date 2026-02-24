/**
 * @jest-environment node
 */
import { ADMIN_SESSION_MAX_AGE_MS, isAdminSessionExpiredToken } from "@/lib/admin-session";

describe("admin session expiry helper", () => {
    const nowMs = 1_700_000_000_000;

    it("returns false for non-admin tokens", () => {
        expect(
            isAdminSessionExpiredToken(
                {
                    role: "USER",
                    loginTimestamp: nowMs - (ADMIN_SESSION_MAX_AGE_MS * 10),
                },
                nowMs
            )
        ).toBe(false);
    });

    it("returns false for fresh admin token", () => {
        expect(
            isAdminSessionExpiredToken(
                {
                    role: "ADMIN",
                    loginTimestamp: nowMs - (ADMIN_SESSION_MAX_AGE_MS - 1),
                },
                nowMs
            )
        ).toBe(false);
    });

    it("returns true for expired admin token even without explicit error flag", () => {
        expect(
            isAdminSessionExpiredToken(
                {
                    role: "ADMIN",
                    loginTimestamp: nowMs - ADMIN_SESSION_MAX_AGE_MS - 1,
                },
                nowMs
            )
        ).toBe(true);
    });

    it("returns true when admin token has no loginTimestamp", () => {
        expect(
            isAdminSessionExpiredToken(
                {
                    role: "ADMIN",
                },
                nowMs
            )
        ).toBe(true);
    });

    it("returns true when jwt callback already marked the token as expired", () => {
        expect(
            isAdminSessionExpiredToken(
                {
                    role: "ADMIN",
                    loginTimestamp: nowMs,
                    error: "AdminSessionExpired",
                },
                nowMs
            )
        ).toBe(true);
    });
});

