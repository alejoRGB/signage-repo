const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log("--- USERS ---");
    const users = await prisma.user.findMany();
    if (users.length === 0) console.log("No users found.");
    users.forEach(u => console.log(`User: ${u.email} | Username: ${u.username} | Role: ${u.role} | Active: ${u.isActive}`));

    console.log("\n--- ADMINS ---");
    try {
        const admins = await prisma.admin.findMany();
        if (admins.length === 0) console.log("No admins found.");
        admins.forEach(a => console.log(`Admin: ${a.email} | Name: ${a.name}`));
    } catch (e) {
        console.log("Admin table query failed (might not exist or be accessible):", e.message);
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
