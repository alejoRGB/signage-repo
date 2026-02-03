
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const formSchema = z.object({
    name: z.string().min(2, "El nombre es muy corto"),
    company: z.string().min(2, "La empresa es requerida"),
    email: z.string().email("Email inválido"),
    phone: z.string().min(10, "Teléfono inválido"),
    screens: z.string().min(1, "Cantidad requerida"),
    message: z.string().optional(),
})

export function ContactForm() {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsSubmitting(true)
        setError(null)

        try {
            const response = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            })

            if (!response.ok) throw new Error("Error al enviar")

            setIsSuccess(true)
            reset()
        } catch (err) {
            setError("Hubo un error al enviar el mensaje. Intenta nuevamente.")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isSuccess) {
        return (
            <div className="rounded-lg bg-green-50 border border-green-200 p-8 text-center">
                <h3 className="text-2xl font-bold text-green-700 mb-2">¡Mensaje enviado!</h3>
                <p className="text-slate-600 mb-6">Nos pondremos en contacto contigo a la brevedad.</p>
                <Button onClick={() => setIsSuccess(false)} variant="outline">
                    Enviar otro mensaje
                </Button>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Input placeholder="Nombre completo" {...register("name")} className="bg-white border-slate-300" />
                    {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                    <Input placeholder="Empresa" {...register("company")} className="bg-white border-slate-300" />
                    {errors.company && <p className="text-xs text-red-600">{errors.company.message}</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Input placeholder="Email corporativo" {...register("email")} className="bg-white border-slate-300" />
                    {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                    <Input placeholder="Teléfono / WhatsApp" {...register("phone")} className="bg-white border-slate-300" />
                    {errors.phone && <p className="text-xs text-red-600">{errors.phone.message}</p>}
                </div>
            </div>

            <div className="space-y-2">
                <Input placeholder="Cantidad de pantallas (aprox)" type="number" {...register("screens")} className="bg-white border-slate-300" />
                {errors.screens && <p className="text-xs text-red-600">{errors.screens.message}</p>}
            </div>

            <div className="space-y-2">
                <Textarea placeholder="Cuéntanos sobre tu proyecto..." className="min-h-[120px] bg-white border-slate-300" {...register("message")} />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...
                    </>
                ) : (
                    "Solicitar Información"
                )}
            </Button>
        </form>
    )
}
