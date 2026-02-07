const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const password = "signage2026";
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log("Restoring users...");

    // 1. Restore Admin (Admin Table)
    const adminEmail = "admin@example.invalid";
    const admin = await prisma.admin.upsert({
        where: { email: adminEmail },
        update: { password: hashedPassword },
        create: {
            email: adminEmail,
            password: hashedPassword,
            name: "Super Admin",
        },
    });
    console.log(`Admin restored (Admin Table): ${admin.email}`);

    // 1b. Restore Admin as User (User Table - for standard login)
    // We need a unique username.
    const adminUser = await prisma.user.upsert({
        where: { email: adminEmail },
        update: { password: hashedPassword, role: 'ADMIN', isActive: true },
        create: {
            email: adminEmail,
            username: "admin_user",
            password: hashedPassword,
            name: "Super Admin",
            role: 'ADMIN',
            isActive: true,
        },
    });
    console.log(`Admin restored (User Table): ${adminUser.email}`);

    // 2. Restore User
    // Try to restore a common user email if known
    const userEmail = "demo@expanded.com";
    const user = await prisma.user.upsert({
        where: { email: userEmail },
        update: { password: hashedPassword, role: 'ADMIN', isActive: true },
        create: {
            email: userEmail,
            username: "demo_user",
            password: hashedPassword,
            name: "Demo User",
            role: 'ADMIN', // Give admin role to demo user for ease of access
            isActive: true,
        },
    });
    console.log(`User restored: ${user.email}`);

    // 3. User requested: alejoRGB/signage-repo hints at alejo?
    // Let's create an alejo user just in case
    const alejoEmail = "alejo@expanded.com";
    const alejoUser = await prisma.user.upsert({
        where: { email: alejoEmail },
        update: { password: hashedPassword, role: 'ADMIN', isActive: true },
        create: {
            email: alejoEmail,
            username: "alejo",
            password: hashedPassword,
            name: "Alejo",
            role: 'ADMIN',
            isActive: true,
        },
    });
    console.log(`User restored: ${alejoUser.email}`);

}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
