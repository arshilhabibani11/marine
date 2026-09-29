-- Make an Offer → PayPal payment flow
-- offers: the price actually payable after acceptance and the order that carries
-- the payment; orders: historical pricing snapshot for offer-based orders.

-- AlterTable
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "accepted_price" DECIMAL(12,2);
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "order_id" UUID;
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "accepted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "offer_id" UUID;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "original_listed_price" DECIMAL(12,2);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "negotiated_price" DECIMAL(12,2);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "offers_customer_id_idx" ON "offers"("customer_id");
CREATE INDEX IF NOT EXISTS "offers_order_id_idx" ON "offers"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "orders_offer_id_key" ON "orders"("offer_id");

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
