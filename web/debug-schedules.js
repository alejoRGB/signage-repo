const { PrismaClient } = require('@prisma/client');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

async function main() {
    const prisma = new PrismaClient();
    try {
        console.log("Connecting...");

        // Find admin user to get ID
        const user = await prisma.user.findUnique({
            where: { username: 'admin' }
        });

        if (!user) {
            console.log("Admin user not found");
            return;
        }

        console.log("Found user:", user.id);

        console.log("Running schedule query...");
        const schedules = await prisma.schedule.findMany({
            where: {
                userId: user.id,
            },
            include: {
                _count: {
                    select: { devices: true, items: true },
                },
            },
            orderBy: {
                updatedAt: "desc",
            },
        });

        console.log("Schedules found:", schedules);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
