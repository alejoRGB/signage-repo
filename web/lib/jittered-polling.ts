export function startJitteredPolling(
    callback: () => void | Promise<void>,
    baseIntervalMs: number,
    options?: {
        jitterRatio?: number;
        initialJitterOnly?: boolean;
    }
) {
    const jitterRatio = Math.min(0.5, Math.max(0, options?.jitterRatio ?? 0.15));
    const initialJitterOnly = options?.initialJitterOnly ?? false;
    let disposed = false;
    let timeoutId: number | null = null;

    const nextDelay = () => {
        if (jitterRatio <= 0) {
            return baseIntervalMs;
        }
        const amplitude = Math.round(baseIntervalMs * jitterRatio);
        const delta = Math.round((Math.random() * 2 - 1) * amplitude);
        return Math.max(100, baseIntervalMs + delta);
    };

    const tick = async () => {
        if (disposed) return;
        try {
            await callback();
        } finally {
            if (!disposed) {
                const delay = initialJitterOnly ? baseIntervalMs : nextDelay();
                timeoutId = window.setTimeout(() => void tick(), delay);
            }
        }
    };

    timeoutId = window.setTimeout(() => void tick(), nextDelay());

    return () => {
        disposed = true;
        if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
        }
    };
}
