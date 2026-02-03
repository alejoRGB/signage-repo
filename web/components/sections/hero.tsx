
import Link from "next/link"
import { ArrowRight, MonitorCheck, LayoutTemplate, Cloud } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Hero() {
    return (
        <section className="relative overflow-hidden pt-32 pb-40 md:pt-48 md:pb-52">
            {/* Spotlight Effect */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-indigo-600/20 blur-[120px] rounded-full z-0 pointer-events-none animate-spotlight opacity-50 mix-blend-screen" />

            <div className="container mx-auto px-4 md:px-6 relative z-10">
                <div className="flex flex-col items-center text-center space-y-10">
                    <div className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-300 backdrop-blur-md">
                        <span className="flex h-2 w-2 rounded-full bg-indigo-400 mr-2 animate-pulse shadow-[0_0_10px_#818cf8]" />
                        Software de Cartelería Digital v2.0
                    </div>

                    <h1 className="text-5xl font-transparent tracking-tighter text-white sm:text-6xl md:text-7xl lg:text-8xl max-w-5xl mx-auto font-bold leading-[1.1]">
                        Cartelería digital simple para <br className="hidden sm:inline" />
                        <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent animate-gradient-x">
                            comercios y PYMEs
                        </span>
                    </h1>

                    <p className="max-w-[800px] text-lg text-slate-400 md:text-xl/relaxed leading-loose">
                        Actualizá el contenido de tus pantallas desde cualquier lugar, sin depender de técnicos ni configuraciones complejas.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-6 w-full justify-center pt-4">
                        <Button size="lg" variant="glow" className="h-14 px-10 text-lg rounded-full" asChild>
                            <Link href="#contact">
                                Empezar ahora <ArrowRight className="ml-2 h-5 w-5" />
                            </Link>
                        </Button>
                        <Button size="lg" variant="outline" className="h-14 px-10 text-lg rounded-full border-white/10 hover:bg-white/5 text-slate-300" asChild>
                            <Link href="#how-it-works">
                                Ver cómo funciona
                            </Link>
                        </Button>
                    </div>

                    <div className="pt-12 flex flex-wrap items-center justify-center gap-8 md:gap-16 text-slate-500 text-sm font-medium uppercase tracking-widest">
                        <div className="flex items-center gap-3">
                            <Cloud className="h-5 w-5 text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]" /> Gestión Remota
                        </div>
                        <div className="flex items-center gap-3">
                            <MonitorCheck className="h-5 w-5 text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]" /> Estado en vivo
                        </div>
                        <div className="flex items-center gap-3">
                            <LayoutTemplate className="h-5 w-5 text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]" /> Contenido dinámico
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
