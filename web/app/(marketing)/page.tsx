import { Hero } from "@/components/sections/hero";
import { Features } from "@/components/sections/features";
import { Product } from "@/components/sections/product";
import { UseCases } from "@/components/sections/use-cases";
import { SocialProof } from "@/components/sections/social-proof";
import { About } from "@/components/sections/about";
import { Contact } from "@/components/sections/contact";
import type { Metadata } from "next";
import { buildHomePageJsonLd, serializeJsonLd } from "@/lib/marketing-jsonld";

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://senaldigital.xyz").replace(/\/$/, "");

export const metadata: Metadata = {
    alternates: {
        canonical: "/",
    },
};

export default function Home() {
    const jsonLd = buildHomePageJsonLd(siteUrl);
    return (
        <div className="flex min-h-screen flex-col">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
            />
            <Hero />
            <Features />
            <Product />
            <UseCases />
            <SocialProof />
            <About />
            <Contact />
        </div>
    );
}
