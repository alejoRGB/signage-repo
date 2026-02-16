import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DIRECTIVE_TAB, type DirectiveTab } from "@/lib/directive-tabs";
import { DirectiveTabsShell } from "@/components/dashboard/directive-tabs-shell";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { isSyncVideowallEnabled } from "@/lib/env";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession(authOptions);

    let initialActiveDirectiveTab: DirectiveTab = DIRECTIVE_TAB.SCHEDULES;

    if (session?.user?.id && session.user.role === "USER") {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { activeDirectiveTab: true },
        });

        if (
            isSyncVideowallEnabled &&
            user?.activeDirectiveTab === DIRECTIVE_TAB.SYNC_VIDEOWALL
        ) {
            initialActiveDirectiveTab = DIRECTIVE_TAB.SYNC_VIDEOWALL;
        }
    }

    return (
        <div className="h-screen overflow-hidden bg-gray-100">
            <DirectiveTabsShell
                initialActiveDirectiveTab={initialActiveDirectiveTab}
                isSyncVideowallEnabled={isSyncVideowallEnabled}
            >
                <div className="flex h-full min-h-0 bg-gray-100 flex-col md:flex-row">
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
            </DirectiveTabsShell>
        </div>
    );
}
