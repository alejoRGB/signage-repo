
"use client"

import Link from "next/link"
import { MonitorPlay } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSession } from "next-auth/react"

export function Navbar() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-slate-950/20 backdrop-blur-xl supports-[backdrop-filter]:bg-slate-950/20">
            <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
                <Link href="/" className="flex items-center gap-2 font-bold text-xl text-indigo-500">
                    <MonitorPlay className="h-6 w-6 text-indigo-400" />
                    <span className="text-slate-50 tracking-tight">Expanded Signage</span>
                </Link>
                <nav className="hidden md:flex gap-6 text-sm font-medium text-slate-400">
                    <Link href="#product" className="hover:text-indigo-400 transition-colors">Producto</Link>
                    <Link href="#features" className="hover:text-indigo-400 transition-colors">Features</Link>
                    <Link href="#uses" className="hover:text-indigo-400 transition-colors">Casos de Uso</Link>
                    <Link href="#about" className="hover:text-indigo-400 transition-colors">Nosotros</Link>
                </nav>
                <div className="flex items-center gap-4">
                    <AuthButton />
                    <Button asChild size="sm" variant="glow" className="hidden md:flex text-xs uppercase tracking-widest font-bold">
                        <Link href="#contact">Contactar</Link>
                    </Button>
                </div>
            </div>
        </header>
    )
}

function AuthButton() {
    const { data: session, status } = useSession()

    if (status === "loading") return null

    if (session) {
        return (
            <Button asChild variant="ghost" className="text-slate-300 hover:text-white">
                <Link href="/dashboard">Dashboard</Link>
            </Button>
        )
    }

    return (
        <Button asChild variant="ghost" className="text-slate-300 hover:text-white">
            <Link href="/login">Login</Link>
        </Button>
    )
}
