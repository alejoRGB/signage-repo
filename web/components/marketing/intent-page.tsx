import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { ContactForm } from "@/components/marketing/contact-form";
import { getSeoResourcesBySlugs, seoResources } from "@/lib/seo-resources";

type FaqItem = {
    question: string;
    answer: string;
};

type IntentPageProps = {
    badge: string;
    title: string;
    description: string;
    highlights: string[];
    challengesTitle: string;
    challenges: string[];
    solutionTitle: string;
    solutions: string[];
    faqTitle: string;
    faqs: FaqItem[];
    relatedResourceSlugs?: string[];
};

export function IntentPage({
    badge,
    title,
    description,
    highlights,
    challengesTitle,
    challenges,
    solutionTitle,
    solutions,
    faqTitle,
    faqs,
    relatedResourceSlugs,
}: IntentPageProps) {
    const relatedResources =
        relatedResourceSlugs && relatedResourceSlugs.length > 0
            ? getSeoResourcesBySlugs(relatedResourceSlugs)
            : seoResources.slice(0, 3);

    return (
        <div className="container mx-auto space-y-16 px-4 py-20 md:px-6 md:py-28">
            <section className="grid gap-10 lg:grid-cols-2 lg:gap-16">
                <div className="space-y-6">
                    <p className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-300">
                        {badge}
                    </p>
                    <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">{title}</h1>
                    <p className="text-lg text-slate-300">{description}</p>
                    <ul className="space-y-3">
                        {highlights.map((item) => (
                            <li key={item} className="flex items-start gap-3 text-slate-300">
                                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-indigo-400" />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                    <div className="flex flex-wrap gap-3 pt-2">
                        <Link
                            href="/cotizacion-carteleria-digital"
                            className="rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
                        >
                            Solicitar cotizacion
                        </Link>
                        <Link
                            href="/#how-it-works"
                            className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                        >
                            Ver como funciona
                        </Link>
                    </div>
                </div>

                <GlassCard className="p-6 md:p-8">
                    <ContactForm />
                </GlassCard>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
                <GlassCard className="p-6 md:p-8">
                    <h2 className="mb-4 text-2xl font-bold text-white">{challengesTitle}</h2>
                    <ul className="space-y-3 text-slate-300">
                        {challenges.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                </GlassCard>
                <GlassCard className="p-6 md:p-8">
                    <h2 className="mb-4 text-2xl font-bold text-white">{solutionTitle}</h2>
                    <ul className="space-y-3 text-slate-300">
                        {solutions.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                </GlassCard>
            </section>

            <section className="space-y-6">
                <h2 className="text-3xl font-bold text-white">{faqTitle}</h2>
                <div className="grid gap-4">
                    {faqs.map((faq) => (
                        <GlassCard key={faq.question} className="p-5 md:p-6">
                            <h3 className="mb-2 text-lg font-semibold text-white">{faq.question}</h3>
                            <p className="text-slate-300">{faq.answer}</p>
                        </GlassCard>
                    ))}
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-3xl font-bold text-white">Recursos recomendados</h2>
                <div className="grid gap-4 md:grid-cols-3">
                    {relatedResources.map((resource) => (
                        <GlassCard key={resource.slug} className="p-5">
                            <p className="text-xs font-semibold tracking-wider text-indigo-300 uppercase">{resource.category}</p>
                            <h3 className="mt-2 text-lg font-semibold text-white">{resource.title}</h3>
                            <p className="mt-2 text-sm text-slate-300">{resource.description}</p>
                            <Link
                                href={`/recursos/${resource.slug}`}
                                className="mt-4 inline-flex text-sm font-semibold text-indigo-300 hover:text-indigo-200"
                                data-analytics-event="click_recurso_relacionado"
                                data-analytics-label={`landing_recurso_${resource.slug}`}
                                data-analytics-location="intent_page"
                            >
                                Leer recurso
                            </Link>
                        </GlassCard>
                    ))}
                </div>
                <div>
                    <Link
                        href="/recursos"
                        className="inline-flex rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                        data-analytics-event="click_recurso"
                        data-analytics-label="intent_page_ver_todos_recursos"
                        data-analytics-location="intent_page"
                    >
                        Ver todos los recursos
                    </Link>
                </div>
            </section>
        </div>
    );
}
