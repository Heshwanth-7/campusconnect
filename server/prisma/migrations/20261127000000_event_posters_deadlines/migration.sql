ALTER TABLE "Event"
  ADD COLUMN "posterImagePath" TEXT,
  ADD COLUMN "registrationDeadline" TIMESTAMPTZ(3);
