const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const devices = await prisma.device.findMany({
        include: {
            schedule: true,
            activePlaylist: true,
        },
    });

    console.log("Devices found:", devices.length);
    devices.forEach(d => {
        console.log(`Device: ${d.name} (${d.id})`);
        console.log(`  Schedule ID: ${d.scheduleId}`);
        console.log(`  Schedule:`, d.schedule);
        console.log(`  Default Playlist:`, d.defaultPlaylistId);
        console.log("---");
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
