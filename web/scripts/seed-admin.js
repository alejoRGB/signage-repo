
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@example.invalid';
    const password = 'admin'; // Default password
    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.admin.upsert({
        where: { email },
        update: {}, // Do nothing if exists
        create: {
            email,
            password: hashedPassword,
            name: 'Super Admin',
        },
    });

    console.log({ admin });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
