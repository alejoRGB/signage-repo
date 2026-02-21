import { Hero } from "@/components/sections/hero";
import { Features } from "@/components/sections/features";
import { Product } from "@/components/sections/product";
import { UseCases } from "@/components/sections/use-cases";
import { SocialProof } from "@/components/sections/social-proof";
import { About } from "@/components/sections/about";
import { Contact } from "@/components/sections/contact";
import type { Metadata } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://senaldigital.xyz").replace(/\/$/, "");

export const metadata: Metadata = {
    alternates: {
        canonical: "/",
    },
};

const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "Organization",
            name: "Expanded Signage",
            url: siteUrl,
            email: "contacto@expandedsignage.com",
            areaServed: ["CABA", "GBA", "Buenos Aires"],
            makesOffer: {
                "@type": "Offer",
                itemOffered: {
                    "@type": "Service",
                    name: "Carteleria Digital para Comercios y Pymes",
                },
            },
        },
        {
            "@type": "Service",
            serviceType: "Carteleria digital",
            provider: {
                "@type": "Organization",
                name: "Expanded Signage",
            },
            areaServed: ["CABA", "GBA"],
            audience: {
                "@type": "BusinessAudience",
                audienceType: "Pymes de retail y franquicias",
            },
        },
        {
            "@type": "FAQPage",
            mainEntity: [
                {
                    "@type": "Question",
                    name: "Para que tipo de negocio sirve?",
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: "Expanded Signage esta pensado para pymes de retail, franquicias y comercios que necesitan actualizar contenido en pantallas en minutos.",
                    },
                },
                {
                    "@type": "Question",
                    name: "Funciona en CABA y GBA?",
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: "Si. Brindamos implementacion y soporte para negocios de CABA y GBA.",
                    },
                },
                {
                    "@type": "Question",
                    name: "Puedo pedir una cotizacion personalizada?",
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: "Si. Podes solicitar una cotizacion indicando rubro, cantidad de pantallas y sucursales.",
                    },
                },
            ],
        },
    ],
};

export default function Home() {
    return (
        <div className="flex min-h-screen flex-col">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <Hero />
            <Features />
            <Product />
            <UseCases />
            <SocialProof />
            <About />
            <Contact />
        </div>
    );
}
