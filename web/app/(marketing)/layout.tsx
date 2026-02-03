import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Expanded Signage | Cartelería Digital Simple para Comercios y PyMEs",
    description: "Controla tus pantallas de forma remota. Software de cartelería digital ideal para gestionar promociones y menús en tiempo real.",
};

export default function MarketingLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">
                {children}
            </main>
            <Footer />
        </div>
    );
}
