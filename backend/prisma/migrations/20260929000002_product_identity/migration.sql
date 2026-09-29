-- Product identity columns: structured, verifiable identifiers for SEO,
-- Merchant Center, and duplicate detection. NULL = unknown (never guessed).
ALTER TABLE "products"
  ADD COLUMN "manufacturer" VARCHAR(255),
  ADD COLUMN "model_number" VARCHAR(100),
  ADD COLUMN "mpn" VARCHAR(100),
  ADD COLUMN "gtin" VARCHAR(50),
  ADD COLUMN "impa_code" VARCHAR(50),
  ADD COLUMN "source_url" TEXT,
  ADD COLUMN "last_verified_at" TIMESTAMP(3);
