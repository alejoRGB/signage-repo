/**
 * @jest-environment node
 */
import { GET as LIST_PRESETS, POST as CREATE_PRESET } from "@/app/api/sync/presets/route";
import {
    GET as GET_PRESET,
    PATCH as UPDATE_PRESET,
    DELETE as DELETE_PRESET,
} from "@/app/api/sync/presets/[id]/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

jest.mock("@/lib/prisma", () => ({
    prisma: {
        device: {
            findMany: jest.fn(),
        },
        mediaItem: {
            findMany: jest.fn(),
        },
        syncPreset: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            deleteMany: jest.fn(),
        },
        syncPresetDevice: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
        },
        $transaction: jest.fn(),
    },
}));

jest.mock("next-auth", () => ({
    getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
    authOptions: {},
}));

describe("Sync presets API", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getServerSession as jest.Mock).mockResolvedValue({
            user: { id: "user-1", role: "USER" },
        });
    });

    it("lists presets for authenticated user", async () => {
        (prisma.syncPreset.findMany as jest.Mock).mockResolvedValue([{ id: "preset-1" }]);

        const response = await LIST_PRESETS();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual([{ id: "preset-1" }]);
        expect(prisma.syncPreset.findMany).toHaveBeenCalled();
    });

    it("creates preset in COMMON mode", async () => {
        (prisma.device.findMany as jest.Mock).mockResolvedValue([{ id: "device-1" }]);
        (prisma.mediaItem.findMany as jest.Mock).mockResolvedValue([{ id: "media-1", durationMs: 10000 }]);
        (prisma.syncPreset.create as jest.Mock).mockResolvedValue({ id: "preset-1" });

        const request = new Request("http://localhost/api/sync/presets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "Video Wall A",
                mode: "COMMON",
                durationMs: 10000,
                presetMediaId: "media-1",
                devices: [{ deviceId: "device-1" }],
            }),
        });

        const response = await CREATE_PRESET(request);
        expect(response.status).toBe(201);
        expect(prisma.syncPreset.create).toHaveBeenCalled();
    });

    it("rejects preset creation when device is not owned by user", async () => {
        (prisma.device.findMany as jest.Mock).mockResolvedValue([]);

        const request = new Request("http://localhost/api/sync/presets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "Video Wall A",
                mode: "COMMON",
                durationMs: 10000,
                presetMediaId: "media-1",
                devices: [{ deviceId: "device-1" }],
            }),
        });

        const response = await CREATE_PRESET(request);
        expect(response.status).toBe(403);
    });

    it("updates a preset and rewrites assignments", async () => {
        (prisma.syncPreset.findFirst as jest.Mock)
            .mockResolvedValueOnce({
                id: "preset-1",
                userId: "user-1",
                mode: "COMMON",
                durationMs: 10000,
                presetMediaId: "media-1",
                name: "Old name",
                maxResolution: null,
                motionIntensity: null,
                hasText: false,
                devices: [{ deviceId: "device-1", mediaItemId: null }],
            })
            .mockResolvedValueOnce({ id: "preset-1", name: "New name" });

        (prisma.device.findMany as jest.Mock).mockResolvedValue([{ id: "device-1" }]);
        (prisma.mediaItem.findMany as jest.Mock).mockResolvedValue([{ id: "media-1", durationMs: 10000 }]);
        (prisma.$transaction as jest.Mock).mockImplementation(
            async (
                callback: (tx: {
                    syncPreset: {
                        update: jest.Mock;
                        findFirst: jest.Mock;
                    };
                    syncPresetDevice: {
                        deleteMany: jest.Mock;
                        createMany: jest.Mock;
                    };
                }) => Promise<unknown>
            ) =>
                callback({
                syncPreset: {
                    update: jest.fn().mockResolvedValue({}),
                    findFirst: jest.fn().mockResolvedValue({ id: "preset-1", name: "New name" }),
                },
                syncPresetDevice: {
                    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
                    createMany: jest.fn().mockResolvedValue({ count: 1 }),
                },
                })
        );

        const request = new Request("http://localhost/api/sync/presets/preset-1", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "New name",
                devices: [{ deviceId: "device-1" }],
            }),
        });

        const response = await UPDATE_PRESET(request, {
            params: Promise.resolve({ id: "preset-1" }),
        });
        expect(response.status).toBe(200);
    });

    it("deletes owned preset", async () => {
        (prisma.syncPreset.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

        const response = await DELETE_PRESET(new Request("http://localhost/api/sync/presets/preset-1"), {
            params: Promise.resolve({ id: "preset-1" }),
        });

        expect(response.status).toBe(200);
        expect(prisma.syncPreset.deleteMany).toHaveBeenCalledWith({
            where: {
                id: "preset-1",
                userId: "user-1",
            },
        });
    });

    it("gets a single owned preset", async () => {
        (prisma.syncPreset.findFirst as jest.Mock).mockResolvedValue({ id: "preset-1" });

        const response = await GET_PRESET(new Request("http://localhost/api/sync/presets/preset-1"), {
            params: Promise.resolve({ id: "preset-1" }),
        });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toMatchObject({ id: "preset-1" });
    });
});
