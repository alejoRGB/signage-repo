import type { Metadata } from "next";
import { IntentPage } from "@/components/marketing/intent-page";
import { menuRestaurantesIntentFaqs as faqs, buildFaqServiceJsonLd, serializeJsonLd } from "@/lib/marketing-jsonld";

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://senaldigital.xyz").replace(/\/$/, "");
const pagePath = "/menu-digital-para-restaurantes";
const pageUrl = `${siteUrl}${pagePath}`;

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
    const jsonLd = buildFaqServiceJsonLd({
        serviceName: "Menu digital para restaurantes",
        siteUrl,
        pageUrl,
        serviceType: "Pantallas de menu digital para gastronomia",
        faqs,
    });
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
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
                relatedResourceSlugs={[
                    "estrategia-contenido-pantallas-retail",
                    "costos-carteleria-digital-pymes",
                    "medir-roi-carteleria-digital",
                ]}
            />
        </>
    );
}
