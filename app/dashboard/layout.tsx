"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Monitor, Image as ImageIcon, ListVideo, LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

const navigation = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Devices", href: "/dashboard/devices", icon: Monitor },
    { name: "Media", href: "/dashboard/media", icon: ImageIcon },
    { name: "Playlists", href: "/dashboard/playlists", icon: ListVideo },
];

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(" ");
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const { data: session } = useSession();

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar */}
            <div className="hidden w-64 flex-col bg-gray-900 md:flex">
                <div className="flex h-16 items-center justify-center bg-gray-800">
                    <h1 className="text-xl font-bold text-white">Cloud Signage</h1>
                </div>
                <div className="flex flex-1 flex-col overflow-y-auto pt-5">
                    <nav className="flex-1 space-y-1 px-2">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={classNames(
                                        isActive
                                            ? "bg-gray-800 text-white"
                                            : "text-gray-300 hover:bg-gray-700 hover:text-white",
                                        "group flex items-center rounded-md px-2 py-2 text-sm font-medium"
                                    )}
                                >
                                    <item.icon
                                        className={classNames(
                                            isActive
                                                ? "text-white"
                                                : "text-gray-400 group-hover:text-gray-300",
                                            "mr-3 h-6 w-6 flex-shrink-0"
                                        )}
                                    />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
                <div className="bg-gray-800 p-4">
                    <div className="flex items-center">
                        <div className="ml-3">
                            <p className="text-sm font-medium text-white">
                                {session?.user?.name || session?.user?.email}
                            </p>
                            <button
                                onClick={() => signOut({ callbackUrl: "/login" })}
                                className="text-xs text-gray-400 hover:text-white flex items-center mt-1"
                            >
                                <LogOut className="h-3 w-3 mr-1" />
                                Sign out
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Mobile Header (TODO) */}

                <main className="flex-1 overflow-y-auto p-4 sm:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
