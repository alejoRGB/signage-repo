/**
 * @jest-environment node
 */
import { getServerSession } from "next-auth";
import { GET as getDebugEnv } from "@/app/api/debug-env/route";
import { GET as getDebugPlaylist } from "@/app/api/debug/playlist/[id]/route";
import { prisma } from "@/lib/prisma";

jest.mock("next-auth", () => ({
    getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
    authOptions: {},
}));

jest.mock("@/lib/prisma", () => ({
    prisma: {
        $connect: jest.fn(),
        playlist: {
            findUnique: jest.fn(),
        },
    },
}));

const mockedGetServerSession = jest.mocked(getServerSession);
const mockedPrisma = prisma as unknown as {
    $connect: jest.Mock;
    playlist: { findUnique: jest.Mock };
};

describe("debug API endpoints", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        delete process.env.ENABLE_DEBUG_API_ROUTES;
        mockedGetServerSession.mockReset();
        mockedPrisma.$connect.mockReset().mockResolvedValue(undefined);
        mockedPrisma.playlist.findUnique.mockReset().mockResolvedValue({ id: "p1", name: "Debug" });
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it("returns 404 for debug-env when debug APIs are disabled", async () => {
        const response = await getDebugEnv();
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe("Not Found");
        expect(mockedGetServerSession).not.toHaveBeenCalled();
    });

    it("requires admin session when debug APIs are enabled", async () => {
        process.env.ENABLE_DEBUG_API_ROUTES = "true";
        mockedGetServerSession.mockResolvedValue(null);

        const noSession = await getDebugEnv();
        expect(noSession.status).toBe(401);

        mockedGetServerSession.mockResolvedValue({
            user: { role: "USER", isActive: true },
        } as any);
        const nonAdmin = await getDebugEnv();
        expect(nonAdmin.status).toBe(403);
    });

    it("sanitizes debug-env response for admin access", async () => {
        process.env.ENABLE_DEBUG_API_ROUTES = "true";
        process.env.DATABASE_URL = "postgres://secret-connection-string";
        process.env.DATABASE_URL_UNPOOLED = "postgres://another-secret";
        mockedGetServerSession.mockResolvedValue({
            user: { role: "ADMIN", isActive: true },
        } as any);
        mockedPrisma.$connect.mockRejectedValue(new Error("password authentication failed"));

        const response = await getDebugEnv();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.env.DATABASE_URL).toBe(true);
        expect(data.env.DATABASE_URL_UNPOOLED).toBe(true);
        expect(String(data.dbStatus)).toBe("Connection Failed");
        expect(JSON.stringify(data)).not.toContain("postgres://");
        expect(JSON.stringify(data)).not.toContain("password authentication failed");
    });

    it("protects debug playlist endpoint and allows admin only when enabled", async () => {
        const disabled = await getDebugPlaylist(new Request("http://localhost"), {
            params: Promise.resolve({ id: "p1" }),
        });
        expect(disabled.status).toBe(404);

        process.env.ENABLE_DEBUG_API_ROUTES = "true";
        mockedGetServerSession.mockResolvedValue({
            user: { role: "ADMIN", isActive: true },
        } as any);

        const enabled = await getDebugPlaylist(new Request("http://localhost"), {
            params: Promise.resolve({ id: "p1" }),
        });
        const data = await enabled.json();

        expect(enabled.status).toBe(200);
        expect(mockedPrisma.playlist.findUnique).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "p1" },
        }));
        expect(data.id).toBe("p1");
    });
});
