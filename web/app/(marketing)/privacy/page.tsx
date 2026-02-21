import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Politica de Privacidad",
    alternates: {
        canonical: "/privacy",
    },
};

export default function PrivacyPage() {
    return (
        <section className="container mx-auto px-4 py-16 md:px-6 md:py-24">
            <article className="mx-auto max-w-3xl space-y-6 text-slate-300">
                <h1 className="text-3xl font-bold text-white md:text-4xl">Politica de Privacidad</h1>
                <p>
                    En Expanded Signage tratamos los datos de contacto que compartes para responder consultas
                    comerciales y brindar soporte sobre nuestros servicios de carteleria digital.
                </p>
                <p>
                    No vendemos informacion personal a terceros. Solo compartimos datos con proveedores
                    necesarios para operar la plataforma, bajo acuerdos de confidencialidad.
                </p>
                <p>
                    Puedes solicitar acceso, rectificacion o eliminacion de tus datos escribiendo a
                    contacto@expandedsignage.com.
                </p>
                <p>Ultima actualizacion: 21 de febrero de 2026.</p>
            </article>
        </section>
    );
}
