const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // Fallback to .env

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@example.invalid';
    const username = 'admin';
    const password = '[REDACTED_ADMIN_PASSWORD]';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if user exists by email
    const existingUser = await prisma.user.findUnique({
        where: { email },
    });

    if (existingUser) {
        console.log(`User ${email} exists. Updating username to '${username}'...`);
        await prisma.user.update({
            where: { email },
            data: {
                username,
                password: hashedPassword, // Update password just in case
            },
        });
        console.log('User updated successfully.');
    } else {
        console.log(`User ${email} not found. Creating new admin user...`);
        // Check if username is taken by a DIFFERENT email
        const existingUsername = await prisma.user.findUnique({
            where: { username }
        });

        if (existingUsername) {
            console.log(`Username '${username}' is already taken by another email. Deleting that user to force admin creation...`);
            await prisma.user.delete({ where: { username } });
        }

        await prisma.user.create({
            data: {
                email,
                username,
                password: hashedPassword,
                name: 'Admin User',
                role: 'ADMIN',
                isActive: true,
            },
        });
        console.log('User created successfully.');
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
