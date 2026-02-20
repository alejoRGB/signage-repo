import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncVideowallPanel } from "@/components/dashboard/sync-videowall-panel";
import { DIRECTIVE_TAB } from "@/lib/directive-tabs";

const showToast = vi.fn();

vi.mock("@/components/ui/toast-context", () => ({
    useToast: () => ({ showToast }),
}));

const mockDevices = [
    { id: "device-1", name: "Lobby", connectivityStatus: "online" },
    { id: "device-2", name: "Window", connectivityStatus: "offline" },
    { id: "device-3", name: "Hall", connectivityStatus: "online" },
];

const mockMedia = [
    { id: "media-1", name: "Promo A", type: "video", durationMs: 10000 },
    { id: "media-2", name: "Promo B", type: "video", durationMs: 10000 },
    { id: "media-3", name: "Promo C", type: "video", durationMs: 12000 },
];

function installFetchMock() {
    vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

            if (url.includes("/api/devices")) {
                return {
                    ok: true,
                    json: async () => mockDevices,
                } as Response;
            }

            if (url.includes("/api/media")) {
                return {
                    ok: true,
                    json: async () => mockMedia,
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
}

async function openNewSessionBuilder() {
    const newSessionButton = await screen.findByTestId("sync-entry-new-session-btn");
    fireEvent.click(newSessionButton);
    await screen.findByText("Available Devices");
}

describe("SyncVideowallPanel - wizard and presets", () => {
    beforeEach(() => {
        showToast.mockReset();
        vi.clearAllMocks();
        installFetchMock();
    });

    it("creates preset in COMMON mode with durationMs validation", async () => {
        render(<SyncVideowallPanel activeDirectiveTab={DIRECTIVE_TAB.SYNC_VIDEOWALL} />);

        await openNewSessionBuilder();

        fireEvent.click(screen.getByLabelText("Add Lobby to synchronized devices"));
        fireEvent.click(screen.getByLabelText("Add Window to synchronized devices"));
        fireEvent.click(screen.getByTestId("sync-step-next-btn"));
        fireEvent.change(screen.getByTestId("sync-common-media-select"), {
            target: { value: "media-1" },
        });
        fireEvent.click(screen.getByTestId("sync-step-next-btn"));
        fireEvent.change(screen.getByTestId("sync-preset-name-input"), {
            target: { value: "Main Wall" },
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
            expect(body.devices).toEqual([
                { deviceId: "device-1", mediaItemId: null },
                { deviceId: "device-2", mediaItemId: null },
            ]);
        });

        expect(screen.getByTestId("sync-saved-preset-preset-new")).toBeInTheDocument();
    });

    it("keeps wizard on Step 1 when fewer than 2 devices are selected", async () => {
        render(<SyncVideowallPanel activeDirectiveTab={DIRECTIVE_TAB.SYNC_VIDEOWALL} />);

        await openNewSessionBuilder();
        fireEvent.click(screen.getByLabelText("Add Lobby to synchronized devices"));
        fireEvent.click(screen.getByTestId("sync-step-next-btn"));

        expect(screen.getByTestId("sync-wizard-hint")).toHaveTextContent("Step 1");
        expect(showToast).toHaveBeenCalledWith("Select at least 2 devices to continue", "error");
    });

    it("disables mismatched-duration videos after selecting the first common video", async () => {
        render(<SyncVideowallPanel activeDirectiveTab={DIRECTIVE_TAB.SYNC_VIDEOWALL} />);

        await openNewSessionBuilder();
        fireEvent.click(screen.getByLabelText("Add Lobby to synchronized devices"));
        fireEvent.click(screen.getByLabelText("Add Hall to synchronized devices"));
        fireEvent.click(screen.getByTestId("sync-step-next-btn"));
        fireEvent.change(screen.getByTestId("sync-common-media-select"), { target: { value: "media-1" } });

        const mismatchedOption = screen.getByRole("option", { name: /Promo C.*different duration/i });
        expect(mismatchedOption).toBeDisabled();
    });

    it("allows assigning the same video to multiple devices in PER_DEVICE mode", async () => {
        render(<SyncVideowallPanel activeDirectiveTab={DIRECTIVE_TAB.SYNC_VIDEOWALL} />);

        await openNewSessionBuilder();
        fireEvent.click(screen.getByLabelText("Add Lobby to synchronized devices"));
        fireEvent.click(screen.getByLabelText("Add Hall to synchronized devices"));
        fireEvent.click(screen.getByTestId("sync-step-next-btn"));
        fireEvent.click(screen.getByRole("radio", { name: "Per device media" }));

        fireEvent.change(screen.getByTestId("sync-device-media-select-device-1"), {
            target: { value: "media-1" },
        });
        fireEvent.change(screen.getByTestId("sync-device-media-select-device-3"), {
            target: { value: "media-1" },
        });
        fireEvent.click(screen.getByTestId("sync-step-next-btn"));
        fireEvent.change(screen.getByTestId("sync-preset-name-input"), {
            target: { value: "Per Device Same Video" },
        });

        fireEvent.click(screen.getByTestId("sync-save-preset-btn"));

        await waitFor(() => {
            const postCall = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
                ([url, init]) => url === "/api/sync/presets" && init?.method === "POST"
            );
            expect(postCall).toBeTruthy();
            const body = JSON.parse(String(postCall?.[1]?.body ?? "{}"));
            expect(body.mode).toBe("PER_DEVICE");
            expect(body.devices).toEqual([
                { deviceId: "device-1", mediaItemId: "media-1" },
                { deviceId: "device-3", mediaItemId: "media-1" },
            ]);
        });
    });

    it("shows offline blocking message in Step 3 review", async () => {
        render(<SyncVideowallPanel activeDirectiveTab={DIRECTIVE_TAB.SYNC_VIDEOWALL} />);

        await openNewSessionBuilder();
        fireEvent.click(screen.getByLabelText("Add Lobby to synchronized devices"));
        fireEvent.click(screen.getByLabelText("Add Window to synchronized devices"));
        fireEvent.click(screen.getByTestId("sync-step-next-btn"));
        fireEvent.change(screen.getByTestId("sync-common-media-select"), {
            target: { value: "media-1" },
        });
        fireEvent.click(screen.getByTestId("sync-step-next-btn"));
        fireEvent.change(screen.getByTestId("sync-preset-name-input"), {
            target: { value: "Offline Blocked Preset" },
        });
        fireEvent.click(screen.getByTestId("sync-save-preset-btn"));

        await waitFor(() => {
            expect(screen.getByTestId("sync-saved-preset-preset-new")).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText(/offline and will block start/i)).toBeInTheDocument();
            const reviewStartBtn = screen.getByTestId("sync-start-from-saved-btn") as HTMLButtonElement;
            expect(reviewStartBtn.disabled).toBe(true);
        });
    });

    it("shows entry menu with new and saved session options when no session is active", async () => {
        render(<SyncVideowallPanel activeDirectiveTab={DIRECTIVE_TAB.SYNC_VIDEOWALL} />);

        expect(await screen.findByTestId("sync-entry-new-session-btn")).toBeInTheDocument();
        expect(screen.getByTestId("sync-entry-saved-sessions-btn")).toBeInTheDocument();
        expect(screen.queryByText("Available Devices")).not.toBeInTheDocument();
    });
});
