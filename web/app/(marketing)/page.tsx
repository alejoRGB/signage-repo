import { Hero } from "@/components/sections/hero";
import { Features } from "@/components/sections/features";
import { Product } from "@/components/sections/product";
import { UseCases } from "@/components/sections/use-cases";
import { About } from "@/components/sections/about";
import { Contact } from "@/components/sections/contact";

export default function Home() {
    return (
        <div className="flex flex-col min-h-screen">
            <Hero />
            <Features />
            <Product />
            <UseCases />
            <About />
            <Contact />
        </div>
    );
}
