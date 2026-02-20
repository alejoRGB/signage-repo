import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SyncVideowallPanel } from "@/components/dashboard/sync-videowall-panel";
import { DIRECTIVE_TAB } from "@/lib/directive-tabs";

const showToast = vi.fn();

vi.mock("@/components/ui/toast-context", () => ({
    useToast: () => ({ showToast }),
}));

describe("Sync session controls", () => {
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
                        json: async () => [
                            {
                                id: "preset-1",
                                name: "Preset 1",
                                mode: "COMMON",
                                durationMs: 10000,
                                presetMediaId: "media-1",
                                devices: [{ deviceId: "device-1", mediaItemId: null }],
                            },
                        ],
                    } as Response;
                }
                if (url.includes("/api/sync/session/active")) {
                    return { ok: true, json: async () => ({ session: null }) } as Response;
                }

                return { ok: true, json: async () => ({}) } as Response;
            }) as unknown as typeof fetch
        );
    });

    it("hides start controls when active directive tab is not Sync", async () => {
        render(<SyncVideowallPanel activeDirectiveTab={DIRECTIVE_TAB.SCHEDULES} />);

        await screen.findByTestId("sync-entry-new-session-btn");
        expect(screen.getByTestId("sync-entry-saved-sessions-btn")).toBeInTheDocument();

        expect(screen.queryByTestId("sync-start-session-btn")).not.toBeInTheDocument();
        expect(screen.queryByTestId("sync-start-from-saved-btn")).not.toBeInTheDocument();
        expect(screen.queryByTestId("sync-health-panel")).not.toBeInTheDocument();
        expect(screen.queryByTestId("sync-stop-session-btn")).not.toBeInTheDocument();
        expect(screen.getByText(/Start bloqueado/i)).toBeInTheDocument();

        await waitFor(() => {
            const startCall = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
                ([url, init]) => url === "/api/sync/session/start" && init?.method === "POST"
            );
            expect(startCall).toBeFalsy();
        });
    });
});
