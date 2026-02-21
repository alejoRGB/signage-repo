import type { Metadata } from "next";
import { IntentPage } from "@/components/marketing/intent-page";

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://senaldigital.xyz").replace(/\/$/, "");
const pagePath = "/menu-digital-para-restaurantes";
const pageUrl = `${siteUrl}${pagePath}`;

const faqs = [
    {
        question: "Se pueden programar menus por horario?",
        answer: "Si. Puedes definir desayuno, almuerzo, merienda y cena con cambios automaticos por franja horaria.",
    },
    {
        question: "Puedo actualizar precios o combos rapido?",
        answer: "Si. El panel permite editar y publicar cambios en minutos para una o varias sucursales.",
    },
    {
        question: "Sirve para cadenas gastronomicas?",
        answer: "Si. Es ideal para centralizar menus y promociones en multiples locales.",
    },
];

const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "Service",
            name: "Menu digital para restaurantes",
            provider: { "@type": "Organization", name: "Expanded Signage", url: siteUrl },
            areaServed: ["CABA", "GBA", "Buenos Aires"],
            url: pageUrl,
            serviceType: "Pantallas de menu digital para gastronomia",
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
    title: "Menu Digital para Restaurantes",
    description: "Implementa menu digital en pantallas para restaurantes y cafeterias. Cambia precios y promociones por horario en CABA y GBA.",
    keywords: [
        "menu digital para restaurantes",
        "pantallas menu digital",
        "menu digital gastronomia",
        "carteleria digital restaurantes",
    ],
    alternates: { canonical: pagePath },
    openGraph: {
        title: "Menu Digital para Restaurantes | Expanded Signage",
        description: "Optimiza menu boards con cambios automaticos por horario y sucursal.",
        url: pageUrl,
        type: "website",
    },
};

export default function MenuDigitalParaRestaurantesPage() {
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <IntentPage
                badge="Gastronomia"
                title="Menu digital para restaurantes y cafeterias"
                description="Gestiona tus menu boards desde la nube y adapta tu oferta por horario, stock o promociones del dia en cada sucursal."
                highlights={[
                    "Cambios instantaneos de precios, platos y combos.",
                    "Programacion automatica por franjas horarias.",
                    "Control centralizado para una o multiples sucursales.",
                ]}
                challengesTitle="Problemas habituales en menu boards"
                challenges={[
                    "Menus desactualizados con precios viejos.",
                    "Demora en aplicar cambios en hora pico.",
                    "Inconsistencias entre sucursales de la misma marca.",
                ]}
                solutionTitle="Beneficios para operaciones y ventas"
                solutions={[
                    "Menos errores operativos en mostrador.",
                    "Mayor velocidad para activar promociones temporales.",
                    "Mejor experiencia visual para el cliente final.",
                ]}
                faqTitle="FAQ sobre menu digital para restaurantes"
                faqs={faqs}
            />
        </>
    );
}
