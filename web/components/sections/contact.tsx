import { ContactForm } from "@/components/marketing/contact-form";
import { Mail, MessageCircle, MessageSquare } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

export function Contact() {
    const whatsappNumberRaw = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";
    const whatsappNumber = whatsappNumberRaw.replace(/\D/g, "");
    const whatsappHref = whatsappNumber ? `https://wa.me/${whatsappNumber}` : null;

    return (
        <section id="contact" className="container mx-auto px-4 py-24 md:px-6 md:py-32">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-24">
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold tracking-tighter text-white sm:text-4xl md:text-5xl">
                        Solicita tu cotizacion
                    </h2>
                    <p className="text-lg text-slate-400">
                        Dejanos tus datos y te enviamos una propuesta ajustada a tu negocio, cantidad de pantallas y
                        sucursales.
                    </p>

                    <div className="space-y-4 pt-8">
                        <div className="flex items-center gap-4 text-slate-400">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-indigo-500/20 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                                <Mail className="h-5 w-5 text-indigo-400" />
                            </div>
                            <div>
                                <p className="font-medium text-white">Email</p>
                                <p className="text-sm">contacto@expandedsignage.com</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-slate-400">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-indigo-500/20 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                                <MessageSquare className="h-5 w-5 text-indigo-400" />
                            </div>
                            <div>
                                <p className="font-medium text-white">Soporte</p>
                                <p className="text-sm">Ayuda tecnica 24/7</p>
                            </div>
                        </div>
                    </div>

                    {whatsappHref ? (
                        <div className="pt-6">
                            <a
                                href={whatsappHref}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                                data-analytics-event="click_whatsapp"
                                data-analytics-label="contact_section_whatsapp"
                                data-analytics-location="contact_section"
                            >
                                <MessageCircle className="h-4 w-4" />
                                Escribinos por WhatsApp
                            </a>
                        </div>
                    ) : null}
                </div>

                <GlassCard className="p-6 md:p-8">
                    <ContactForm />
                </GlassCard>
            </div>
        </section>
    );
}
