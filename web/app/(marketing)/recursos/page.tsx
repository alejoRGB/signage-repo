import type { Metadata } from "next";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { seoResources } from "@/lib/seo-resources";

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://senaldigital.xyz").replace(/\/$/, "");

export const metadata: Metadata = {
    title: "Recursos de Carteleria Digital para Pymes",
    description: "Guias practicas para mejorar implementacion, costos y resultados de carteleria digital en retail y franquicias de CABA y GBA.",
    alternates: {
        canonical: "/recursos",
    },
    openGraph: {
        title: "Recursos de Carteleria Digital | Expanded Signage",
        description: "Contenido practico para pymes de retail y franquicias.",
        url: `${siteUrl}/recursos`,
        type: "website",
    },
};

export default function RecursosPage() {
    return (
        <section className="container mx-auto px-4 py-20 md:px-6 md:py-28">
            <div className="mx-auto max-w-4xl space-y-6 text-center">
                <p className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-300">
                    Recursos
                </p>
                <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                    Guias para escalar carteleria digital en CABA y GBA
                </h1>
                <p className="text-lg text-slate-300">
                    Contenido pensado para pymes de retail y franquicias que buscan mejorar ejecucion comercial, reducir
                    friccion operativa y tomar mejores decisiones de inversion.
                </p>
            </div>

            <div className="mx-auto mt-12 grid max-w-5xl gap-6">
                {seoResources.map((resource) => (
                    <GlassCard key={resource.slug} className="p-6 md:p-7">
                        <p className="text-xs font-semibold tracking-wider text-indigo-300 uppercase">{resource.category}</p>
                        <h2 className="mt-2 text-2xl font-bold text-white">{resource.title}</h2>
                        <p className="mt-3 text-slate-300">{resource.description}</p>
                        <div className="mt-5 flex items-center justify-between gap-3">
                            <span className="text-xs text-slate-400">Lectura: {resource.readTime}</span>
                            <Link
                                href={`/recursos/${resource.slug}`}
                                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                                data-analytics-event="click_recurso"
                                data-analytics-label={`recurso_${resource.slug}`}
                                data-analytics-location="recursos_hub"
                            >
                                Leer guia
                            </Link>
                        </div>
                    </GlassCard>
                ))}
            </div>
        </section>
    );
}
