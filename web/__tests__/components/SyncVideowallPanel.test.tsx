import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SyncVideowallPanel } from "@/components/dashboard/sync-videowall-panel";
import { DIRECTIVE_TAB } from "@/lib/directive-tabs";

const showToast = vi.fn();

vi.mock("@/components/ui/toast-context", () => ({
    useToast: () => ({ showToast }),
}));

describe("SyncVideowallPanel - presets", () => {
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
                        json: async () => [
                            { id: "media-1", name: "Promo A", type: "video", durationMs: 10000 },
                            { id: "media-2", name: "Promo B", type: "video", durationMs: 10000 },
                        ],
                    } as Response;
                }

                if (url.includes("/api/sync/presets") && !init?.method) {
                    return { ok: true, json: async () => [] } as Response;
                }

                if (url.includes("/api/sync/session/active")) {
                    return { ok: true, json: async () => ({ session: null }) } as Response;
                }

                if (url.includes("/api/sync/presets") && init?.method === "POST") {
                    const body = JSON.parse(String(init.body ?? "{}"));
                    return {
                        ok: true,
                        json: async () => ({ id: "preset-new", ...body }),
                    } as Response;
                }

                return {
                    ok: true,
                    json: async () => ({}),
                } as Response;
            }) as unknown as typeof fetch
        );
    });

    it("creates preset in COMMON mode with durationMs validation", async () => {
        render(<SyncVideowallPanel activeDirectiveTab={DIRECTIVE_TAB.SYNC_VIDEOWALL} />);

        await screen.findByText("Available Devices");

        fireEvent.click(screen.getByLabelText("Add Lobby to synchronized devices"));
        fireEvent.change(screen.getByTestId("sync-preset-name-input"), {
            target: { value: "Main Wall" },
        });
        fireEvent.change(screen.getByTestId("sync-common-media-select"), {
            target: { value: "media-1" },
        });

        fireEvent.click(screen.getByTestId("sync-save-preset-btn"));

        await waitFor(() => {
            const postCall = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
                ([url, init]) => url === "/api/sync/presets" && init?.method === "POST"
            );
            expect(postCall).toBeTruthy();
            const body = JSON.parse(String(postCall?.[1]?.body ?? "{}"));
            expect(body.mode).toBe("COMMON");
            expect(body.durationMs).toBe(10000);
            expect(body.devices).toEqual([{ deviceId: "device-1", mediaItemId: null }]);
        });
    });
});
