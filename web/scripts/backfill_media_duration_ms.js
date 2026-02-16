/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const { spawnSync } = require("node:child_process");

const prisma = new PrismaClient();

function parseArgs(argv) {
    const args = {
        dryRun: false,
        limit: null,
        id: null,
        userId: null,
        fallbackFromDuration: false,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];

        if (arg === "--dry-run") {
            args.dryRun = true;
        } else if (arg === "--fallback-from-duration") {
            args.fallbackFromDuration = true;
        } else if (arg === "--limit" && argv[i + 1]) {
            args.limit = Number.parseInt(argv[i + 1], 10);
            i += 1;
        } else if (arg === "--id" && argv[i + 1]) {
            args.id = argv[i + 1];
            i += 1;
        } else if (arg === "--user" && argv[i + 1]) {
            args.userId = argv[i + 1];
            i += 1;
        }
    }

    return args;
}

function ensureFfprobe() {
    const probe = spawnSync("ffprobe", ["-version"], { encoding: "utf8", timeout: 5000 });
    if (probe.error || probe.status !== 0) {
        throw new Error("ffprobe is not available on PATH. Install ffmpeg/ffprobe before running backfill.");
    }
}

function probeDurationMs(url) {
    const result = spawnSync(
        "ffprobe",
        [
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            url,
        ],
        {
            encoding: "utf8",
            timeout: 20000,
        }
    );

    if (result.error || result.status !== 0) {
        return {
            durationMs: null,
            reason: (result.stderr || result.error?.message || "ffprobe failed").trim(),
        };
    }

    const seconds = Number.parseFloat((result.stdout || "").trim());
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return {
            durationMs: null,
            reason: `invalid duration output: "${(result.stdout || "").trim()}"`,
        };
    }

    return {
        durationMs: Math.max(1, Math.round(seconds * 1000)),
        reason: null,
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    ensureFfprobe();

    const where = {
        type: "video",
        OR: [{ durationMs: null }, { durationMs: { lte: 0 } }],
    };

    if (args.id) {
        where.id = args.id;
    }
    if (args.userId) {
        where.userId = args.userId;
    }

    let mediaItems;
    try {
        mediaItems = await prisma.mediaItem.findMany({
            where,
            orderBy: { createdAt: "asc" },
            ...(args.limit && args.limit > 0 ? { take: args.limit } : {}),
            select: {
                id: true,
                userId: true,
                name: true,
                url: true,
                duration: true,
                durationMs: true,
            },
        });
    } catch (error) {
        if (error && error.code === "P2022") {
            throw new Error(
                "Database schema is not up to date (missing MediaItem.durationMs). Run Prisma migration before backfill."
            );
        }
        throw error;
    }

    if (mediaItems.length === 0) {
        console.log("No video media items need durationMs backfill.");
        return;
    }

    console.log(`Found ${mediaItems.length} video item(s) pending durationMs.`);
    if (args.dryRun) {
        console.log("Running in --dry-run mode. No DB updates will be applied.");
    }

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const media of mediaItems) {
        const probe = probeDurationMs(media.url);
        let resolvedDurationMs = probe.durationMs;
        let source = "ffprobe";

        if (!resolvedDurationMs && args.fallbackFromDuration && Number.isInteger(media.duration) && media.duration > 0) {
            resolvedDurationMs = media.duration * 1000;
            source = "duration_fallback";
        }

        if (!resolvedDurationMs) {
            failed += 1;
            console.warn(
                `[FAIL] ${media.id} "${media.name}" -> unable to resolve durationMs (${probe.reason || "unknown"})`
            );
            continue;
        }

        if (media.durationMs === resolvedDurationMs) {
            skipped += 1;
            console.log(`[SKIP] ${media.id} already has durationMs=${media.durationMs}`);
            continue;
        }

        console.log(`[PLAN] ${media.id} "${media.name}" -> durationMs=${resolvedDurationMs} (${source})`);

        if (!args.dryRun) {
            await prisma.mediaItem.update({
                where: { id: media.id },
                data: { durationMs: resolvedDurationMs },
            });
        }

        updated += 1;
    }

    console.log(
        `Backfill complete. updated=${updated}, skipped=${skipped}, failed=${failed}, dryRun=${args.dryRun}`
    );
}

main()
    .catch((error) => {
        console.error("Backfill failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
