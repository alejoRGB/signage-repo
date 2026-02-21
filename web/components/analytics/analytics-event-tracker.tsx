"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

function trackFromElement(element: HTMLElement) {
    const eventName = element.dataset.analyticsEvent;
    if (!eventName) {
        return;
    }

    const label = element.dataset.analyticsLabel ?? element.textContent?.trim() ?? "";
    const location = element.dataset.analyticsLocation ?? window.location.pathname;

    trackEvent(eventName, {
        label,
        location,
    });
}

function trackWhatsAppFallback(anchor: HTMLAnchorElement) {
    const href = anchor.getAttribute("href") ?? "";
    if (!href.includes("wa.me") && !href.includes("api.whatsapp.com")) {
        return;
    }

    trackEvent("click_whatsapp", {
        label: "whatsapp_link",
        location: window.location.pathname,
    });
}

export function AnalyticsEventTracker() {
    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            const target = event.target;
            if (!(target instanceof Element)) {
                return;
            }

            const trackedElement = target.closest<HTMLElement>("[data-analytics-event]");
            if (trackedElement) {
                trackFromElement(trackedElement);
                return;
            }

            const anchor = target.closest<HTMLAnchorElement>("a[href]");
            if (anchor) {
                trackWhatsAppFallback(anchor);
            }
        };

        document.addEventListener("click", handleClick, { passive: true });
        return () => {
            document.removeEventListener("click", handleClick);
        };
    }, []);

    return null;
}
