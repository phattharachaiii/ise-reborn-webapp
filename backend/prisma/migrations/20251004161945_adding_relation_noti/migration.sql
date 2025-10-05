-- CreateIndex
CREATE INDEX "Notification_offerId_idx" ON "Notification"("offerId");

-- CreateIndex
CREATE INDEX "Notification_listingId_idx" ON "Notification"("listingId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
