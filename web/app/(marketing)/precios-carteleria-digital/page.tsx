import type { Metadata } from "next";
import { IntentPage } from "@/components/marketing/intent-page";
import { preciosIntentFaqs as faqs, buildFaqServiceJsonLd, serializeJsonLd } from "@/lib/marketing-jsonld";

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://senaldigital.xyz").replace(/\/$/, "");
const pagePath = "/precios-carteleria-digital";
const pageUrl = `${siteUrl}${pagePath}`;

export const metadata: Metadata = {
    title: "Precios de Carteleria Digital para Pymes",
    description: "Solicita precios de carteleria digital para comercios, retail y franquicias. Cotizacion personalizada para CABA y GBA.",
    keywords: [
        "carteleria digital precios",
        "precio carteleria digital argentina",
        "cotizacion carteleria digital",
        "software carteleria digital precio",
    ],
    alternates: { canonical: pagePath },
    openGraph: {
        title: "Precios de Carteleria Digital | Expanded Signage",
        description: "Cotizacion personalizada para pymes, retail y franquicias.",
        url: pageUrl,
        type: "website",
    },
};

export default function PreciosCarteleriaDigitalPage() {
    const jsonLd = buildFaqServiceJsonLd({
        serviceName: "Precios de carteleria digital",
        siteUrl,
        pageUrl,
        serviceType: "Cotizacion de carteleria digital para pymes y franquicias",
        faqs,
    });
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
            <IntentPage
                badge="Precios y cotizacion"
                title="Precios de carteleria digital para pymes y franquicias"
                description="Recibe una propuesta clara segun tus pantallas, sucursales y necesidades de operacion. Buscamos una implementacion simple y costo eficiente."
                highlights={[
                    "Cotizacion personalizada segun volumen y complejidad.",
                    "Propuesta orientada a facilidad de uso y retorno comercial.",
                    "Acompanamiento para implementar sin friccion.",
                ]}
                challengesTitle="Dudas frecuentes antes de invertir"
                challenges={[
                    "No saber cuanto cuesta realmente ponerlo en marcha.",
                    "Temor a pagar por funciones que no se van a usar.",
                    "Falta de claridad entre software, hardware y soporte.",
                ]}
                solutionTitle="Que recibes en la cotizacion"
                solutions={[
                    "Estimacion adaptada a tu cantidad de pantallas y locales.",
                    "Recomendacion de implementacion segun rubro.",
                    "Alcance transparente para tomar decision con confianza.",
                ]}
                faqTitle="Preguntas frecuentes sobre precios"
                faqs={faqs}
                relatedResourceSlugs={[
                    "costos-carteleria-digital-pymes",
                    "medir-roi-carteleria-digital",
                    "implementar-carteleria-digital-multiples-sucursales",
                ]}
            />
        </>
    );
}
