import { Utensils, ShoppingBag, Store, Megaphone } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

const useCases = [
    {
        icon: Utensils,
        title: "Gastronomia",
        description: "Actualiza menu del dia y promos por horario en una o varias sucursales sin cambios manuales.",
    },
    {
        icon: ShoppingBag,
        title: "Retail",
        description: "Publica ofertas semanales, lanzamientos y piezas de vidriera en minutos para aumentar conversion.",
    },
    {
        icon: Store,
        title: "Franquicias",
        description: "Mantiene consistencia de marca y promociones en todos los locales con gestion centralizada.",
    },
    {
        icon: Megaphone,
        title: "Campanas locales",
        description: "Adapta contenido por barrio, zona o sucursal para comunicar mejor en CABA y GBA.",
    },
];

export function UseCases() {
    return (
        <section id="uses" className="container mx-auto px-4 py-24 md:px-6 md:py-32">
            <div className="mb-16 flex flex-col items-center justify-center gap-4 text-center">
                <h2 className="text-3xl font-bold tracking-tighter text-white sm:text-4xl">
                    Casos de uso para negocios que necesitan escalar
                </h2>
                <p className="max-w-[700px] text-slate-400 md:text-xl/relaxed">
                    Desde un local independiente hasta redes de sucursales, Expanded Signage se adapta a la operacion
                    comercial de pymes en CABA y GBA.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {useCases.map((useCase) => (
                    <GlassCard key={useCase.title} className="group flex flex-col justify-between p-6 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]">
                        <div>
                            <div className="mb-4 inline-flex items-center justify-center rounded-full bg-indigo-500/10 p-3 text-indigo-400 transition-colors group-hover:bg-indigo-500/20 group-hover:text-indigo-300">
                                <useCase.icon className="h-6 w-6" />
                            </div>
                            <h3 className="mb-2 text-xl font-bold text-white">{useCase.title}</h3>
                            <p className="text-sm leading-relaxed text-slate-400">{useCase.description}</p>
                        </div>
                    </GlassCard>
                ))}
            </div>
        </section>
    );
}
