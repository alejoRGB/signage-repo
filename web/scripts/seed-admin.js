
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const prisma = new PrismaClient();

async function main() {
    const email = (process.env.ADMIN_EMAIL || '').trim();
    const password = process.env.ADMIN_PASSWORD || '';
    const adminName = (process.env.ADMIN_NAME || 'Super Admin').trim() || 'Super Admin';

    if (!email || !password) {
        throw new Error(
            'Missing ADMIN_EMAIL or ADMIN_PASSWORD. Set both env vars before running seed-admin.',
        );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.admin.upsert({
        where: { email },
        update: {},
        create: {
            email,
            password: hashedPassword,
            name: adminName,
        },
    });

    console.log(`Admin seeded/verified: ${admin.email}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

