import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Politica de Cookies",
    alternates: {
        canonical: "/cookies",
    },
};

export default function CookiesPage() {
    return (
        <section className="container mx-auto px-4 py-16 md:px-6 md:py-24">
            <article className="mx-auto max-w-3xl space-y-6 text-slate-300">
                <h1 className="text-3xl font-bold text-white md:text-4xl">Politica de Cookies</h1>
                <p>
                    Usamos cookies tecnicas y analiticas para mejorar la experiencia del sitio y medir
                    rendimiento de nuestras paginas.
                </p>
                <p>
                    Puedes configurar tu navegador para bloquear cookies. Algunas funciones del sitio pueden
                    verse afectadas si las desactivas.
                </p>
                <p>
                    Al continuar navegando aceptas el uso de cookies segun esta politica.
                </p>
                <p>Ultima actualizacion: 21 de febrero de 2026.</p>
            </article>
        </section>
    );
}
