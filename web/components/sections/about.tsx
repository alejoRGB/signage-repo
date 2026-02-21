export function About() {
    return (
        <section id="about" className="w-full border-t border-white/5 bg-slate-950/20 py-24 backdrop-blur-sm md:py-32">
            <div className="container mx-auto px-4 md:px-6">
                <div className="flex flex-col justify-center gap-6 text-center lg:flex-row lg:justify-between lg:text-left">
                    <div className="max-w-2xl space-y-6">
                        <h2 className="text-left text-3xl font-bold tracking-tighter text-white sm:text-4xl">
                            Solucion profesional con implementacion simple y precio razonable
                        </h2>
                        <p className="text-left text-lg leading-relaxed text-slate-400">
                            Creamos Expanded Signage para que una pyme pueda operar carteleria digital con el mismo
                            nivel de control que una gran cadena, pero sin estructura tecnica compleja.
                        </p>
                        <p className="text-left text-lg leading-relaxed text-slate-400">
                            Nuestro foco esta en ayudarte a vender mas y comunicar mejor en cada sucursal de CABA y GBA,
                            con una plataforma estable, facil de adoptar y preparada para escalar.
                        </p>
                    </div>
                    <div className="mt-8 grid grid-cols-2 gap-8 rounded-2xl border border-white/5 bg-white/5 p-6 backdrop-blur-md lg:mt-0 lg:gap-12">
                        <div className="flex flex-col items-center lg:items-start">
                            <span className="text-3xl font-bold tracking-tight text-white">Pymes</span>
                            <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Enfoque real</span>
                        </div>
                        <div className="flex flex-col items-center lg:items-start">
                            <span className="text-3xl font-bold tracking-tight text-white">Cloud</span>
                            <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Gestion central</span>
                        </div>
                        <div className="flex flex-col items-center lg:items-start">
                            <span className="text-3xl font-bold tracking-tight text-white">Soporte</span>
                            <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Continuo</span>
                        </div>
                        <div className="flex flex-col items-center lg:items-start">
                            <span className="text-3xl font-bold tracking-tight text-white">Escala</span>
                            <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Multi sucursal</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
