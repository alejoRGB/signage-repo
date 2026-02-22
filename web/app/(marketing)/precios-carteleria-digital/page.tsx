import type { Metadata } from "next";
import { IntentPage } from "@/components/marketing/intent-page";

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://senaldigital.xyz").replace(/\/$/, "");
const pagePath = "/precios-carteleria-digital";
const pageUrl = `${siteUrl}${pagePath}`;

const faqs = [
    {
        question: "Como se define el precio de carteleria digital?",
        answer: "Depende de cantidad de pantallas, sucursales, tipo de contenido y necesidades de soporte. Cotizamos segun tu escenario real.",
    },
    {
        question: "Hay planes para pymes?",
        answer: "Si. Tenemos propuestas para comercios pequenos y para operaciones que escalan a varias sucursales.",
    },
    {
        question: "La cotizacion incluye implementacion?",
        answer: "Podemos incluir implementacion, configuracion inicial y acompanamiento segun el alcance que necesites.",
    },
];

const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "Service",
            name: "Precios de carteleria digital",
            provider: { "@type": "Organization", name: "Expanded Signage", url: siteUrl },
            areaServed: ["CABA", "GBA", "Buenos Aires"],
            url: pageUrl,
            serviceType: "Cotizacion de carteleria digital para pymes y franquicias",
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
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
