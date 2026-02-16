import { z } from 'zod';

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

const envSchema = z.object({
    DATABASE_URL: z.string().url(),
    DATABASE_URL_UNPOOLED: z.string().url().optional(),
    NEXT_PUBLIC_API_URL: z.string().url().optional(),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    NEXTAUTH_SECRET: z.string().min(1).optional(),
    NEXTAUTH_URL: z.string().url().optional(),
    SYNC_VIDEOWALL_ENABLED: z.preprocess(parseBooleanEnv, z.boolean().default(false)),
});

export const env = envSchema.parse(process.env);

export const isSyncVideowallEnabled = env.SYNC_VIDEOWALL_ENABLED;
