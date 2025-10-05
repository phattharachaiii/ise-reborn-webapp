/*
  Warnings:

  - A unique constraint covering the columns `[qrToken]` on the table `Offer` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Offer" DROP CONSTRAINT "Offer_buyerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Offer" DROP CONSTRAINT "Offer_listingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Offer" DROP CONSTRAINT "Offer_sellerId_fkey";

-- AlterTable
ALTER TABLE "Offer" ALTER COLUMN "status" SET DEFAULT 'REQUESTED',
ALTER COLUMN "lastActor" SET DEFAULT 'BUYER';

-- CreateIndex
CREATE UNIQUE INDEX "Offer_qrToken_key" ON "Offer"("qrToken");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
