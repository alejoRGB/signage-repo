
export function About() {
    return (
        <section id="about" className="w-full border-t border-white/5 bg-slate-950/20 backdrop-blur-sm py-24 md:py-32">
            <div className="container mx-auto px-4 md:px-6">
                <div className="flex flex-col items-center justify-center gap-6 text-center lg:flex-row lg:text-left lg:justify-between">
                    <div className="max-w-2xl space-y-6">
                        <h2 className="text-3xl font-bold tracking-tighter text-white sm:text-4xl text-left">
                            Software profesional, precio razonable
                        </h2>
                        <p className="text-lg text-slate-400 leading-relaxed text-left">
                            Creamos Expanded Signage porque vimos que las soluciones existentes eran demasiado caras o imposibles de usar para una PYME. <span className="text-indigo-400 font-medium">Queremos que tengas la misma tecnología que las grandes cadenas</span>.
                        </p>
                        <p className="text-lg text-slate-400 leading-relaxed text-left">
                            Te damos el control total de tus pantallas para que puedas vender más y comunicarte mejor, sin dolores de cabeza técnicos.
                        </p>
                    </div>
                    {/* Decorative stats or visual */}
                    <div className="grid grid-cols-2 gap-8 lg:gap-12 mt-8 lg:mt-0 p-6 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-md">
                        <div className="flex flex-col items-center lg:items-start">
                            <span className="text-4xl font-bold text-white tracking-tight">99.9%</span>
                            <span className="text-sm text-slate-400 uppercase tracking-wider text-xs font-semibold">Uptime</span>
                        </div>
                        <div className="flex flex-col items-center lg:items-start">
                            <span className="text-4xl font-bold text-white tracking-tight">Cloud</span>
                            <span className="text-sm text-slate-400 uppercase tracking-wider text-xs font-semibold">Native</span>
                        </div>
                        <div className="flex flex-col items-center lg:items-start">
                            <span className="text-4xl font-bold text-white tracking-tight">24/7</span>
                            <span className="text-sm text-slate-400 uppercase tracking-wider text-xs font-semibold">Soporte</span>
                        </div>
                        <div className="flex flex-col items-center lg:items-start">
                            <span className="text-4xl font-bold text-white tracking-tight">RPi</span>
                            <span className="text-sm text-slate-400 uppercase tracking-wider text-xs font-semibold">Compatible</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
