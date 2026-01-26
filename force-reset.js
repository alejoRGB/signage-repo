
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@example.invalid';
    const password = '[REDACTED_ADMIN_PASSWORD]';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update Password AND Name to prove DB connection
    const user = await prisma.user.update({
        where: { email },
        data: {
            password: hashedPassword,
            name: "SUPER ADMIN"
        },
    });

    console.log(`Updated user ${user.email}:`);
    console.log(`- Name: ${user.name}`);
    console.log(`- Password Reset: Yes`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
