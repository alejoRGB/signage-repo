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
            vi.fn(async () => ({
                ok: true,
                json: async () => ({ activeDirectiveTab: "SYNC_VIDEOWALL" }),
            })) as unknown as typeof fetch
        );
    });

    it("renders schedules content when SCHEDULES is active", () => {
        render(
            <DirectiveTabsShell initialActiveDirectiveTab={DIRECTIVE_TAB.SCHEDULES}>
                <div>Existing Dashboard Content</div>
            </DirectiveTabsShell>
        );

        expect(screen.getByText("Existing Dashboard Content")).toBeInTheDocument();
        expect(screen.queryByTestId("directive-sync-empty-panel")).not.toBeInTheDocument();
    });

    it("renders empty Sync/VideoWall panel when SYNC_VIDEOWALL is active", () => {
        render(
            <DirectiveTabsShell initialActiveDirectiveTab={DIRECTIVE_TAB.SYNC_VIDEOWALL}>
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

    it("switches visible panel when clicking tab title", () => {
        render(
            <DirectiveTabsShell initialActiveDirectiveTab={DIRECTIVE_TAB.SCHEDULES}>
                <div>Existing Dashboard Content</div>
            </DirectiveTabsShell>
        );

        fireEvent.click(screen.getByText("Sync/VideoWall"));

        expect(screen.getByTestId("directive-sync-empty-panel")).toBeInTheDocument();
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("checkbox click updates active directive only and keeps current visible tab", async () => {
        render(
            <DirectiveTabsShell initialActiveDirectiveTab={DIRECTIVE_TAB.SCHEDULES}>
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

    it("keeps checkbox selection when navigating between tabs", () => {
        render(
            <DirectiveTabsShell initialActiveDirectiveTab={DIRECTIVE_TAB.SYNC_VIDEOWALL}>
                <div>Existing Dashboard Content</div>
            </DirectiveTabsShell>
        );

        const syncCheckbox = screen.getByTestId("directive-checkbox-SYNC_VIDEOWALL") as HTMLInputElement;
        expect(syncCheckbox.checked).toBe(true);

        fireEvent.click(screen.getByTestId("directive-tab-SYNC_VIDEOWALL"));
        expect(screen.getByTestId("directive-sync-empty-panel")).toBeInTheDocument();
        expect(syncCheckbox.checked).toBe(true);
    });
});
