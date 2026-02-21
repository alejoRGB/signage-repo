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
    });

    it("keeps wizard on Step 1 when fewer than 2 devices are selected", async () => {
        render(<SyncVideowallPanel activeDirectiveTab={DIRECTIVE_TAB.SYNC_VIDEOWALL} />);

        await openNewSessionBuilder();
        fireEvent.click(screen.getByLabelText("Add Lobby to synchronized devices"));
        fireEvent.click(screen.getByTestId("sync-step-next-btn"));

        expect(screen.getByTestId("sync-wizard-hint")).toHaveTextContent("Step 1");
        expect(showToast).toHaveBeenCalledWith("Select at least 2 devices to continue", "error");
    });

    it("keeps mixed-duration videos enabled in COMMON mode", async () => {
        render(<SyncVideowallPanel activeDirectiveTab={DIRECTIVE_TAB.SYNC_VIDEOWALL} />);

        await openNewSessionBuilder();
        fireEvent.click(screen.getByLabelText("Add Lobby to synchronized devices"));
        fireEvent.click(screen.getByLabelText("Add Hall to synchronized devices"));
        fireEvent.click(screen.getByTestId("sync-step-next-btn"));
        fireEvent.change(screen.getByTestId("sync-common-media-select"), { target: { value: "media-1" } });

        const commonSelect = screen.getByTestId("sync-common-media-select") as HTMLSelectElement;
        const differentDurationOption = [...commonSelect.options].find((option) => option.value === "media-3");
        expect(differentDurationOption).toBeDefined();
        expect(differentDurationOption?.disabled).toBe(false);
    });

    it("enables common media option when video has duration (seconds) but no durationMs", async () => {
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
                        json: async () => [
                            { id: "media-legacy", name: "Legacy Clip", type: "video", duration: 11, durationMs: null },
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

                return {
                    ok: true,
                    json: async () => ({}),
                } as Response;
            }) as unknown as typeof fetch
        );

        render(<SyncVideowallPanel activeDirectiveTab={DIRECTIVE_TAB.SYNC_VIDEOWALL} />);

        await openNewSessionBuilder();
        fireEvent.click(screen.getByLabelText("Add Lobby to synchronized devices"));
        fireEvent.click(screen.getByLabelText("Add Hall to synchronized devices"));
        fireEvent.click(screen.getByTestId("sync-step-next-btn"));

        const commonSelect = screen.getByTestId("sync-common-media-select") as HTMLSelectElement;
        const legacyOption = [...commonSelect.options].find((option) => option.value === "media-legacy");
        expect(legacyOption).toBeDefined();
        expect(legacyOption?.disabled).toBe(false);
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
            const postCall = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
                ([url, init]) => url === "/api/sync/presets" && init?.method === "POST"
            );
            expect(postCall).toBeTruthy();
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

    it("opens saved sessions in a separate view from entry menu", async () => {
        render(<SyncVideowallPanel activeDirectiveTab={DIRECTIVE_TAB.SYNC_VIDEOWALL} />);

        fireEvent.click(await screen.findByTestId("sync-entry-saved-sessions-btn"));

        expect(await screen.findByText("Sesiones guardadas")).toBeInTheDocument();
        expect(screen.queryByText("Available Devices")).not.toBeInTheDocument();
    });

    it("does not flash entry menu when an active session exists", async () => {
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
                    await new Promise((resolve) => setTimeout(resolve, 50));
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
                                        id: "session-device-1",
                                        deviceId: "device-1",
                                        status: "PLAYING",
                                        device: {
                                            id: "device-1",
                                            name: "Lobby",
                                        },
                                    },
                                ],
                            },
                            correctionTelemetryByDeviceId: {},
                        }),
                    } as Response;
                }

                return { ok: true, json: async () => ({}) } as Response;
            }) as unknown as typeof fetch
        );

        render(<SyncVideowallPanel activeDirectiveTab={DIRECTIVE_TAB.SYNC_VIDEOWALL} />);

        expect(screen.getByTestId("sync-initial-loading")).toBeInTheDocument();
        expect(screen.queryByTestId("sync-entry-new-session-btn")).not.toBeInTheDocument();

        expect(await screen.findByTestId("sync-health-panel")).toBeInTheDocument();
        expect(screen.queryByTestId("sync-entry-new-session-btn")).not.toBeInTheDocument();
    });

    it("keeps entry menu visible after stop even if active-session poll returns stale data", async () => {
        let activeSessionCalls = 0;
        let staleResponseResolved = false;

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
                    activeSessionCalls += 1;
                    if (activeSessionCalls === 2) {
                        await new Promise((resolve) => setTimeout(resolve, 80));
                        staleResponseResolved = true;
                    }
                    if (activeSessionCalls <= 2) {
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
                                            id: "session-device-1",
                                            deviceId: "device-1",
                                            status: "PLAYING",
                                            device: {
                                                id: "device-1",
                                                name: "Lobby",
                                            },
                                        },
                                    ],
                                },
                                correctionTelemetryByDeviceId: {},
                            }),
                        } as Response;
                    }
                    return { ok: true, json: async () => ({ session: null }) } as Response;
                }

                if (url.includes("/api/sync/session/stop")) {
                    return {
                        ok: true,
                        json: async () => ({
                            session: {
                                id: "session-1",
                            },
                        }),
                    } as Response;
                }

                return { ok: true, json: async () => ({}) } as Response;
            }) as unknown as typeof fetch
        );

        render(<SyncVideowallPanel activeDirectiveTab={DIRECTIVE_TAB.SYNC_VIDEOWALL} />);
        await screen.findByTestId("sync-health-panel");

        fireEvent.click(screen.getByTestId("sync-stop-session-btn"));
        await screen.findByTestId("sync-entry-new-session-btn");

        await waitFor(() => {
            expect(staleResponseResolved).toBe(true);
        });
        expect(screen.queryByTestId("sync-health-panel")).not.toBeInTheDocument();
    });

    it("keeps session health cards in stable order", async () => {
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
                                        id: "session-device-2",
                                        deviceId: "device-2",
                                        status: "PLAYING",
                                        device: {
                                            id: "device-2",
                                            name: "Window",
                                        },
                                    },
                                    {
                                        id: "session-device-1",
                                        deviceId: "device-1",
                                        status: "PLAYING",
                                        device: {
                                            id: "device-1",
                                            name: "Lobby",
                                        },
                                    },
                                ],
                            },
                            correctionTelemetryByDeviceId: {},
                        }),
                    } as Response;
                }

                return { ok: true, json: async () => ({}) } as Response;
            }) as unknown as typeof fetch
        );

        render(<SyncVideowallPanel activeDirectiveTab={DIRECTIVE_TAB.SYNC_VIDEOWALL} />);
        await screen.findByTestId("sync-health-panel");

        const cards = screen.getAllByTestId(/sync-device-health-/);
        expect(cards).toHaveLength(2);
        expect(cards[0]).toHaveTextContent("Lobby");
        expect(cards[1]).toHaveTextContent("Window");
    });

    it("starts new session from clean state even when saved presets exist", async () => {
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
                    return {
                        ok: true,
                        json: async () => [
                            {
                                id: "preset-existing",
                                name: "Preset Existing",
                                mode: "COMMON",
                                durationMs: 10000,
                                presetMediaId: "media-1",
                                devices: [
                                    { deviceId: "device-1", mediaItemId: null },
                                    { deviceId: "device-2", mediaItemId: null },
                                ],
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

        render(<SyncVideowallPanel activeDirectiveTab={DIRECTIVE_TAB.SYNC_VIDEOWALL} />);

        fireEvent.click(await screen.findByTestId("sync-entry-new-session-btn"));
        expect(await screen.findByText("Available Devices")).toBeInTheDocument();
        expect(screen.getByText(/Drag devices here to build your synchronized wall/i)).toBeInTheDocument();
        expect(screen.queryByTestId("sync-preset-name-input")).not.toBeInTheDocument();
    });
});
