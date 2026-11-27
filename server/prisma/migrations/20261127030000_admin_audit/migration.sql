CREATE TABLE "AuditLog" (
  "id" UUID PRIMARY KEY,
  "actorId" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" UUID NOT NULL,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuditLog_createdAt_id_idx" ON "AuditLog" ("createdAt", "id");
CREATE INDEX "AuditLog_actorId_createdAt_id_idx" ON "AuditLog" ("actorId", "createdAt", "id");
CREATE INDEX "AuditLog_action_createdAt_id_idx" ON "AuditLog" ("action", "createdAt", "id");
