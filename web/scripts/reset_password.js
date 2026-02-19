const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const prisma = new PrismaClient();

async function main() {
    const email = (process.env.ADMIN_EMAIL || '').trim();
    const newPassword = process.env.ADMIN_PASSWORD || '';

    if (!email || !newPassword) {
        throw new Error(
            'Missing ADMIN_EMAIL or ADMIN_PASSWORD. Set both env vars before running reset_password.',
        );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.admin.update({
        where: { email },
        data: { password: hashedPassword },
    });
    console.log(`Updated Admin password for ${email}`);

    try {
        const user = await prisma.user.updateMany({
            where: { email },
            data: { password: hashedPassword },
        });
        console.log(`Updated User password for ${email} (count: ${user.count})`);
    } catch {
        console.log('User update skipped or failed');
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
