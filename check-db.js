
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- PRODUCTION DB CHECK ---");
    const count = await prisma.device.count();
    console.log(`Total Devices: ${count}`);

    const devices = await prisma.device.findMany();
    devices.forEach(d => {
        console.log(`Device: ${d.name || 'Unnamed'} | ID: ${d.id} | Status: ${d.status} | LastSeen: ${d.lastSeenAt}`);
        console.log(`Token: ${d.token.substring(0, 10)}...`);
    });

    if (count === 0) {
        console.log("\n⚠️ WARNING: Database is empty! If you switched databases, your old pairings are lost.");
        console.log("You must re-pair your player.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
