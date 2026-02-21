import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { getSeoResourceBySlug, seoResources } from "@/lib/seo-resources";

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://senaldigital.xyz").replace(/\/$/, "");

type ResourcePageProps = {
    params: Promise<{
        slug: string;
    }>;
};

export function generateStaticParams() {
    return seoResources.map((resource) => ({
        slug: resource.slug,
    }));
}

export async function generateMetadata({ params }: ResourcePageProps): Promise<Metadata> {
    const { slug } = await params;
    const resource = getSeoResourceBySlug(slug);

    if (!resource) {
        return {
            title: "Recurso no encontrado",
        };
    }

    return {
        title: resource.title,
        description: resource.description,
        keywords: resource.keywords,
        alternates: {
            canonical: `/recursos/${resource.slug}`,
        },
        openGraph: {
            title: resource.title,
            description: resource.description,
            url: `${siteUrl}/recursos/${resource.slug}`,
            type: "article",
        },
    };
}

export default async function ResourceArticlePage({ params }: ResourcePageProps) {
    const { slug } = await params;
    const resource = getSeoResourceBySlug(slug);

    if (!resource) {
        notFound();
    }

    const related = seoResources.filter((item) => item.slug !== resource.slug).slice(0, 3);

    const articleJsonLd = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Article",
                headline: resource.title,
                description: resource.description,
                dateModified: resource.updatedAt,
                author: {
                    "@type": "Organization",
                    name: "Expanded Signage",
                },
                publisher: {
                    "@type": "Organization",
                    name: "Expanded Signage",
                    url: siteUrl,
                },
                mainEntityOfPage: `${siteUrl}/recursos/${resource.slug}`,
                keywords: resource.keywords.join(", "),
            },
            {
                "@type": "FAQPage",
                mainEntity: resource.faqs.map((faq) => ({
                    "@type": "Question",
                    name: faq.question,
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: faq.answer,
                    },
                })),
            },
        ],
    };

    return (
        <section className="container mx-auto px-4 py-20 md:px-6 md:py-28">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />

            <article className="mx-auto max-w-4xl space-y-8">
                <div className="space-y-4">
                    <p className="text-xs font-semibold tracking-wider text-indigo-300 uppercase">{resource.category}</p>
                    <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">{resource.title}</h1>
                    <p className="text-lg text-slate-300">{resource.description}</p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                        <span>Lectura: {resource.readTime}</span>
                        <span>Actualizado: {resource.updatedAt}</span>
                    </div>
                </div>

                <GlassCard className="p-6 md:p-8">
                    <p className="text-lg leading-relaxed text-slate-200">{resource.intro}</p>
                </GlassCard>

                {resource.sections.map((section) => (
                    <GlassCard key={section.title} className="p-6 md:p-8">
                        <h2 className="text-2xl font-bold text-white">{section.title}</h2>
                        <div className="mt-4 space-y-4">
                            {section.paragraphs.map((paragraph) => (
                                <p key={paragraph} className="leading-relaxed text-slate-300">
                                    {paragraph}
                                </p>
                            ))}
                        </div>
                        {section.bullets?.length ? (
                            <ul className="mt-5 space-y-2 text-slate-300">
                                {section.bullets.map((bullet) => (
                                    <li key={bullet}>- {bullet}</li>
                                ))}
                            </ul>
                        ) : null}
                    </GlassCard>
                ))}

                <GlassCard className="p-6 md:p-8">
                    <h2 className="text-2xl font-bold text-white">Preguntas frecuentes</h2>
                    <div className="mt-5 space-y-4">
                        {resource.faqs.map((faq) => (
                            <div key={faq.question}>
                                <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
                                <p className="mt-1 text-slate-300">{faq.answer}</p>
                            </div>
                        ))}
                    </div>
                </GlassCard>

                <GlassCard className="p-6 md:p-8">
                    <h2 className="text-2xl font-bold text-white">Siguiente paso</h2>
                    <p className="mt-3 text-slate-300">
                        Si quieres aplicar estas recomendaciones en tu negocio, te preparamos una cotizacion ajustada a
                        tu operacion y cantidad de sucursales.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                        <Link
                            href="/cotizacion-carteleria-digital"
                            className="rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400"
                            data-analytics-event="click_cta_principal"
                            data-analytics-label={`recurso_${resource.slug}_cotizacion`}
                            data-analytics-location="resource_article"
                        >
                            Solicitar cotizacion
                        </Link>
                        <Link href="/recursos" className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">
                            Ver todos los recursos
                        </Link>
                    </div>
                </GlassCard>
            </article>

            <div className="mx-auto mt-12 max-w-5xl">
                <h2 className="text-2xl font-bold text-white">Recursos relacionados</h2>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                    {related.map((item) => (
                        <GlassCard key={item.slug} className="p-5">
                            <p className="text-xs font-semibold tracking-wider text-indigo-300 uppercase">{item.category}</p>
                            <h3 className="mt-2 text-lg font-semibold text-white">{item.title}</h3>
                            <p className="mt-2 text-sm text-slate-300">{item.description}</p>
                            <Link
                                href={`/recursos/${item.slug}`}
                                className="mt-4 inline-flex text-sm font-semibold text-indigo-300 hover:text-indigo-200"
                                data-analytics-event="click_recurso_relacionado"
                                data-analytics-label={`recurso_relacionado_${item.slug}`}
                                data-analytics-location="resource_article"
                            >
                                Leer articulo
                            </Link>
                        </GlassCard>
                    ))}
                </div>
            </div>
        </section>
    );
}
