const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../../player/config.json');

async function main() {
    console.log("Rotating Device Token...");

    // 1. Read current token from config
    if (!fs.existsSync(CONFIG_PATH)) {
        console.error("Config file not found!");
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const oldToken = config.device_token;

    if (!oldToken) {
        console.error("No device_token in config!");
        process.exit(1);
    }

    // 2. Find device
    const device = await prisma.device.findFirst({
        where: { token: oldToken }
    });

    if (!device) {
        console.error(`Device with token ${oldToken} not found in DB!`);
        process.exit(1);
    }

    // 3. Generate new token
    const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // 4. Update DB
    await prisma.device.update({
        where: { id: device.id },
        data: { token: newToken }
    });

    console.log(`Device ${device.name} token updated in DB.`);

    // 5. Update local config
    config.device_token = newToken;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4));

    console.log(`Local config.json updated with new token: ${newToken}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());
