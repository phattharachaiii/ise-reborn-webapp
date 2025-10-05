-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "boostedAt" TIMESTAMP(3),
ADD COLUMN     "boostedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bio" TEXT;

-- CreateIndex
CREATE INDEX "Listing_boostedUntil_idx" ON "Listing"("boostedUntil");
