import type { Metadata } from "next";
import { IntentPage } from "@/components/marketing/intent-page";

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://senaldigital.xyz").replace(/\/$/, "");
const pagePath = "/carteleria-digital-buenos-aires";
const pageUrl = `${siteUrl}${pagePath}`;

const faqs = [
    {
        question: "Trabajan solo en CABA o tambien en GBA?",
        answer: "Operamos en CABA y GBA. Podemos ayudarte tanto con una sola sucursal como con multiples puntos de venta.",
    },
    {
        question: "La plataforma sirve para locales chicos?",
        answer: "Si. Expanded Signage esta pensado para pymes y comercios que buscan implementar carteleria digital sin complejidad tecnica.",
    },
    {
        question: "Cuanto tarda la implementacion?",
        answer: "Depende de la cantidad de pantallas, pero la puesta en marcha suele ser rapida. En la cotizacion te damos tiempos concretos.",
    },
];

const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "Service",
            name: "Carteleria digital en Buenos Aires",
            provider: { "@type": "Organization", name: "Expanded Signage", url: siteUrl },
            areaServed: ["Buenos Aires", "CABA", "GBA"],
            url: pageUrl,
            serviceType: "Carteleria digital para comercios y pymes",
            offers: {
                "@type": "Offer",
                url: `${siteUrl}/cotizacion-carteleria-digital`,
            },
        },
        {
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
                "@type": "Question",
                name: faq.question,
                acceptedAnswer: { "@type": "Answer", text: faq.answer },
            })),
        },
    ],
};

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
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
            />
        </>
    );
}
