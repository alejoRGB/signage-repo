import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SyncVideowallPanel } from "@/components/dashboard/sync-videowall-panel";
import { DIRECTIVE_TAB } from "@/lib/directive-tabs";

const showToast = vi.fn();

vi.mock("@/components/ui/toast-context", () => ({
    useToast: () => ({ showToast }),
}));

describe("Sync health panel", () => {
    beforeEach(() => {
        showToast.mockReset();
        vi.clearAllMocks();
        vi.stubGlobal(
            "fetch",
            vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
                const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

                if (url.includes("/api/devices")) {
                    return {
                        ok: true,
                        json: async () => [{ id: "device-1", name: "Lobby", connectivityStatus: "online" }],
                    } as Response;
                }
                if (url.includes("/api/media")) {
                    return {
                        ok: true,
                        json: async () => [{ id: "media-1", name: "Promo", type: "video", durationMs: 10000 }],
                    } as Response;
                }
                if (url.includes("/api/sync/presets") && !init?.method) {
                    return {
                        ok: true,
                        json: async () => [],
                    } as Response;
                }
                if (url.includes("/api/sync/session/active")) {
                    return {
                        ok: true,
                        json: async () => ({
                            session: {
                                id: "session-1",
                                status: "RUNNING",
                                presetId: "preset-1",
                                masterDeviceId: "device-1",
                                devices: [
                                    {
                                        id: "ssd-1",
                                        deviceId: "device-1",
                                        status: "PLAYING",
                                        lastSeenAt: new Date().toISOString(),
                                        avgDriftMs: 12.3,
                                        maxDriftMs: 35.8,
                                        clockOffsetMs: 4.2,
                                        healthScore: 0.95,
                                        resyncCount: 2,
                                        resyncRate: 0.1,
                                        device: {
                                            id: "device-1",
                                            name: "Lobby",
                                            status: "online",
                                        },
                                    },
                                ],
                            },
                        }),
                    } as Response;
                }

                return { ok: true, json: async () => ({}) } as Response;
            }) as unknown as typeof fetch
        );
    });

    it("renders live health metrics from active session", async () => {
        render(<SyncVideowallPanel activeDirectiveTab={DIRECTIVE_TAB.SYNC_VIDEOWALL} />);

        expect(await screen.findByTestId("sync-health-panel")).toBeInTheDocument();
        expect(await screen.findByText("drift avg: 12.3ms")).toBeInTheDocument();
        expect(screen.getByText("drift max: 35.8ms")).toBeInTheDocument();
        expect(screen.getByText("clock offset: 4.2ms")).toBeInTheDocument();
        expect(screen.getByText("health: 0.95")).toBeInTheDocument();
        expect(screen.getByText(/last heartbeat:/i)).toBeInTheDocument();
    });
});
