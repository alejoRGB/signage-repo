import type { Metadata } from "next";
import { IntentPage } from "@/components/marketing/intent-page";
import { franquiciasIntentFaqs as faqs, buildFaqServiceJsonLd, serializeJsonLd } from "@/lib/marketing-jsonld";

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://senaldigital.xyz").replace(/\/$/, "");
const pagePath = "/carteleria-digital-franquicias";
const pageUrl = `${siteUrl}${pagePath}`;

export const metadata: Metadata = {
    title: "Carteleria Digital para Franquicias",
    description: "Gestiona contenido en multiples sucursales con carteleria digital centralizada. Ideal para franquicias en CABA y GBA.",
    keywords: [
        "carteleria digital para franquicias",
        "software carteleria digital franquicias",
        "pantallas para franquicias",
        "gestion remota de pantallas",
    ],
    alternates: { canonical: pagePath },
    openGraph: {
        title: "Carteleria Digital para Franquicias | Expanded Signage",
        description: "Centraliza campanas y contenido en todas tus sucursales.",
        url: pageUrl,
        type: "website",
    },
};

export default function CarteleriaDigitalFranquiciasPage() {
    const jsonLd = buildFaqServiceJsonLd({
        serviceName: "Carteleria digital para franquicias",
        siteUrl,
        pageUrl,
        serviceType: "Software y operacion de carteleria digital para franquicias",
        faqs,
    });
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
            <IntentPage
                badge="Franquicias"
                title="Carteleria digital para franquicias con control centralizado"
                description="Coordina promociones, lanzamientos y campanas en todas tus sucursales desde un solo panel. Mantiene consistencia de marca y velocidad operativa."
                highlights={[
                    "Control por sucursal, zona y tipo de pantalla.",
                    "Programacion de campanas por fecha y horario.",
                    "Escalabilidad para abrir nuevas sucursales sin friccion.",
                ]}
                challengesTitle="Desafios comunes en franquicias"
                challenges={[
                    "Cada local publica contenidos diferentes sin control central.",
                    "Cambios lentos para campanas nacionales.",
                    "Inconsistencias de marca entre sucursales.",
                ]}
                solutionTitle="Como optimizar tu operacion"
                solutions={[
                    "Plantillas y lineamientos unificados por marca.",
                    "Publicacion remota para todas las sucursales en un clic.",
                    "Monitoreo de estado para reducir pantallas fuera de servicio.",
                ]}
                faqTitle="FAQ para carteleria digital en franquicias"
                faqs={faqs}
                relatedResourceSlugs={[
                    "errores-carteleria-digital-franquicias",
                    "implementar-carteleria-digital-multiples-sucursales",
                    "medir-roi-carteleria-digital",
                ]}
            />
        </>
    );
}
