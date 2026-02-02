
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Listing all devices...");
    const devices = await prisma.device.findMany({
        select: { id: true, name: true, token: true, status: true }
    });
    console.log(devices);
}

main().finally(() => prisma.$disconnect());
