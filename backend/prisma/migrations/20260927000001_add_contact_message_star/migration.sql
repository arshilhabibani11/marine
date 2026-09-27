ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "is_starred" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contact_messages_is_starred_idx" ON "contact_messages"("is_starred");
