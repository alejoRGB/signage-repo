export function requireE2EBaseUrl(): string {
    const baseURL = process.env.E2E_BASE_URL?.trim();
    if (!baseURL) {
        throw new Error(
            "E2E_BASE_URL is required for qa_automation production/visual configs. " +
                "Set it explicitly (e.g. staging URL) to avoid running tests against production by mistake."
        );
    }
    return baseURL;
}

