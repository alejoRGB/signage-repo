
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const deviceId = "cml2yoiij00fcoxue8640qt11"; // RP4
    console.log(`Checking schedules for device: ${deviceId}`);

    const schedules = await prisma.schedule.findMany({
        where: {
            devices: {
                some: { id: deviceId }
            }
        },
        include: {
            items: {
                include: {
                    playlist: true
                }
            }
        }
    });

    console.log("Found Schedules:", JSON.stringify(schedules, null, 2));
}

main().finally(() => prisma.$disconnect());
