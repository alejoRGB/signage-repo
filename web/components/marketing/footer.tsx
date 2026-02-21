import Link from "next/link";
import { MonitorPlay, Github, Twitter, Linkedin } from "lucide-react";

export function Footer() {
    return (
        <footer className="w-full border-t border-white/5 bg-slate-950/30 py-12 backdrop-blur-xl md:py-16">
            <div className="container mx-auto grid gap-8 px-4 md:px-6 lg:grid-cols-5">
                <div className="space-y-4 lg:col-span-2">
                    <Link href="/" className="flex items-center gap-2 text-xl font-bold text-indigo-500">
                        <MonitorPlay className="h-6 w-6 text-indigo-400" />
                        <span className="text-white">Expanded Signage</span>
                    </Link>
                    <p className="max-w-xs text-sm text-slate-400">
                        Carteleria digital para pymes, retail y franquicias. Implementacion simple, gestion remota y
                        foco en resultados comerciales.
                    </p>
                </div>

                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-white">Producto</h4>
                    <ul className="space-y-2 text-sm text-slate-400">
                        <li><Link href="/#how-it-works" className="transition-colors hover:text-indigo-400">Como funciona</Link></li>
                        <li><Link href="/#features" className="transition-colors hover:text-indigo-400">Features</Link></li>
                        <li><Link href="/cotizacion-carteleria-digital" className="transition-colors hover:text-indigo-400">Solicitar cotizacion</Link></li>
                        <li><Link href="/recursos" className="transition-colors hover:text-indigo-400">Recursos</Link></li>
                    </ul>
                </div>

                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-white">Soluciones</h4>
                    <ul className="space-y-2 text-sm text-slate-400">
                        <li><Link href="/carteleria-digital-buenos-aires" className="transition-colors hover:text-indigo-400">Buenos Aires</Link></li>
                        <li><Link href="/carteleria-digital-franquicias" className="transition-colors hover:text-indigo-400">Franquicias</Link></li>
                        <li><Link href="/carteleria-digital-retail" className="transition-colors hover:text-indigo-400">Retail</Link></li>
                        <li><Link href="/menu-digital-para-restaurantes" className="transition-colors hover:text-indigo-400">Menu digital</Link></li>
                        <li><Link href="/precios-carteleria-digital" className="transition-colors hover:text-indigo-400">Precios</Link></li>
                    </ul>
                </div>

                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-white">Legal</h4>
                    <ul className="space-y-2 text-sm text-slate-400">
                        <li><Link href="/privacy" className="transition-colors hover:text-indigo-400">Privacidad</Link></li>
                        <li><Link href="/terms" className="transition-colors hover:text-indigo-400">Terminos</Link></li>
                        <li><Link href="/cookies" className="transition-colors hover:text-indigo-400">Cookies</Link></li>
                    </ul>
                    <div className="flex gap-4 pt-2 text-slate-500">
                        <Link href="#" className="transition-colors hover:text-indigo-400"><Twitter className="h-5 w-5" /></Link>
                        <Link href="#" className="transition-colors hover:text-indigo-400"><Github className="h-5 w-5" /></Link>
                        <Link href="#" className="transition-colors hover:text-indigo-400"><Linkedin className="h-5 w-5" /></Link>
                    </div>
                </div>
            </div>
            <div className="container mx-auto mt-8 border-t border-white/5 px-4 pt-8 text-center text-xs text-slate-500">
                (c) 2026 Expanded Signage. Todos los derechos reservados.
            </div>
        </footer>
    );
}
