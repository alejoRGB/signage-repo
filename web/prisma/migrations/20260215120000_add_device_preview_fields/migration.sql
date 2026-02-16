ALTER TABLE "Device"
ADD COLUMN "currentContentName" TEXT,
ADD COLUMN "previewImageUrl" TEXT,
ADD COLUMN "previewCapturedAt" TIMESTAMP(3);

ALTER TABLE "Device"
ADD CONSTRAINT "Device_playingPlaylistId_fkey"
FOREIGN KEY ("playingPlaylistId") REFERENCES "Playlist"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
