-- CreateTable
CREATE TABLE "ResearchBrief" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "windowStart" TEXT NOT NULL,
    "windowEnd" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "exclusions" JSONB NOT NULL,
    "searchCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchBrief_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchBrief_profileId_createdAt_idx" ON "ResearchBrief"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchBrief_chatId_idx" ON "ResearchBrief"("chatId");

-- AddForeignKey
ALTER TABLE "ResearchBrief" ADD CONSTRAINT "ResearchBrief_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchBrief" ADD CONSTRAINT "ResearchBrief_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

