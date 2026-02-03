
import { Box, Play, Upload } from "lucide-react"

export function Product() {
    return (
        <section id="how-it-works" className="w-full py-24 md:py-32 border-y border-white/5 bg-white/[0.02]">
            <div className="container mx-auto px-4 md:px-6">
                <div className="flex flex-col items-center justify-center gap-4 text-center mb-16">
                    <h2 className="text-3xl font-bold tracking-tighter text-white sm:text-4xl text-glow">
                        ¿Cómo funciona?
                    </h2>
                    <p className="max-w-[600px] text-slate-400 md:text-xl/relaxed">
                        Tres pasos simples para digitalizar tu comunicación.
                    </p>
                </div>

                <div className="grid gap-12 md:gap-8 lg:grid-cols-3">
                    <div className="relative flex flex-col items-center text-center space-y-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 border-2 border-white/10 text-slate-400 text-2xl font-bold z-10 backdrop-blur-sm">
                            1
                        </div>
                        {/* Connector Line (Desktop) */}
                        <div className="hidden lg:block absolute top-8 left-[60%] w-[80%] h-[2px] bg-white/5 z-0" />

                        <h3 className="text-xl font-bold text-white mt-4">Conectá</h3>
                        <p className="text-slate-400 max-w-xs">
                            Vinculá el reproductor a tu TV por HDMI y conectalo a internet. Listo para usar.
                        </p>
                    </div>

                    <div className="relative flex flex-col items-center text-center space-y-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 border-2 border-white/10 text-slate-400 text-2xl font-bold z-10 backdrop-blur-sm">
                            2
                        </div>
                        {/* Connector Line (Desktop) */}
                        <div className="hidden lg:block absolute top-8 left-[60%] w-[80%] h-[2px] bg-white/5 z-0" />

                        <h3 className="text-xl font-bold text-white mt-4">Cargá</h3>
                        <p className="text-slate-400 max-w-xs">
                            Subí tus fotos y videos al panel de control. Organizalos en listas según el horario.
                        </p>
                    </div>

                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/10 border-2 border-indigo-500/50 text-indigo-300 text-2xl font-bold shadow-[0_0_20px_rgba(99,102,241,0.3)] backdrop-blur-sm">
                            3
                        </div>
                        <h3 className="text-xl font-bold text-white mt-4">Publicá</h3>
                        <p className="text-slate-400 max-w-xs">
                            Tus pantallas se actualizan automáticamente al instante. Sin ir al local.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    )
}
