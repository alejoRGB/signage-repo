const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Rotation Data Diagnostic ---");

    // 1. List Devices
    const devices = await prisma.device.findMany({
        include: { user: true }
    });

    if (devices.length === 0) {
        console.log("No devices found.");
        return;
    }

    console.log(`Found ${devices.length} devices.`);

    for (const device of devices) {
        console.log(`\nDevice: ${device.name} (Token: ${device.token})`);

        // 2. Simulate Sync Logic (Simplified)
        // I am copying the logic from route.ts to see what it *would* return
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

        playlists.forEach(pl => {
            console.log(`  Playlist: ${pl.name}`);
            pl.items.forEach(item => {
                console.log(`    Item: ${item.mediaItem.name}`);
                console.log(`      Type: ${item.mediaItem.type}`);
                console.log(`      DB Orientation: ${item.mediaItem.orientation}`);

                // Simulate logic
                const finalOrientation = item.mediaItem.orientation || 'landscape';
                console.log(`      API Output: ${finalOrientation}`);
            });
        });
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
