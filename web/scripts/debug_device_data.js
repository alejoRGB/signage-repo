
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    const deviceId = "cml2yoiij00fcoxue8640qt11"; // Correct ID for RP4
    console.log(`Checking data for device: ${deviceId}`);

    const device = await prisma.device.findUnique({
        where: { id: deviceId },
        include: {
            activePlaylist: {
                include: {
                    items: {
                        include: { mediaItem: true },
                        orderBy: { order: "asc" }
                    }
                }
            },
            defaultPlaylist: {
                include: {
                    items: {
                        include: { mediaItem: true },
                        orderBy: { order: "asc" }
                    }
                }
            }
        }
    });

    if (!device) {
        console.log("Device not found!");
        return;
    }

    console.log("--- Active Playlist ---");
    logPlaylist(device.activePlaylist);

    console.log("--- Default Playlist ---");
    logPlaylist(device.defaultPlaylist);
}

function logPlaylist(p) {
    if (!p) {
        console.log("None");
        return;
    }
    console.log(`ID: ${p.id}, Name: ${p.name}`);
    p.items.forEach((item, idx) => {
        console.log(`[${idx}] Type: ${item.mediaItem.type}, Duration(DB): ${item.mediaItem.duration}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
