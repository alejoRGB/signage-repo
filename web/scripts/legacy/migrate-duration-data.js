
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting migration of durations...');

    // Get all playlist items with their related media item
    const items = await prisma.playlistItem.findMany({
        include: {
            mediaItem: true
        }
    });

    console.log(`Found ${items.length} playlist items.`);

    let updatedCount = 0;

    for (const item of items) {
        if (item.mediaItem) {
            // Update the playlist item duration to match the media item duration
            // This preserves the previous behavior where duration was global
            await prisma.playlistItem.update({
                where: { id: item.id },
                data: {
                    duration: item.mediaItem.duration
                }
            });
            updatedCount++;
        }
    }

    console.log(`Successfully migrated ${updatedCount} items.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
