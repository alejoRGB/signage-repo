import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Terminos de Servicio",
    alternates: {
        canonical: "/terms",
    },
};

export default function TermsPage() {
    return (
        <section className="container mx-auto px-4 py-16 md:px-6 md:py-24">
            <article className="mx-auto max-w-3xl space-y-6 text-slate-300">
                <h1 className="text-3xl font-bold text-white md:text-4xl">Terminos de Servicio</h1>
                <p>
                    Al usar Expanded Signage aceptas estos terminos para el uso de la plataforma de carteleria
                    digital y de los servicios relacionados.
                </p>
                <p>
                    El cliente es responsable del contenido publicado en sus pantallas y de contar con derechos
                    de uso sobre imagenes, videos y marcas utilizadas.
                </p>
                <p>
                    Los planes, alcances y condiciones comerciales se detallan en cada cotizacion y acuerdo
                    firmado con el cliente.
                </p>
                <p>Ultima actualizacion: 21 de febrero de 2026.</p>
            </article>
        </section>
    );
}
