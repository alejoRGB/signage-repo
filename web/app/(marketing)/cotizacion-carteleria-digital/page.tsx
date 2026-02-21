import type { Metadata } from "next";
import { GlassCard } from "@/components/ui/glass-card";
import { ContactForm } from "@/components/marketing/contact-form";

export const metadata: Metadata = {
    title: "Solicitar Cotizacion de Carteleria Digital",
    description: "Pedi una cotizacion de carteleria digital para tu comercio, cadena o franquicia en CABA y GBA.",
    alternates: {
        canonical: "/cotizacion-carteleria-digital",
    },
};

export default function QuotePage() {
    return (
        <section className="container mx-auto px-4 py-24 md:px-6 md:py-32">
            <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:gap-16">
                <div className="space-y-6">
                    <p className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-300">
                        Cotizacion personalizada
                    </p>
                    <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                        Solicita tu cotizacion de carteleria digital
                    </h1>
                    <p className="text-lg text-slate-300">
                        Completando este formulario te enviamos una propuesta para tu negocio en CABA o GBA.
                        Evaluamos rubro, cantidad de pantallas y sucursales para recomendarte la mejor opcion.
                    </p>
                    <ul className="space-y-3 text-sm text-slate-400">
                        <li>Respuesta comercial en 24 horas habiles.</li>
                        <li>Propuesta adaptada a retail y franquicias.</li>
                        <li>Implementacion simple con soporte continuo.</li>
                    </ul>
                </div>
                <GlassCard className="p-6 md:p-8">
                    <ContactForm />
                </GlassCard>
            </div>
        </section>
    );
}
