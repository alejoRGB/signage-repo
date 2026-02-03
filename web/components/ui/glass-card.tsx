import { cn } from "@/lib/utils"

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    hoverEffect?: boolean
}

export function GlassCard({ className, children, hoverEffect = true, ...props }: GlassCardProps) {
    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md",
                hoverEffect && "transition-all duration-300 hover:border-white/20 hover:bg-white/10 hover:scale-[1.02]",
                className
            )}
            {...props}
        >
            {/* Inner Gradient Noise/Highlight */}
            <div className="absolute inset-0 z-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-50 pointer-events-none" />

            <div className="relative z-10 h-full">
                {children}
            </div>
        </div>
    )
}
