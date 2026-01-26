
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Basic .env parser since dotenv is missing
try {
    const envPath = path.resolve(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf-8');
        envConfig.split('\n').forEach(line => {
            const [key, ...value] = line.split('=');
            if (key && value) {
                const val = value.join('=').trim().replace(/^["'](.*)["']$/, '$1');
                process.env[key.trim()] = val;
            }
        });
        console.log("✅ .env loaded manually");
    }
} catch (e) {
    console.error("Warning: Failed to load .env", e);
}

const prisma = new PrismaClient();

async function main() {
    console.log("--- DIAGNOSTIC START ---");

    // 1. Get first device to test with
    const device = await prisma.device.findFirst();
    if (!device) {
        console.error("❌ No devices found in DB. Cannot test.");
        return;
    }
    console.log(`✅ Found Device: ${device.name} (ID: ${device.id})`);
    console.log(`   Token: ${device.token}`);
    console.log(`   LastSeen: ${device.lastSeenAt}`);

    // 2. Simulate Log API POST
    const testLogs = [
        { level: "info", message: "Diagnostic Test Log 1", timestamp: new Date().toISOString() },
        { level: "error", message: "Diagnostic Test Log 2 (This is a fake error)", timestamp: new Date().toISOString() }
    ];

    console.log("\nAttempting to POST to /api/device/logs (Simulated via DB direct for now)...");

    try {
        await prisma.deviceLog.create({
            data: {
                deviceId: device.id,
                level: "info",
                message: "Manual DB Insertion Test Log",
                createdAt: new Date()
            }
        });
        console.log("✅ Manual DB Insertion successful. Check Dashboard 'View Logs' now.");
    } catch (e) {
        console.error("❌ Manual DB Insertion failed:", e);
    }

    // 3. Check 'Online' status logic
    const now = Date.now();
    const lastSeen = device.lastSeenAt ? new Date(device.lastSeenAt).getTime() : 0;
    const diff = now - lastSeen;
    const isOnline = diff < 5 * 60 * 1000;

    console.log("\n--- Status Calculation Check ---");
    console.log(`Time Diff: ${diff / 1000} seconds`);
    console.log(`Is Online (< 300s)? ${isOnline}`);

    // Check if we have logs for this device
    const logCount = await prisma.deviceLog.count({ where: { deviceId: device.id } });
    console.log(`\nTotal Logs in DB for this device: ${logCount}`);

    console.log("--- DIAGNOSTIC END ---");
}

main();
