/*
  Warnings:

  - The values [GAME] on the enum `Category` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `meetPlace` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the column `listingId` on the `Report` table. All the data in the column will be lost.
  - You are about to drop the column `reporterId` on the `Report` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Report` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Report` table. All the data in the column will be lost.
  - Added the required column `authorId` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Made the column `targetUserId` on table `Report` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Category_new" AS ENUM ('BOOKS', 'CLOTHES', 'GADGET', 'FURNITURE', 'SPORTS', 'STATIONERY', 'ELECTRONICS', 'VEHICLES', 'MUSIC', 'OTHERS');
ALTER TABLE "public"."Listing" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "Listing" ALTER COLUMN "category" TYPE "Category_new" USING ("category"::text::"Category_new");
ALTER TYPE "Category" RENAME TO "Category_old";
ALTER TYPE "Category_new" RENAME TO "Category";
DROP TYPE "public"."Category_old";
ALTER TABLE "Listing" ALTER COLUMN "category" SET DEFAULT 'OTHERS';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."Report" DROP CONSTRAINT "Report_listingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Report" DROP CONSTRAINT "Report_reporterId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Report" DROP CONSTRAINT "Report_targetUserId_fkey";

-- DropIndex
DROP INDEX "public"."Report_listingId_idx";

-- DropIndex
DROP INDEX "public"."Report_reporterId_createdAt_idx";

-- DropIndex
DROP INDEX "public"."Report_status_updatedAt_idx";

-- DropIndex
DROP INDEX "public"."Report_targetUserId_idx";

-- DropIndex
DROP INDEX "public"."User_name_key";

-- DropIndex
DROP INDEX "public"."User_studentId_key";

-- AlterTable
ALTER TABLE "Listing" DROP COLUMN "meetPlace";

-- AlterTable
ALTER TABLE "Report" DROP COLUMN "listingId",
DROP COLUMN "reporterId",
DROP COLUMN "status",
DROP COLUMN "updatedAt",
ADD COLUMN     "authorId" TEXT NOT NULL,
ADD COLUMN     "details" TEXT,
ALTER COLUMN "targetUserId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" TIMESTAMP(3),
ADD COLUMN     "orgDomain" TEXT,
ALTER COLUMN "studentId" DROP NOT NULL,
ALTER COLUMN "name" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Report_authorId_idx" ON "Report"("authorId");

-- CreateIndex
CREATE INDEX "Report_targetUserId_createdAt_idx" ON "Report"("targetUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
