
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- CHECKING LOGS ---");
    const count = await prisma.deviceLog.count();
    console.log(`Total Log Entries: ${count}`);

    if (count > 0) {
        const logs = await prisma.deviceLog.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: { device: true }
        });
        logs.forEach(l => {
            console.log(`[${l.level}] ${l.createdAt.toISOString()} - Device: ${l.device.name} - ${l.message}`);
        });
    } else {
        console.log("No logs found in the database.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
