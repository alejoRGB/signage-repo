const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@example.invalid';
    const newPassword = '[REDACTED_ADMIN_PASSWORD]';

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update Admin table
    const admin = await prisma.admin.update({
        where: { email },
        data: { password: hashedPassword },
    });
    console.log(`Updated Admin password for ${email}`);

    // Update User table (if exists with same email, for consistency)
    try {
        const user = await prisma.user.updateMany({
            where: { email },
            data: { password: hashedPassword },
        });
        console.log(`Updated User password for ${email} (count: ${user.count})`);
    } catch (e) {
        console.log("User update skipped or failed");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
