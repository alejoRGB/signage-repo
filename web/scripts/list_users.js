const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Users ---");
    const users = await prisma.user.findMany();
    if (users.length === 0) console.log("No users found.");
    users.forEach(u => console.log(`User: ${u.username}, Email: ${u.email}, Role: ${u.role}, Active: ${u.isActive}`));

    console.log("\n--- Admins ---");
    const admins = await prisma.admin.findMany();
    if (admins.length === 0) console.log("No admins found.");
    admins.forEach(a => console.log(`Admin: ${a.email}, Name: ${a.name}`));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
