/*
  Warnings:

  - The `condition` column on the `Listing` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Condition" AS ENUM ('NEW', 'USED');

-- AlterTable
ALTER TABLE "Listing" DROP COLUMN "condition",
ADD COLUMN     "condition" "Condition" NOT NULL DEFAULT 'USED';
