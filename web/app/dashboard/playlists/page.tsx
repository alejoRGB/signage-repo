import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import PlaylistList from "./playlist-list";

export const metadata = {
    title: "Playlists | Cloud Signage",
};

export default async function PlaylistsPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    const playlists = await prisma.playlist.findMany({
        where: {
            userId: session.user.id,
        },
        include: {
            _count: {
                select: { items: true },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                    Playlists
                </h1>
                <p className="mt-2 text-sm text-gray-500">
                    Create collections of content to play on your devices.
                </p>
            </div>

            <PlaylistList initialPlaylists={playlists.map(p => ({ ...p, type: p.type as "media" | "web" }))} />
        </div>
    );
}
