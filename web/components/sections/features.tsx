
import { LayoutDashboard, Wifi, Image as ImageIcon, Globe, Lock, Clock } from "lucide-react"
import { GlassCard } from "@/components/ui/glass-card"

const features = [
    {
        icon: Globe,
        title: "Gestión Remota",
        description: "Cambiá el contenido de todas tus pantallas sin estar físicamente en el local. Ideal para franquicias.",
    },
    {
        icon: LayoutDashboard,
        title: "Simple de usar",
        description: "Panel de control diseñado para personas no técnicas. Subí, arrastrá y soltá.",
    },
    {
        icon: Clock,
        title: "Programación Horaria",
        description: "Mostrá menú de desayuno a la mañana y promociones de happy hour a la tarde automáticamente.",
    },
    {
        icon: Wifi,
        title: "Funciona sin internet",
        description: "Si se corta la conexión, tus pantallas siguen vendiendo. El contenido se guarda localmente.",
    },
    {
        icon: ImageIcon,
        title: "Tu marca se ve bien",
        description: "Soporte para imágenes HD y videos fluidos. Mantené la estética profesional de tu negocio.",
    },
    {
        icon: Lock,
        title: "Seguridad total",
        description: "Nadie puede cambiar tu contenido sin permiso. Conexión encriptada y segura.",
    },
]

export function Features() {
    return (
        <section id="features" className="container mx-auto px-4 py-24 md:px-6 md:py-32">
            <div className="mx-auto grid max-w-5xl gap-12">
                <div className="flex flex-col items-center justify-center gap-4 text-center">
                    <div className="inline-block rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 text-sm text-indigo-300">
                        Características
                    </div>
                    <h2 className="text-3xl font-bold tracking-tighter text-white sm:text-4xl md:text-5xl">
                        Todo lo que necesitas para tu cartelería
                    </h2>
                    <p className="max-w-[800px] text-slate-400 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                        Una plataforma robusta diseñada para operar 24/7 sin interrupciones ni pantallas azules.
                    </p>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {features.map((feature, i) => (
                        <GlassCard key={i} className="flex flex-col items-start gap-4 p-6 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]">
                            <div className="rounded-lg bg-indigo-500/10 p-3 text-indigo-400">
                                <feature.icon className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold text-white">{feature.title}</h3>
                            <p className="text-slate-400 leading-relaxed">{feature.description}</p>
                        </GlassCard>
                    ))}
                </div>
            </div>
        </section>
    )
}
