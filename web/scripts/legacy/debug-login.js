
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@example.invalid';
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        console.log("User not found!");
        return;
    }

    console.log(`User found: ${user.email} (Role: ${user.role})`);
    console.log(`Current Hash: ${user.password.substring(0, 10)}...`);

    const compareAdmin123 = await bcrypt.compare('[REDACTED_ADMIN_PASSWORD]', user.password);
    console.log(`Password '[REDACTED_ADMIN_PASSWORD]' valid? ${compareAdmin123}`);

    const compare1234 = await bcrypt.compare('1234', user.password);
    console.log(`Password '1234' valid? ${compare1234}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
