const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testUpdate() {
    const deviceId = 'cmlboxnd80002z1bva57u4wiv'; // RP4
    const testId = 'test_playlist_id_123';

    try {
        console.log(`Attempting to update device ${deviceId} with playingPlaylistId: ${testId}`);
        const updated = await prisma.device.update({
            where: { id: deviceId },
            data: {
                playingPlaylistId: testId
            }
        });
        console.log('Update successful!');
        console.log('New Value:', updated.playingPlaylistId);

        // Revert
        console.log('Reverting...');
        await prisma.device.update({
            where: { id: deviceId },
            data: {
                playingPlaylistId: 'cmlbp2k5s0009s5bllzywxoyz' // Revert to old value for consistency
            }
        });
        console.log('Reverted.');

    } catch (e) {
        console.error('Update failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

testUpdate();
