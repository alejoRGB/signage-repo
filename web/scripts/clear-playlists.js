const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("⚠️  Starting Playlist Cleanup (Option C)...");

    // 1. Remove references from Devices
    const updatedDevices = await prisma.device.updateMany({
        data: {
            activePlaylistId: null,
            defaultPlaylistId: null,
        }
    });
    console.log(`✅  Unlinked playlists from ${updatedDevices.count} Devices.`);

    // 2. Delete Schedule Items (which reference Playlists)
    const deletedScheduleItems = await prisma.scheduleItem.deleteMany({});
    console.log(`✅  Deleted ${deletedScheduleItems.count} Schedule Items.`);

    // 3. Delete Playlist Items
    const deletedItems = await prisma.playlistItem.deleteMany({});
    console.log(`✅  Deleted ${deletedItems.count} Playlist Items.`);

    // 4. Delete Playlists
    const deletedPlaylists = await prisma.playlist.deleteMany({});
    console.log(`✅  Deleted ${deletedPlaylists.count} Playlists.`);

    console.log("🎉 Cleanup complete. The database is ready for schema migration.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
