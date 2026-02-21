import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./providers";
import { ToastProvider } from "@/components/ui/toast-context";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { AnalyticsEventTracker } from "@/components/analytics/analytics-event-tracker";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

function resolveSiteUrl() {
  const fallback = "https://senaldigital.xyz";
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? fallback;

  try {
    return new URL(raw);
  } catch {
    return new URL(fallback);
  }
}

const siteUrl = resolveSiteUrl();
const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "Expanded Signage",
    template: "%s | Expanded Signage",
  },
  description: "Plataforma de carteleria digital para comercios y pymes.",
  verification: googleSiteVerification
    ? {
      google: googleSiteVerification,
    }
    : undefined,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
        {gaMeasurementId ? (
          <>
            <GoogleAnalytics measurementId={gaMeasurementId} />
            <AnalyticsEventTracker />
          </>
        ) : null}
      </body>
    </html>
  );
}
