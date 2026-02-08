"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Monitor, Image as ImageIcon, ListVideo, LogOut, Calendar } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

const navigation = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Devices", href: "/dashboard/devices", icon: Monitor },
    { name: "Media", href: "/dashboard/media", icon: ImageIcon },
    { name: "Playlists", href: "/dashboard/playlists", icon: ListVideo },
    { name: "Schedules", href: "/dashboard/schedules", icon: Calendar },
];

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(" ");
}

export function SidebarNav() {
    const pathname = usePathname();
    const { data: session } = useSession();

    return (
        <div className="hidden w-64 flex-col bg-card/95 border-r border-border md:flex h-full backdrop-blur-sm z-10">
            <div className="flex h-16 items-center justify-center border-b border-white/5 bg-white/2">
                <h1 className="text-xl font-bold text-foreground font-display tracking-tight">Cloud Signage</h1>
            </div>
            <div className="flex flex-1 flex-col overflow-y-auto pt-5">
                <nav className="flex-1 space-y-1 px-4">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={classNames(
                                    isActive
                                        ? "bg-white/10 text-foreground"
                                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                                    "group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200"
                                )}
                            >
                                <item.icon
                                    className={classNames(
                                        isActive
                                            ? "text-foreground opacity-100"
                                            : "text-muted-foreground opacity-70 group-hover:opacity-100",
                                        "mr-3 h-5 w-5 flex-shrink-0"
                                    )}
                                />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>
            <div className="bg-transparent border-t border-border p-4">
                <div className="flex items-center">
                    <div className="ml-3">
                        <p className="text-sm font-medium text-foreground">
                            {session?.user?.name || session?.user?.email}
                        </p>
                        <button
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center mt-2 transition-colors"
                        >
                            <LogOut className="h-3 w-3 mr-1" />
                            Sign out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
