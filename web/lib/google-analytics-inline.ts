export function buildGoogleAnalyticsInitInlineScript(measurementId: string) {
  return `
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    window.gtag = gtag;
                    gtag('js', new Date());
                    gtag('config', '${measurementId}', { send_page_view: false });
                `;
}

