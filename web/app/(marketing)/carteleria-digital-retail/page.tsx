import type { Metadata } from "next";
import { IntentPage } from "@/components/marketing/intent-page";

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://senaldigital.xyz").replace(/\/$/, "");
const pagePath = "/carteleria-digital-retail";
const pageUrl = `${siteUrl}${pagePath}`;

const faqs = [
    {
        question: "Puedo cambiar precios y promociones en el dia?",
        answer: "Si. Puedes actualizar contenido en minutos y programar cambios por franja horaria o fecha.",
    },
    {
        question: "Funciona para vidriera y tambien dentro del local?",
        answer: "Si. Puedes gestionar pantallas de vidriera, cajas y sectores internos desde el mismo panel.",
    },
    {
        question: "Que necesito para arrancar?",
        answer: "Con una pantalla compatible y conectividad basica puedes empezar. Te guiamos en la implementacion.",
    },
];

const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "Service",
            name: "Carteleria digital para retail",
            provider: { "@type": "Organization", name: "Expanded Signage", url: siteUrl },
            areaServed: ["CABA", "GBA", "Buenos Aires"],
            url: pageUrl,
            serviceType: "Carteleria digital para tiendas y comercios minoristas",
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
    title: "Carteleria Digital para Retail",
    description: "Mejora la comunicacion en tienda con carteleria digital para retail. Actualiza precios y promociones en tiempo real.",
    keywords: [
        "carteleria digital retail",
        "pantallas para tiendas",
        "promociones en pantallas",
        "software carteleria digital retail",
    ],
    alternates: { canonical: pagePath },
    openGraph: {
        title: "Carteleria Digital para Retail | Expanded Signage",
        description: "Aumenta conversion en tienda con contenido actualizado en pantallas.",
        url: pageUrl,
        type: "website",
    },
};

export default function CarteleriaDigitalRetailPage() {
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <IntentPage
                badge="Retail"
                title="Carteleria digital para retail orientada a ventas"
                description="Transforma tus pantallas en una herramienta comercial activa para promociones, lanzamientos y recomendaciones en punto de venta."
                highlights={[
                    "Actualiza precios y promociones sin imprimir carteleria fisica.",
                    "Adapta mensajes por horario, categoria o stock.",
                    "Muestra contenido atractivo en vidrieras y zonas de alto trafico.",
                ]}
                challengesTitle="Frenos comerciales en tienda"
                challenges={[
                    "Promociones vencidas visibles al cliente.",
                    "Tiempo operativo alto para cambiar piezas en sucursal.",
                    "Dificultad para medir consistencia de ejecucion.",
                ]}
                solutionTitle="Resultados esperados"
                solutions={[
                    "Mayor velocidad de reaccion ante cambios comerciales.",
                    "Uniformidad de mensajes en todos los puntos de contacto.",
                    "Mejor experiencia visual para impulsar decision de compra.",
                ]}
                faqTitle="Preguntas frecuentes de carteleria digital para retail"
                faqs={faqs}
                relatedResourceSlugs={[
                    "estrategia-contenido-pantallas-retail",
                    "costos-carteleria-digital-pymes",
                    "medir-roi-carteleria-digital",
                ]}
            />
        </>
    );
}
