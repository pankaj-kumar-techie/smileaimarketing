-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "dealValueCents" INTEGER,
ADD COLUMN     "firstTouchCampaign" TEXT,
ADD COLUMN     "firstTouchContent" TEXT,
ADD COLUMN     "firstTouchLandingPage" TEXT,
ADD COLUMN     "firstTouchMedium" TEXT,
ADD COLUMN     "firstTouchReferrer" TEXT,
ADD COLUMN     "firstTouchSource" TEXT,
ADD COLUMN     "firstTouchTerm" TEXT,
ADD COLUMN     "visitorId" TEXT,
ADD COLUMN     "wonAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EngagementEvent" ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "path" TEXT,
ADD COLUMN     "properties" JSONB,
ADD COLUMN     "referrer" TEXT,
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "utmCampaign" TEXT,
ADD COLUMN     "utmContent" TEXT,
ADD COLUMN     "utmMedium" TEXT,
ADD COLUMN     "utmSource" TEXT,
ADD COLUMN     "utmTerm" TEXT,
ADD COLUMN     "visitorId" TEXT;

-- CreateIndex
CREATE INDEX "Business_visitorId_idx" ON "Business"("visitorId");

-- CreateIndex
CREATE INDEX "Business_firstTouchCampaign_idx" ON "Business"("firstTouchCampaign");

-- CreateIndex
CREATE UNIQUE INDEX "EngagementEvent_eventId_key" ON "EngagementEvent"("eventId");

-- CreateIndex
CREATE INDEX "EngagementEvent_visitorId_idx" ON "EngagementEvent"("visitorId");

-- CreateIndex
CREATE INDEX "EngagementEvent_utmCampaign_idx" ON "EngagementEvent"("utmCampaign");

