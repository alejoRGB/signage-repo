import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { MobileNav } from "@/components/dashboard/mobile-nav";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen bg-gray-100 flex-col md:flex-row">
            {/* Mobile Header */}
            <MobileNav />

            {/* Sidebar (Desktop) */}
            <SidebarNav />

            {/* Main content */}
            <div className="flex flex-1 flex-col overflow-hidden">
                <main className="flex-1 overflow-y-auto p-4 sm:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
