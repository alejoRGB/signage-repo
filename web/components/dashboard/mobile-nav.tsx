"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Monitor, Image as ImageIcon, ListVideo, LogOut, Calendar, Menu, X } from "lucide-react";
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

export function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();
    const { data: session } = useSession();

    return (
        <div className="md:hidden bg-gray-900 border-b border-gray-800">
            <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center">
                    <h1 className="text-xl font-bold text-white">Cloud Signage</h1>
                </div>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="text-gray-300 hover:text-white focus:outline-none"
                >
                    {isOpen ? (
                        <X className="h-6 w-6" />
                    ) : (
                        <Menu className="h-6 w-6" />
                    )}
                </button>
            </div>

            {/* Mobile Menu Overlay/Dropdown */}
            {isOpen && (
                <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-900 border-t border-gray-800">
                    <nav className="space-y-1">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => setIsOpen(false)}
                                    className={classNames(
                                        isActive
                                            ? "bg-gray-800 text-white"
                                            : "text-gray-300 hover:bg-gray-700 hover:text-white",
                                        "group flex items-center rounded-md px-3 py-2 text-base font-medium"
                                    )}
                                >
                                    <item.icon
                                        className={classNames(
                                            isActive
                                                ? "text-white"
                                                : "text-gray-400 group-hover:text-gray-300",
                                            "mr-3 h-5 w-5 flex-shrink-0"
                                        )}
                                    />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                    <div className="border-t border-gray-700 pt-4 pb-3 mt-4">
                        <div className="flex items-center px-4">
                            <div className="ml-3">
                                <div className="text-base font-medium leading-none text-white">
                                    {session?.user?.name || "User"}
                                </div>
                                <div className="text-sm font-medium leading-none text-gray-400 mt-1">
                                    {session?.user?.email}
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 px-2 space-y-1">
                            <button
                                onClick={() => signOut({ callbackUrl: "/login" })}
                                className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-400 hover:text-white hover:bg-gray-700"
                            >
                                <div className="flex items-center">
                                    <LogOut className="h-5 w-5 mr-3" />
                                    Sign out
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
