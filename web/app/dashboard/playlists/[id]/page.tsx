import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import PlaylistEditor from "../playlist-editor";

export const metadata = {
    title: "Edit Playlist | Cloud Signage",
};

type Params = {
    params: Promise<{
        id: string;
    }>;
};

export default async function EditPlaylistPage({ params }: Params) {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    const { id } = await params;

    // Fetch Playlist with Items
    const playlist = await prisma.playlist.findFirst({
        where: {
            id: id,
            user: {
                id: session.user.id,
            },
        },
        include: {
            items: {
                include: {
                    mediaItem: true,
                },
                orderBy: {
                    order: "asc",
                },
            },
        },
    });

    if (!playlist) {
        notFound();
    }

    // Fetch Library
    const library = await prisma.mediaItem.findMany({
        where: {
            userId: session.user.id,
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                    Edit Playlist
                </h1>
            </div>

            <PlaylistEditor
                playlist={{
                    ...playlist,
                    items: playlist.items.map(item => ({
                        ...item,
                        duration: item.duration || item.mediaItem.duration || 10
                    }))
                }}
                library={library}
            />
        </div>
    );
}
