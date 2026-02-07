const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSync() {
    try {
        console.log('Checking device sync status...\n');
        const devices = await prisma.device.findMany({
            include: {
                activePlaylist: true,
                user: true
            }
        });

        for (const d of devices) {
            console.log(`Device: ${d.name || 'Unnamed'} (ID: ${d.id})`);
            console.log(`  Status: ${d.status}`);
            console.log(`  User: ${d.user ? d.user.email : 'Unassigned'}`);
            console.log(`  Last Seen: ${d.lastSeenAt}`);
            console.log(`  Active Playlist ID (Target): ${d.activePlaylistId}`);
            console.log(`  Playing Playlist ID (Reported): ${d.playingPlaylistId}`);

            if (d.activePlaylistId === d.playingPlaylistId) {
                console.log('  SYNC STATUS: MATCH (Ready)');
            } else {
                console.log('  SYNC STATUS: MISMATCH (Syncing...)');
            }
            if (d.activePlaylist) {
                console.log(`  Active Playlist Name: ${d.activePlaylist.name}`);
            }
            console.log('');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkSync();
