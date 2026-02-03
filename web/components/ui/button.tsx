
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(99,102,241,0.5)] hover:bg-primary/90 font-semibold tracking-wide",
                destructive:
                    "bg-red-900/50 border border-red-500/50 text-red-200 hover:bg-red-900/80",
                outline:
                    "border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 backdrop-blur-sm shadow-sm",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                ghost: "hover:bg-white/10 hover:text-white",
                link: "text-primary underline-offset-4 hover:underline",
                glow: "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-[0_0_25px_rgba(99,102,241,0.6)] hover:shadow-[0_0_35px_rgba(99,102,241,0.8)] transition-all duration-300 border border-white/20",
            },
            size: {
                default: "h-11 px-8 py-2",
                sm: "h-9 rounded-md px-3",
                lg: "h-12 rounded-md px-10 text-lg",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
