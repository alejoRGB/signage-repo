"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
    name: z.string().min(2, "El nombre es muy corto"),
    company: z.string().min(2, "La empresa es requerida"),
    email: z.string().email("Email invalido"),
    phone: z.string().min(8, "Telefono invalido"),
    businessType: z.string().min(2, "Indica tu rubro"),
    screens: z.number().int().min(1, "Cantidad requerida"),
    branches: z.number().int().min(1, "Cantidad requerida"),
    zone: z.string().min(2, "Indica tu zona"),
    message: z.string().max(2000, "Mensaje demasiado largo").optional(),
});

type ContactFormValues = z.infer<typeof formSchema>;

export function ContactForm() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<ContactFormValues>({
        resolver: zodResolver(formSchema),
    });

    async function onSubmit(values: ContactFormValues) {
        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });

            if (!response.ok) {
                throw new Error("Error al enviar");
            }

            setIsSuccess(true);
            reset();
        } catch {
            setError("Hubo un error al enviar la cotizacion. Intenta nuevamente.");
        } finally {
            setIsSubmitting(false);
        }
    }

    if (isSuccess) {
        return (
            <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center">
                <h3 className="mb-2 text-2xl font-bold text-green-700">Solicitud enviada</h3>
                <p className="mb-6 text-slate-600">Recibimos tu solicitud y te contactaremos a la brevedad.</p>
                <Button onClick={() => setIsSuccess(false)} variant="outline">
                    Enviar otra solicitud
                </Button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Input placeholder="Nombre completo" {...register("name")} className="border-slate-300 bg-white" />
                    {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                    <Input placeholder="Empresa" {...register("company")} className="border-slate-300 bg-white" />
                    {errors.company && <p className="text-xs text-red-600">{errors.company.message}</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Input
                        placeholder="Email corporativo"
                        {...register("email")}
                        className="border-slate-300 bg-white"
                    />
                    {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                    <Input
                        placeholder="Telefono / WhatsApp"
                        {...register("phone")}
                        className="border-slate-300 bg-white"
                    />
                    {errors.phone && <p className="text-xs text-red-600">{errors.phone.message}</p>}
                </div>
            </div>

            <div className="space-y-2">
                <Input placeholder="Rubro (ej: retail, franquicia, gastronomia)" {...register("businessType")} className="border-slate-300 bg-white" />
                {errors.businessType && <p className="text-xs text-red-600">{errors.businessType.message}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Input
                        placeholder="Cantidad de pantallas"
                        type="number"
                        min={1}
                        {...register("screens", { valueAsNumber: true })}
                        className="border-slate-300 bg-white"
                    />
                    {errors.screens && <p className="text-xs text-red-600">{errors.screens.message}</p>}
                </div>
                <div className="space-y-2">
                    <Input
                        placeholder="Cantidad de sucursales"
                        type="number"
                        min={1}
                        {...register("branches", { valueAsNumber: true })}
                        className="border-slate-300 bg-white"
                    />
                    {errors.branches && <p className="text-xs text-red-600">{errors.branches.message}</p>}
                </div>
            </div>

            <div className="space-y-2">
                <Input placeholder="Zona (CABA / GBA / partido)" {...register("zone")} className="border-slate-300 bg-white" />
                {errors.zone && <p className="text-xs text-red-600">{errors.zone.message}</p>}
            </div>

            <div className="space-y-2">
                <Textarea
                    placeholder="Comentarios adicionales (opcional)"
                    className="min-h-[120px] border-slate-300 bg-white"
                    {...register("message")}
                />
                {errors.message && <p className="text-xs text-red-600">{errors.message.message}</p>}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...
                    </>
                ) : (
                    "Solicitar cotizacion"
                )}
            </Button>
        </form>
    );
}
