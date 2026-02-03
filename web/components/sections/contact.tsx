
import { ContactForm } from "@/components/marketing/contact-form"
import { Mail, MessageSquare } from "lucide-react"
import { GlassCard } from "@/components/ui/glass-card"

export function Contact() {
    return (
        <section id="contact" className="container mx-auto px-4 py-24 md:px-6 md:py-32">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-24">
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold tracking-tighter text-white sm:text-4xl md:text-5xl">
                        Probá Expanded Signage
                    </h2>
                    <p className="text-lg text-slate-400">
                        Dejanos tus datos y te contactamos para ver si somos la solución adecuada para tu negocio. Sin presiones de venta.
                    </p>

                    <div className="space-y-4 pt-8">
                        <div className="flex items-center gap-4 text-slate-400">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                                <Mail className="h-5 w-5 text-indigo-400" />
                            </div>
                            <div>
                                <p className="font-medium text-white">Email</p>
                                <p className="text-sm">contacto@expandedsignage.com</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-slate-400">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                                <MessageSquare className="h-5 w-5 text-indigo-400" />
                            </div>
                            <div>
                                <p className="font-medium text-white">Soporte</p>
                                <p className="text-sm">Ayuda técnica 24/7</p>
                            </div>
                        </div>
                    </div>
                </div>

                <GlassCard className="p-6 md:p-8">
                    <ContactForm />
                </GlassCard>
            </div>
        </section>
    )
}
