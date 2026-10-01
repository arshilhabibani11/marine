-- G47 abuse guards: record the submitter IP on offers (nullable — absent
-- telemetry never blocks a customer) and index it with created_at so the
-- rolling 24h flood-breaker count stays a cheap index-only scan.
ALTER TABLE "offers" ADD COLUMN "submission_ip" VARCHAR(64);

CREATE INDEX "offers_submission_ip_created_at_idx" ON "offers"("submission_ip", "created_at");
