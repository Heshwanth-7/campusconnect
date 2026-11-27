-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SEAT_CONFIRMED', 'WAITLIST_PROMOTED', 'EVENT_REMINDER', 'MATCH_FOUND', 'MATCH_CONFIRMED', 'EVENT_APPROVED', 'EVENT_REJECTED');

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "reminderSentAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "linkPath" TEXT NOT NULL,
    "readAt" TIMESTAMPTZ(3),
    "emailSentAt" TIMESTAMPTZ(3),
    "emailLeaseUntil" TIMESTAMPTZ(3),
    "emailAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_id_idx" ON "Notification"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_emailSentAt_emailAttempts_idx" ON "Notification"("emailSentAt", "emailAttempts");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

