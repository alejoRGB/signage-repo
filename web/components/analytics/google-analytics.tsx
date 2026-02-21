"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";

type GoogleAnalyticsProps = {
    measurementId: string;
};

export function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (typeof window.gtag !== "function") {
            return;
        }

        const queryString = searchParams.toString();
        const pagePath = queryString ? `${pathname}?${queryString}` : pathname;

        window.gtag("config", measurementId, {
            page_path: pagePath,
        });
    }, [measurementId, pathname, searchParams]);

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
                strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    window.gtag = gtag;
                    gtag('js', new Date());
                    gtag('config', '${measurementId}', { send_page_view: false });
                `}
            </Script>
        </>
    );
}
