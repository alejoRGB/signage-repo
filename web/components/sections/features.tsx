import { LayoutDashboard, Wifi, Image as ImageIcon, Globe, Lock, Clock } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

const features = [
    {
        icon: Globe,
        title: "Gestion remota",
        description: "Cambia el contenido de todas tus pantallas sin moverte del local central. Ideal para sucursales en CABA y GBA.",
    },
    {
        icon: LayoutDashboard,
        title: "Facil de usar",
        description: "Panel pensado para equipos no tecnicos. Sube, organiza y publica contenido en pocos pasos.",
    },
    {
        icon: Clock,
        title: "Programacion horaria",
        description: "Automatiza contenido por franja: desayuno, promociones de tarde o mensajes de cierre.",
    },
    {
        icon: Wifi,
        title: "Continuidad operativa",
        description: "Si hay cortes de conexion, las pantallas siguen mostrando contenido para no perder ventas.",
    },
    {
        icon: ImageIcon,
        title: "Calidad visual",
        description: "Soporte para imagenes y videos en alta calidad para mantener una presentacion profesional.",
    },
    {
        icon: Lock,
        title: "Control y seguridad",
        description: "Gestiona permisos y evita cambios no autorizados en el contenido de tus pantallas.",
    },
];

export function Features() {
    return (
        <section id="features" className="container mx-auto px-4 py-24 md:px-6 md:py-32">
            <div className="mx-auto grid max-w-5xl gap-12">
                <div className="flex flex-col items-center justify-center gap-4 text-center">
                    <div className="inline-block rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-sm text-indigo-300">
                        Caracteristicas
                    </div>
                    <h2 className="text-3xl font-bold tracking-tighter text-white sm:text-4xl md:text-5xl">
                        Plataforma de carteleria digital para pymes de CABA y GBA
                    </h2>
                    <p className="max-w-[800px] text-slate-400 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                        Una solucion integral para retail y franquicias que necesitan operar rapido, con costo razonable
                        y sin complejidad tecnica.
                    </p>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {features.map((feature) => (
                        <GlassCard key={feature.title} className="flex flex-col items-start gap-4 p-6 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]">
                            <div className="rounded-lg bg-indigo-500/10 p-3 text-indigo-400">
                                <feature.icon className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold text-white">{feature.title}</h3>
                            <p className="leading-relaxed text-slate-400">{feature.description}</p>
                        </GlassCard>
                    ))}
                </div>
            </div>
        </section>
    );
}
