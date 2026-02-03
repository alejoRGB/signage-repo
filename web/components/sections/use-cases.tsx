
import { Utensils, ShoppingBag, Building2, Stethoscope } from "lucide-react"
import { GlassCard } from "@/components/ui/glass-card"

const useCases = [
    {
        icon: Utensils,
        title: "Gastronomía",
        description: "Actualizá el menú del día en todas tus sucursales con un clic. Programá ofertas de Happy Hour automáticas.",
    },
    {
        icon: ShoppingBag,
        title: "Retail",
        description: "Mostrá las ofertas de la semana y nuevos ingresos. Videos de producto en alta definición en la vidriera.",
    },
    {
        icon: Building2,
        title: "Corporativo",
        description: "Comunicación interna efectiva. Mostrá métricas de ventas en tiempo real y novedades de HR en el comedor.",
    },
    {
        icon: Stethoscope,
        title: "Salud",
        description: "Reducí la ansiedad en la sala de espera con contenido entretenido y llamá a los pacientes por su nombre.",
    },
]

export function UseCases() {
    return (
        <section id="uses" className="container mx-auto px-4 py-24 md:px-6 md:py-32">
            <div className="flex flex-col items-center justify-center gap-4 text-center mb-16">
                <h2 className="text-3xl font-bold tracking-tighter text-white sm:text-4xl">
                    Adaptable a tu industria
                </h2>
                <p className="max-w-[600px] text-slate-400 md:text-xl/relaxed">
                    Desde cafeterías hasta grandes oficinas, Expanded Signage se ajusta a tus necesidades.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {useCases.map((useCase, i) => (
                    <GlassCard key={i} className="group p-6 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] flex flex-col justify-between">
                        <div>
                            <div className="mb-4 inline-flex items-center justify-center rounded-full bg-indigo-500/10 p-3 text-indigo-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-colors">
                                <useCase.icon className="h-6 w-6" />
                            </div>
                            <h3 className="mb-2 text-xl font-bold text-white">{useCase.title}</h3>
                            <p className="text-sm text-slate-400 leading-relaxed">{useCase.description}</p>
                        </div>
                    </GlassCard>
                ))}
            </div>
        </section>
    )
}
