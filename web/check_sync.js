const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log("Checking device sync status...");
    const devices = await prisma.device.findMany({
        include: { activePlaylist: true, user: true }
    });

    if (devices.length === 0) {
        console.log("No devices found.");
    }

    devices.forEach(d => {
        console.log(`\nDevice: ${d.name} (ID: ${d.id})`);
        console.log(`  Status: ${d.status}`);
        console.log(`  User: ${d.user ? d.user.email : 'Unassigned'}`);
        console.log(`  Last Seen: ${d.lastSeenAt}`);
        console.log(`  Active Playlist ID (Target): ${d.activePlaylistId}`);
        console.log(`  Playing Playlist ID (Reported): ${d.playingPlaylistId}`);

        const isSynced = d.activePlaylistId === d.playingPlaylistId;
        console.log(`  SYNC STATUS: ${isSynced ? 'MATCH (Ready)' : 'MISMATCH (Syncing...)'}`);

        if (d.activePlaylist) {
            console.log(`  Active Playlist Name: ${d.activePlaylist.name}`);
        }
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
