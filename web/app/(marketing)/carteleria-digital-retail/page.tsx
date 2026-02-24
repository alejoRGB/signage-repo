import type { Metadata } from "next";
import { IntentPage } from "@/components/marketing/intent-page";
import { retailIntentFaqs as faqs, buildFaqServiceJsonLd, serializeJsonLd } from "@/lib/marketing-jsonld";

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://senaldigital.xyz").replace(/\/$/, "");
const pagePath = "/carteleria-digital-retail";
const pageUrl = `${siteUrl}${pagePath}`;

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
    const jsonLd = buildFaqServiceJsonLd({
        serviceName: "Carteleria digital para retail",
        siteUrl,
        pageUrl,
        serviceType: "Carteleria digital para tiendas y comercios minoristas",
        faqs,
    });
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
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
