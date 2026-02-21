import Link from "next/link";
import { ArrowRight, MonitorCheck, LayoutTemplate, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
    return (
        <section className="relative overflow-hidden pt-32 pb-40 md:pt-48 md:pb-52">
            <div className="pointer-events-none absolute top-0 left-1/2 z-0 h-[500px] w-[1000px] -translate-x-1/2 rounded-full bg-indigo-600/20 opacity-50 blur-[120px] mix-blend-screen animate-spotlight" />

            <div className="container relative z-10 mx-auto px-4 md:px-6">
                <div className="flex flex-col items-center space-y-10 text-center">
                    <div className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-300 backdrop-blur-md">
                        <span className="mr-2 flex h-2 w-2 rounded-full bg-indigo-400 shadow-[0_0_10px_#818cf8] animate-pulse" />
                        Solucion integral de carteleria digital
                    </div>

                    <h1 className="mx-auto max-w-5xl text-5xl leading-[1.1] font-bold tracking-tighter text-white sm:text-6xl md:text-7xl lg:text-8xl">
                        Carteleria digital simple para <br className="hidden sm:inline" />
                        <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent animate-gradient-x">
                            comercios y pymes
                        </span>
                    </h1>

                    <p className="max-w-[800px] text-lg leading-loose text-slate-400 md:text-xl/relaxed">
                        Actualiza tus pantallas desde cualquier lugar. Implementacion para retail y franquicias en
                        CABA y GBA, sin depender de tecnicos ni configuraciones complejas.
                    </p>

                    <div className="flex w-full flex-col justify-center gap-6 pt-4 sm:flex-row">
                        <Button size="lg" variant="glow" className="h-14 rounded-full px-10 text-lg" asChild>
                            <Link
                                href="/cotizacion-carteleria-digital"
                                data-analytics-event="click_cta_principal"
                                data-analytics-label="hero_solicitar_cotizacion"
                                data-analytics-location="hero"
                            >
                                Solicitar cotizacion <ArrowRight className="ml-2 h-5 w-5" />
                            </Link>
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className="h-14 rounded-full border-white/10 px-10 text-lg text-slate-300 hover:bg-white/5"
                            asChild
                        >
                            <Link
                                href="#how-it-works"
                                data-analytics-event="click_cta_secundario"
                                data-analytics-label="hero_ver_como_funciona"
                                data-analytics-location="hero"
                            >
                                Ver como funciona
                            </Link>
                        </Button>
                    </div>

                    <div className="pt-12 text-sm font-medium tracking-widest text-slate-500 uppercase flex flex-wrap items-center justify-center gap-8 md:gap-16">
                        <div className="flex items-center gap-3">
                            <Cloud className="h-5 w-5 text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]" />
                            Gestion remota
                        </div>
                        <div className="flex items-center gap-3">
                            <MonitorCheck className="h-5 w-5 text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]" />
                            Estado en vivo
                        </div>
                        <div className="flex items-center gap-3">
                            <LayoutTemplate className="h-5 w-5 text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]" />
                            Contenido dinamico
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
