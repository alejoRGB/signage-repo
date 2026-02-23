import { test, expect, Page } from "@playwright/test";
import { execSync } from "node:child_process";

const normalizeEnv = (value?: string) => value?.trim();
const USERNAME = normalizeEnv(process.env.E2E_USERNAME);
const USER_PASSWORD = normalizeEnv(process.env.E2E_PASSWORD);
const FAILOVER_RUN = normalizeEnv(process.env.E2E_SYNC_FAILOVER_RUN);

const START_TIMEOUT_MS = 90_000;
const FAILOVER_TIMEOUT_MS = 70_000;
const POLL_INTERVAL_MS = 2_000;
const MASTER_DOWN_GRACE_MS = 12_000;
const STABILIZATION_MS = 10_000;

type ActiveSessionDevice = {
    deviceId: string;
    status: string;
    lanMode?: string | null;
    lanBeaconAgeMs?: number | null;
    device: {
        id: string;
        name?: string | null;
        status?: string | null;
    };
};

type ActiveSessionPayload = {
    session?: {
        id: string;
        status: string;
        masterDeviceId?: string | null;
        devices: ActiveSessionDevice[];
    } | null;
};

function envFlagEnabled(value?: string) {
    if (!value) return false;
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function toCmdKey(deviceName: string) {
    return deviceName.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function runLocalCommand(command: string) {
    return execSync(command, { encoding: "utf8", shell: true });
}

async function loginAsUser(page: Page, username: string, password: string) {
    await page.goto("/login");
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
}

async function fetchActiveSession(page: Page): Promise<ActiveSessionPayload> {
    const response = await page.request.get("/api/sync/session/active");
    expect(response.ok()).toBeTruthy();
    return (await response.json()) as ActiveSessionPayload;
}

async function stopSessionIfActive(page: Page) {
    const active = await fetchActiveSession(page);
    const activeSession = active.session;
    if (!activeSession?.id) {
        return;
    }

    const response = await page.request.post("/api/sync/session/stop", {
        data: {
            sessionId: activeSession.id,
            reason: "USER_STOP",
        },
    });
    expect(response.ok()).toBeTruthy();
}

async function pickPresetForSync(page: Page) {
    const response = await page.request.get("/api/sync/presets");
    expect(response.ok()).toBeTruthy();
    const presets = (await response.json()) as Array<{
        id: string;
        name: string;
        mode: string;
        devices?: Array<{ device?: { status?: string | null } }>;
    }>;

    const valid = presets.find((preset) => {
        const devices = Array.isArray(preset.devices) ? preset.devices : [];
        return devices.length >= 2;
    });

    return valid ?? null;
}

async function startSyncSession(page: Page, presetId: string) {
    const response = await page.request.post("/api/sync/session/start", {
        data: { presetId },
    });
    expect(response.ok()).toBeTruthy();

    const payload = (await response.json()) as { session?: { id?: string } };
    expect(payload.session?.id).toBeTruthy();
    return payload.session!.id!;
}

async function waitForCondition<T>(
    producer: () => Promise<T>,
    predicate: (value: T) => boolean,
    timeoutMs: number
) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        const value = await producer();
        if (predicate(value)) {
            return value;
        }
        await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(`Condition not met within ${timeoutMs}ms`);
}

test.describe("Phase 4: Sync LAN failover QA (chaos)", () => {
    test.describe.configure({ mode: "serial" });
    test.skip(!USERNAME || !USER_PASSWORD, "Skipping LAN failover test: set E2E_USERNAME and E2E_PASSWORD");

    test(
        "[SYNC-E2E-05] LAN failover re-elects master and keeps session recoverable",
        async ({ page }) => {
            test.skip(
                !envFlagEnabled(FAILOVER_RUN),
                "Skipping LAN failover chaos test: set E2E_SYNC_FAILOVER_RUN=true"
            );

            let startedSessionId: string | null = null;
            let startMasterCmd: string | null = null;

            try {
                await loginAsUser(page, USERNAME!, USER_PASSWORD!);

                await stopSessionIfActive(page);
                await sleep(1500);

                const preset = await pickPresetForSync(page);
                test.skip(!preset, "No sync preset with at least 2 devices available");

                startedSessionId = await startSyncSession(page, preset!.id);

                const startedSession = await waitForCondition(
                    () => fetchActiveSession(page),
                    (payload) => {
                        const session = payload.session;
                        return !!session && session.id === startedSessionId && !!session.masterDeviceId;
                    },
                    START_TIMEOUT_MS
                );

                const session = startedSession.session!;
                const initialMasterId = session.masterDeviceId!;
                const initialMasterDevice = session.devices.find((device) => device.deviceId === initialMasterId);
                expect(initialMasterDevice).toBeTruthy();

                const initialMasterName = initialMasterDevice?.device?.name?.trim();
                test.skip(!initialMasterName, "Master device name is missing in active session payload");

                const masterCmdKey = toCmdKey(initialMasterName!);
                const stopMasterCmd = normalizeEnv(process.env[`E2E_SYNC_STOP_CMD_${masterCmdKey}`]);
                startMasterCmd = normalizeEnv(process.env[`E2E_SYNC_START_CMD_${masterCmdKey}`]) ?? null;

                test.skip(
                    !stopMasterCmd || !startMasterCmd,
                    `Missing stop/start commands for master ${initialMasterName}. Set E2E_SYNC_STOP_CMD_${masterCmdKey} and E2E_SYNC_START_CMD_${masterCmdKey}`
                );

                runLocalCommand(stopMasterCmd!);
                await sleep(MASTER_DOWN_GRACE_MS);

                const afterFailover = await waitForCondition(
                    () => fetchActiveSession(page),
                    (payload) => {
                        const active = payload.session;
                        if (!active || active.id !== startedSessionId) return false;
                        return !!active.masterDeviceId && active.masterDeviceId !== initialMasterId;
                    },
                    FAILOVER_TIMEOUT_MS
                );

                const failedOverSession = afterFailover.session!;
                expect(failedOverSession.masterDeviceId).not.toBe(initialMasterId);

                await sleep(STABILIZATION_MS);

                const stabilized = await fetchActiveSession(page);
                const stabilizedSession = stabilized.session;
                expect(stabilizedSession?.id).toBe(startedSessionId);
                expect(stabilizedSession?.masterDeviceId).toBeTruthy();

                const lanModes = (stabilizedSession?.devices ?? [])
                    .map((device) => device.lanMode)
                    .filter((mode): mode is string => typeof mode === "string" && mode.length > 0);

                expect(lanModes.length).toBeGreaterThan(0);
            } finally {
                if (startMasterCmd) {
                    try {
                        runLocalCommand(startMasterCmd);
                    } catch {
                        // Best-effort restore; session stop below still runs.
                    }
                }

                if (startedSessionId) {
                    try {
                        await page.request.post("/api/sync/session/stop", {
                            data: {
                                sessionId: startedSessionId,
                                reason: "USER_STOP",
                            },
                        });
                    } catch {
                        // Best-effort cleanup to avoid masking primary assertion failure.
                    }
                }
            }
        }
    );
});

