-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('LOST', 'FOUND');

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('BOTTLE', 'BAG', 'ID_CARD', 'ELECTRONICS', 'BOOK', 'CLOTHING', 'KEYS', 'OTHER');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('OPEN', 'MATCHED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SUGGESTED', 'CONFIRMED', 'DISMISSED');

-- CreateTable
CREATE TABLE "LostFoundPost" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "PostType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "color" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "occurredAt" DATE NOT NULL,
    "imagePath" TEXT,
    "status" "PostStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LostFoundPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" UUID NOT NULL,
    "lostPostId" UUID NOT NULL,
    "foundPostId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'SUGGESTED',
    "lostUserConfirmedAt" TIMESTAMPTZ(3),
    "foundUserConfirmedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LostFoundPost_type_status_category_occurredAt_idx" ON "LostFoundPost"("type", "status", "category", "occurredAt");

-- CreateIndex
CREATE INDEX "LostFoundPost_userId_createdAt_idx" ON "LostFoundPost"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Match_foundPostId_idx" ON "Match"("foundPostId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_lostPostId_foundPostId_key" ON "Match"("lostPostId", "foundPostId");

-- AddForeignKey
ALTER TABLE "LostFoundPost" ADD CONSTRAINT "LostFoundPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_lostPostId_fkey" FOREIGN KEY ("lostPostId") REFERENCES "LostFoundPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_foundPostId_fkey" FOREIGN KEY ("foundPostId") REFERENCES "LostFoundPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Match" ADD CONSTRAINT "Match_score_range" CHECK ("score" BETWEEN 0 AND 100);
