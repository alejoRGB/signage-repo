import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MediaManager from "@/app/dashboard/media/media-manager";

const refreshMock = vi.fn();
const showToastMock = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("@/components/ui/toast-context", () => ({
    useToast: () => ({ showToast: showToastMock }),
}));

vi.mock("@vercel/blob/client", () => ({
    upload: vi.fn(),
}));

vi.mock("@/components/media/add-website-modal", () => ({
    default: () => null,
}));

vi.mock("@/components/confirm-modal", () => ({
    default: ({
        isOpen,
        onConfirm,
        onClose,
        confirmText,
    }: {
        isOpen: boolean;
        onConfirm: () => void;
        onClose: () => void;
        confirmText?: string;
    }) =>
        isOpen ? (
            <div>
                <button onClick={onConfirm}>{confirmText ?? "Confirm"}</button>
                <button onClick={onClose}>Cancel</button>
            </div>
        ) : null,
}));

describe("MediaManager", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", vi.fn());
    });

    it("surfaces the backend delete error when media is in use", async () => {
        vi.mocked(globalThis.fetch).mockResolvedValue({
            ok: false,
            json: async () => ({
                code: "MEDIA_IN_USE",
                error: "Cannot delete media that is currently used in a playlist",
            }),
        } as Response);

        render(
            <MediaManager
                initialMedia={[
                    {
                        id: "media-1",
                        name: "Promo Loop",
                        type: "video",
                        url: "https://example.com/promo.mp4",
                        width: 1920,
                        height: 1080,
                        fps: 30,
                        createdAt: new Date("2026-02-24T12:00:00Z"),
                    },
                ]}
            />
        );

        fireEvent.click(screen.getByLabelText("Delete Promo Loop"));
        fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

        await waitFor(() => {
            expect(showToastMock).toHaveBeenCalledWith(
                "Cannot delete media that is currently used in a playlist",
                "error"
            );
        });
        expect(refreshMock).not.toHaveBeenCalled();
    });
});
