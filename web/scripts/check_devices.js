const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking Devices...");
    const devices = await prisma.device.findMany();

    if (devices.length === 0) {
        console.log("No devices found.");
    } else {
        devices.forEach(d => {
            console.log(`Device: ${d.name} | Status: ${d.status} | LastSeen: ${d.lastSeenAt} | Token: ${d.token}`);
        });
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
