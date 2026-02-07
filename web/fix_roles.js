const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log("Fixing user roles...");

    // Set demo@expanded.com to USER role
    const demoEmail = "demo@expanded.com";
    try {
        const demoUser = await prisma.user.update({
            where: { email: demoEmail },
            data: { role: 'USER' },
        });
        console.log(`Updated ${demoUser.email} to role: ${demoUser.role}`);
    } catch (e) {
        console.log(`Failed to update ${demoEmail}: ${e.message}`);
    }

    // Set alejo@expanded.com to USER role (just in case they want to use that one)
    const alejoEmail = "alejo@expanded.com";
    try {
        const alejoUser = await prisma.user.update({
            where: { email: alejoEmail },
            data: { role: 'USER' },
        });
        console.log(`Updated ${alejoUser.email} to role: ${alejoUser.role}`);
    } catch (e) {
        console.log(`Failed to update ${alejoEmail}: ${e.message}`);
    }

    // Verify Admin is still Admin
    const adminEmail = "admin@example.invalid";
    try {
        const adminUser = await prisma.user.findUnique({
            where: { email: adminEmail }
        });
        console.log(`Verified ${adminUser.email} role is: ${adminUser.role}`);
    } catch (e) {
        console.log("Could not check admin user");
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
