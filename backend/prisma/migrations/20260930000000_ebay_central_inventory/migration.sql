-- eBay central inventory integration (roadmap C).
-- products.stock_count remains the ONLY source of truth; these tables are
-- mirrors: marketplace mapping (ebay_listings), idempotent order intake
-- (ebay_orders), and webhook event log (ebay_event_log).

-- CreateTable
CREATE TABLE "ebay_listings" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "ebay_offer_id" VARCHAR(50),
    "ebay_listing_id" VARCHAR(20),
    "marketplace" VARCHAR(20) NOT NULL DEFAULT 'EBAY_US',
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "last_synced_qty" INTEGER,
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ebay_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ebay_orders" (
    "id" UUID NOT NULL,
    "ebay_order_id" VARCHAR(50) NOT NULL,
    "order_id" UUID,
    "status" VARCHAR(30) NOT NULL DEFAULT 'processing',
    "total_amount" DECIMAL(12,2),
    "currency" VARCHAR(10),
    "last_error" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ebay_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ebay_event_log" (
    "id" UUID NOT NULL,
    "event_id" VARCHAR(100) NOT NULL,
    "topic" VARCHAR(100) NOT NULL,
    "payload" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'received',
    "error" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ebay_event_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ebay_listings_sku_marketplace_key" ON "ebay_listings"("sku", "marketplace");
CREATE INDEX "ebay_listings_product_id_idx" ON "ebay_listings"("product_id");
CREATE UNIQUE INDEX "ebay_orders_ebay_order_id_key" ON "ebay_orders"("ebay_order_id");
CREATE UNIQUE INDEX "ebay_event_log_event_id_key" ON "ebay_event_log"("event_id");
CREATE INDEX "ebay_event_log_topic_created_at_idx" ON "ebay_event_log"("topic", "created_at");

-- AddForeignKey
ALTER TABLE "ebay_listings" ADD CONSTRAINT "ebay_listings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ebay_orders" ADD CONSTRAINT "ebay_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex (one-to-one: one internal order per eBay order)
CREATE UNIQUE INDEX "ebay_orders_order_id_key" ON "ebay_orders"("order_id");
