require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const password = await bcrypt.hash('password123', 10);
    const user = await prisma.user.upsert({
        where: { email: 'admin@example.com' },
        update: {
            password: password, // Update password just in case
        },
        create: {
            email: 'admin@example.com',
            username: 'admin',
            password: password,
            name: 'Admin User',
            role: 'USER',
            isActive: true,
        },
    });
    console.log('User created/updated:', user);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
