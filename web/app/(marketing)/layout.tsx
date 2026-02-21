import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import type { Metadata } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://senaldigital.xyz").replace(/\/$/, "");

export const metadata: Metadata = {
    title: "Carteleria Digital para Comercios y Pymes",
    description: "Controla tus pantallas de forma remota. Solucion integral de carteleria digital para retail y franquicias en CABA y GBA.",
    keywords: [
        "carteleria digital",
        "carteleria digital buenos aires",
        "carteleria digital caba",
        "carteleria digital gba",
        "pantallas para negocios",
        "software carteleria digital",
        "carteleria digital para franquicias",
        "carteleria digital para retail",
    ],
    alternates: {
        canonical: "/",
    },
    openGraph: {
        title: "Expanded Signage | Carteleria Digital para Comercios y Pymes",
        description: "Solucion integral de carteleria digital para retail y franquicias en CABA y GBA.",
        url: siteUrl,
        siteName: "Expanded Signage",
        locale: "es_AR",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Expanded Signage | Carteleria Digital",
        description: "Carteleria digital simple para comercios y pymes.",
    },
    robots: {
        index: true,
        follow: true,
    },
};

export default function MarketingLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="marketing-theme flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">
                {children}
            </main>
            <Footer />
        </div>
    );
}
