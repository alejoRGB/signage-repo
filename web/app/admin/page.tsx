
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminDashboard from "./admin-dashboard";
import SignOutButton from "@/components/admin/sign-out-button";

export const metadata = {
    title: "Super Admin | Cloud Signage",
};

export default async function AdminPage() {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
        redirect("/admin/login");
    }

    // Fetch all users with their related data counts
    const users = await prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            devices: true,
            playlists: true,
            media: true
        }
    });

    // Process data for UI
    const userStats = users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        deviceCount: user.devices.length,
        playlistCount: user.playlists.length,
        storageUsed: user.media.reduce((acc, item) => acc + (item.size || 0), 0)
    }));

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
                <SignOutButton />
            </div>
            <AdminDashboard users={userStats} />
        </div>
    );
}
