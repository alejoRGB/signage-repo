import { z } from "zod";

const BOOLEAN_TRUE_VALUES = new Set(["true", "1", "yes", "on"]);
const BOOLEAN_FALSE_VALUES = new Set(["false", "0", "no", "off"]);

function parseBooleanEnv(value: unknown) {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value !== "string") {
        return value;
    }

    const normalized = value.trim().toLowerCase();
    if (BOOLEAN_TRUE_VALUES.has(normalized)) {
        return true;
    }

    if (BOOLEAN_FALSE_VALUES.has(normalized)) {
        return false;
    }

    return value;
}

const syncEnvSchema = z.object({
    SYNC_VIDEOWALL_ENABLED: z.preprocess(parseBooleanEnv, z.boolean().default(false)),
});

const syncEnv = syncEnvSchema.parse(process.env);

export const isSyncVideowallEnabled = syncEnv.SYNC_VIDEOWALL_ENABLED;
