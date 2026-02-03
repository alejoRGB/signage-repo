
import Link from "next/link"
import { MonitorPlay, Github, Twitter, Linkedin } from "lucide-react"

export function Footer() {
    return (
        <footer className="w-full border-t border-white/5 bg-slate-950/30 backdrop-blur-xl py-12 md:py-16">
            <div className="container mx-auto grid gap-8 px-4 md:px-6 lg:grid-cols-4">
                <div className="space-y-4">
                    <Link href="/" className="flex items-center gap-2 font-bold text-xl text-indigo-500">
                        <MonitorPlay className="h-6 w-6 text-indigo-400" />
                        <span className="text-white">Expanded Signage</span>
                    </Link>
                    <p className="text-sm text-slate-400 max-w-xs">
                        Democratizando la cartelería digital para PyMEs y pequeños comercios. Simple, remota y en la nube.
                    </p>
                </div>
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-white">Producto</h4>
                    <ul className="space-y-2 text-sm text-slate-400">
                        <li><Link href="#how-it-works" className="hover:text-indigo-400 transition-colors">Cómo funciona</Link></li>
                        <li><Link href="#features" className="hover:text-indigo-400 transition-colors">Features</Link></li>
                        <li><Link href="#hardware" className="hover:text-indigo-400 transition-colors">Hardware compatible</Link></li>
                    </ul>
                </div>
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-white">Legal</h4>
                    <ul className="space-y-2 text-sm text-slate-400">
                        <li><Link href="/privacy" className="hover:text-indigo-400 transition-colors">Privacidad</Link></li>
                        <li><Link href="/terms" className="hover:text-indigo-400 transition-colors">Términos de servicio</Link></li>
                        <li><Link href="/cookies" className="hover:text-indigo-400 transition-colors">Cookies</Link></li>
                    </ul>
                </div>
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-white">Conecta</h4>
                    <div className="flex gap-4 text-slate-500">
                        <Link href="#" className="hover:text-indigo-400 transition-colors"><Twitter className="h-5 w-5" /></Link>
                        <Link href="#" className="hover:text-indigo-400 transition-colors"><Github className="h-5 w-5" /></Link>
                        <Link href="#" className="hover:text-indigo-400 transition-colors"><Linkedin className="h-5 w-5" /></Link>
                    </div>
                </div>
            </div>
            <div className="container mx-auto px-4 mt-8 pt-8 border-t border-white/5 text-center text-xs text-slate-500">
                © 2024 Expanded Signage. Todos los derechos reservados.
            </div>
        </footer>
    )
}
