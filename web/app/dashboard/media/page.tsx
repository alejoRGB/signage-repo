import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MediaManager from "./media-manager";
import { redirect } from "next/navigation";

export const metadata = {
    title: "Media Library | Cloud Signage",
};

export default async function MediaPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    const mediaItems = await prisma.mediaItem.findMany({
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
                    Media Library
                </h1>
                <p className="mt-2 text-sm text-gray-500">
                    Manage your images and videos. Upload content here to use in your playlists.
                </p>
            </div>

            <MediaManager initialMedia={mediaItems} />
        </div>
    );
}
