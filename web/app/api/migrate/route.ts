
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        // Add cacheForOffline column
        await prisma.$executeRawUnsafe(`
      ALTER TABLE "MediaItem" 
      ADD COLUMN IF NOT EXISTS "cacheForOffline" BOOLEAN NOT NULL DEFAULT false;
    `);

        // Add duration column (if missing)
        await prisma.$executeRawUnsafe(`
      ALTER TABLE "MediaItem" 
      ADD COLUMN IF NOT EXISTS "duration" INTEGER NOT NULL DEFAULT 10;
    `);

        return NextResponse.json({ success: true, message: "Migration executed successfully" });
    } catch (error) {
        console.error("Migration failed:", error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
