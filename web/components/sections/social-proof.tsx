import Link from "next/link";
import { Building2, Store, Utensils, CheckCircle2 } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

const testimonials = [
    {
        icon: Store,
        title: "Retail multi-sucursal",
        quote: "Pasamos de actualizar contenidos local por local a hacerlo en minutos desde un solo panel.",
        author: "Operacion comercial, cadena de tiendas en CABA",
    },
    {
        icon: Building2,
        title: "Franquicias",
        quote: "Ahora mantenemos la misma promo en toda la red y evitamos diferencias entre sucursales.",
        author: "Marketing, franquicia en GBA",
    },
    {
        icon: Utensils,
        title: "Gastronomia",
        quote: "Ajustamos menus y precios por horario sin depender de impresiones ni cambios manuales.",
        author: "Encargado de locales, grupo gastronomico",
    },
];

const trustItems = [
    "Implementacion guiada para equipos no tecnicos.",
    "Costo previsible para pymes y marcas en crecimiento.",
    "Soporte continuo para operar sin friccion.",
];

export function SocialProof() {
    return (
        <section className="container mx-auto px-4 py-20 md:px-6 md:py-28">
            <div className="mx-auto max-w-5xl space-y-6 text-center">
                <p className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-300">
                    Senales de confianza
                </p>
                <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    Equipos de CABA y GBA ya operan sus pantallas de forma centralizada
                </h2>
                <p className="mx-auto max-w-3xl text-slate-300">
                    Disenado para pymes de retail y franquicias que necesitan velocidad operativa, consistencia de
                    marca y una plataforma simple para actualizar contenido.
                </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
                {testimonials.map((item) => (
                    <GlassCard key={item.title} className="p-6">
                        <div className="mb-4 inline-flex rounded-lg bg-indigo-500/10 p-3 text-indigo-400">
                            <item.icon className="h-5 w-5" />
                        </div>
                        <h3 className="mb-3 text-lg font-semibold text-white">{item.title}</h3>
                        <p className="mb-4 text-sm leading-relaxed text-slate-300">&quot;{item.quote}&quot;</p>
                        <p className="text-xs uppercase tracking-wide text-slate-400">{item.author}</p>
                    </GlassCard>
                ))}
            </div>

            <GlassCard className="mt-8 p-6 md:p-8">
                <div className="grid gap-6 md:grid-cols-[1.3fr_1fr] md:items-center">
                    <div className="space-y-3">
                        <h3 className="text-2xl font-bold text-white">Por que eligen Expanded Signage</h3>
                        <ul className="space-y-2">
                            {trustItems.map((item) => (
                                <li key={item} className="flex items-start gap-3 text-slate-300">
                                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-indigo-400" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="md:justify-self-end">
                        <div className="flex flex-wrap gap-3">
                            <Link
                                href="/cotizacion-carteleria-digital"
                                className="inline-flex rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
                                data-analytics-event="click_cta_principal"
                                data-analytics-label="social_proof_solicitar_cotizacion"
                                data-analytics-location="social_proof"
                            >
                                Solicitar cotizacion
                            </Link>
                            <Link
                                href="/recursos"
                                className="inline-flex rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                                data-analytics-event="click_recurso"
                                data-analytics-label="social_proof_ver_recursos"
                                data-analytics-location="social_proof"
                            >
                                Ver recursos
                            </Link>
                        </div>
                    </div>
                </div>
            </GlassCard>
        </section>
    );
}
