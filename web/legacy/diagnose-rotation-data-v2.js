const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Rotation Data Diagnostic (Round 2) ---");

    // 1. List Devices
    const devices = await prisma.device.findMany({
        include: { user: true }
    });

    console.log(`Found ${devices.length} devices.`);

    for (const device of devices) {
        // Only check devices that have items, or just check all media items directly?
        // Let's check the device view to see what the API would send.

        const fullDevice = await prisma.device.findUnique({
            where: { id: device.id },
            include: {
                activePlaylist: {
                    include: {
                        items: {
                            include: { mediaItem: true },
                            orderBy: { order: "asc" },
                        }
                    }
                },
                defaultPlaylist: {
                    include: {
                        items: {
                            include: { mediaItem: true },
                            orderBy: { order: "asc" },
                        }
                    }
                }
            },
        });

        const playlists = [fullDevice.activePlaylist, fullDevice.defaultPlaylist].filter(Boolean);

        if (playlists.length > 0) {
            console.log(`\nDevice: ${device.name || "Unnamed"} (${device.token})`);
            playlists.forEach(pl => {
                console.log(`  Playlist: ${pl.name}`);
                pl.items.forEach(item => {
                    if (item.mediaItem.type === 'web') {
                        console.log(`    [WEB] ${item.mediaItem.name}`);
                        console.log(`       DB Orientation: ${item.mediaItem.orientation}`);
                        // Simulate logic
                        const finalOrientation = item.mediaItem.orientation || 'landscape';
                        console.log(`       API Output: ${finalOrientation}`);
                    }
                });
            });
        }
    }

    // Also list latest web items globally to see if ANY were created with portrait
    console.log("\n--- Latest 5 Web Items ---");
    const latestWeb = await prisma.mediaItem.findMany({
        where: { type: 'web' },
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    latestWeb.forEach(item => {
        console.log(`Name: ${item.name}, Orientation: ${item.orientation}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
