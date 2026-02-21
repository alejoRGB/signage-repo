export type AnalyticsParams = Record<string, string | number | boolean>;

type GtagCommand = "config" | "event" | "js";

type GtagFn = (
    command: GtagCommand,
    targetIdOrEventName: string | Date,
    params?: AnalyticsParams & { page_path?: string; send_page_view?: boolean }
) => void;

declare global {
    interface Window {
        gtag?: GtagFn;
    }
}

export function trackEvent(eventName: string, params?: AnalyticsParams) {
    if (typeof window === "undefined" || typeof window.gtag !== "function") {
        return;
    }

    window.gtag("event", eventName, params);
}
