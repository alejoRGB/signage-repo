import { SidebarNav } from "@/components/dashboard/sidebar-nav";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen bg-transparent">
            {/* Sidebar (Client Component) */}
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
