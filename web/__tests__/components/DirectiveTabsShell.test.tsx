import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DirectiveTabsShell } from "@/components/dashboard/directive-tabs-shell";
import { DIRECTIVE_TAB } from "@/lib/directive-tabs";

vi.mock("@/components/ui/toast-context", () => ({
    useToast: () => ({
        showToast: vi.fn(),
    }),
}));

describe("DirectiveTabsShell", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal(
            "fetch",
            vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
                const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

                if (url.includes("/api/devices")) {
                    return {
                        ok: true,
                        json: async () => [{ id: "device-1", name: "Lobby Screen", connectivityStatus: "online" }],
                    } as Response;
                }

                if (url.includes("/api/media")) {
                    return {
                        ok: true,
                        json: async () => [{ id: "media-1", name: "Promo A", type: "video", duration: 30 }],
                    } as Response;
                }

                if (url.includes("/api/dashboard/directive-tab") && init?.method === "PATCH") {
                    return {
                        ok: true,
                        json: async () => ({ activeDirectiveTab: "SYNC_VIDEOWALL" }),
                    } as Response;
                }

                return {
                    ok: true,
                    json: async () => ({}),
                } as Response;
            }) as unknown as typeof fetch
        );
    });

    it("renders schedules content when SCHEDULES is active", () => {
        render(
            <DirectiveTabsShell
                initialActiveDirectiveTab={DIRECTIVE_TAB.SCHEDULES}
                isSyncVideowallEnabled={true}
            >
                <div>Existing Dashboard Content</div>
            </DirectiveTabsShell>
        );

        expect(screen.getByText("Existing Dashboard Content")).toBeInTheDocument();
        expect(screen.queryByTestId("directive-sync-videowall-panel")).not.toBeInTheDocument();
    });

    it("renders Sync checkbox as active when SYNC_VIDEOWALL is active", () => {
        render(
            <DirectiveTabsShell
                initialActiveDirectiveTab={DIRECTIVE_TAB.SYNC_VIDEOWALL}
                isSyncVideowallEnabled={true}
            >
                <div>Existing Dashboard Content</div>
            </DirectiveTabsShell>
        );

        // Active directive checkbox and visible panel are decoupled.
        // Initial visible panel remains Schedules unless the user clicks the Sync tab.
        expect(screen.getByText("Existing Dashboard Content")).toBeInTheDocument();
        expect(
            (screen.getByTestId("directive-checkbox-SYNC_VIDEOWALL") as HTMLInputElement).checked
        ).toBe(true);
    });

    it("switches visible panel when clicking tab title", async () => {
        render(
            <DirectiveTabsShell
                initialActiveDirectiveTab={DIRECTIVE_TAB.SCHEDULES}
                isSyncVideowallEnabled={true}
            >
                <div>Existing Dashboard Content</div>
            </DirectiveTabsShell>
        );

        fireEvent.click(screen.getByText("Sync"));

        expect(await screen.findByTestId("directive-sync-videowall-panel")).toBeInTheDocument();
        expect(screen.getByTestId("sync-entry-new-session-btn")).toBeInTheDocument();
    });

    it("checkbox click updates active directive only and keeps current visible tab", async () => {
        render(
            <DirectiveTabsShell
                initialActiveDirectiveTab={DIRECTIVE_TAB.SCHEDULES}
                isSyncVideowallEnabled={true}
            >
                <div>Existing Dashboard Content</div>
            </DirectiveTabsShell>
        );

        const schedulesCheckbox = screen.getByTestId("directive-checkbox-SCHEDULES") as HTMLInputElement;
        const syncCheckbox = screen.getByTestId("directive-checkbox-SYNC_VIDEOWALL") as HTMLInputElement;

        expect(schedulesCheckbox.checked).toBe(true);
        expect(syncCheckbox.checked).toBe(false);

        fireEvent.click(syncCheckbox);

        await waitFor(() => {
            expect(globalThis.fetch).toHaveBeenCalledWith("/api/dashboard/directive-tab", expect.any(Object));
        });

        expect(schedulesCheckbox.checked).toBe(false);
        expect(syncCheckbox.checked).toBe(true);
        expect(screen.getByTestId("directive-schedules-panel")).toBeInTheDocument();
    });

    it("keeps checkbox selection when navigating between tabs", async () => {
        render(
            <DirectiveTabsShell
                initialActiveDirectiveTab={DIRECTIVE_TAB.SYNC_VIDEOWALL}
                isSyncVideowallEnabled={true}
            >
                <div>Existing Dashboard Content</div>
            </DirectiveTabsShell>
        );

        const syncCheckbox = screen.getByTestId("directive-checkbox-SYNC_VIDEOWALL") as HTMLInputElement;
        expect(syncCheckbox.checked).toBe(true);

        fireEvent.click(screen.getByTestId("directive-tab-SYNC_VIDEOWALL"));
        expect(await screen.findByTestId("directive-sync-videowall-panel")).toBeInTheDocument();
        expect(syncCheckbox.checked).toBe(true);
    });

    it("hides Sync tab and falls back to Schedules when feature flag is disabled", () => {
        render(
            <DirectiveTabsShell
                initialActiveDirectiveTab={DIRECTIVE_TAB.SYNC_VIDEOWALL}
                isSyncVideowallEnabled={false}
            >
                <div>Existing Dashboard Content</div>
            </DirectiveTabsShell>
        );

        expect(screen.getByTestId("directive-schedules-panel")).toBeInTheDocument();
        expect(screen.queryByTestId("directive-tab-SYNC_VIDEOWALL")).not.toBeInTheDocument();
        expect(screen.queryByTestId("directive-checkbox-SYNC_VIDEOWALL")).not.toBeInTheDocument();
    });
});
