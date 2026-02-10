
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const vars = [
            "DATABASE_URL",
            "DATABASE_URL_UNPOOLED",
            "POSTGRES_URL_NON_POOLING",
            "POSTGRES_PRISMA_URL"
        ];

        const results: Record<string, string> = {};

        vars.forEach((key) => {
            const val = process.env[key];
            if (!val) {
                results[key] = "NOT_SET";
            } else {
                try {
                    // Extract host to show if it has -pooler
                    // Format: postgres://user:pass@HOST/db...
                    const parts = val.split('@');
                    if (parts.length > 1) {
                        const hostPart = parts[1].split('/')[0];
                        results[key] = hostPart; // e.g. ep-xyz.aws.neon.tech
                    } else {
                        results[key] = "FORMAT_ERROR";
                    }
                } catch (e) {
                    results[key] = "PARSE_ERROR";
                }
            }
        });

        return NextResponse.json({
            env_check: results,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
