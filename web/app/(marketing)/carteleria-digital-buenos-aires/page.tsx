import type { Metadata } from "next";
import { IntentPage } from "@/components/marketing/intent-page";
import { buenosAiresIntentFaqs as faqs, buildFaqServiceJsonLd, serializeJsonLd } from "@/lib/marketing-jsonld";

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://senaldigital.xyz").replace(/\/$/, "");
const pagePath = "/carteleria-digital-buenos-aires";
const pageUrl = `${siteUrl}${pagePath}`;

export const metadata: Metadata = {
    title: "Carteleria Digital en Buenos Aires (CABA y GBA)",
    description: "Solucion integral de carteleria digital para comercios y pymes en CABA y GBA. Gestion remota, implementacion simple y cotizacion personalizada.",
    keywords: [
        "carteleria digital buenos aires",
        "carteleria digital caba",
        "carteleria digital gba",
        "pantallas para negocios buenos aires",
        "software carteleria digital argentina",
    ],
    alternates: { canonical: pagePath },
    openGraph: {
        title: "Carteleria Digital en Buenos Aires | Expanded Signage",
        description: "Implementacion de carteleria digital para comercios de CABA y GBA.",
        url: pageUrl,
        type: "website",
    },
};

export default function CarteleriaDigitalBuenosAiresPage() {
    const jsonLd = buildFaqServiceJsonLd({
        serviceName: "Carteleria digital en Buenos Aires",
        siteUrl,
        pageUrl,
        serviceType: "Carteleria digital para comercios y pymes",
        faqs,
        areaServed: ["Buenos Aires", "CABA", "GBA"],
        offersUrl: `${siteUrl}/cotizacion-carteleria-digital`,
    });
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
            <IntentPage
                badge="CABA y GBA"
                title="Carteleria digital en Buenos Aires para comercios y pymes"
                description="Centraliza la gestion de pantallas en uno o varios locales. Actualiza promociones, precios y comunicaciones en minutos, sin depender de tecnicos."
                highlights={[
                    "Gestion remota de contenidos desde una sola plataforma.",
                    "Operacion preparada para sucursales en CABA y GBA.",
                    "Propuesta integral con enfoque comercial y soporte continuo.",
                ]}
                challengesTitle="Problemas frecuentes en comercios"
                challenges={[
                    "Cambios manuales de piezas en cada local.",
                    "Promociones desactualizadas por falta de tiempo.",
                    "Comunicacion inconsistente entre sucursales.",
                ]}
                solutionTitle="Como lo resolvemos"
                solutions={[
                    "Programacion por horarios, sucursales y pantallas.",
                    "Actualizacion centralizada en segundos.",
                    "Panel simple de usar para equipos no tecnicos.",
                ]}
                faqTitle="Preguntas frecuentes sobre carteleria digital en Buenos Aires"
                faqs={faqs}
                relatedResourceSlugs={[
                    "costos-carteleria-digital-pymes",
                    "implementar-carteleria-digital-multiples-sucursales",
                    "medir-roi-carteleria-digital",
                ]}
            />
        </>
    );
}
