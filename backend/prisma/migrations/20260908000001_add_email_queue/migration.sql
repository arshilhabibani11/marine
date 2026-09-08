-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'viewer',
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "company" VARCHAR(255),
    "country" VARCHAR(100),
    "city" VARCHAR(100),
    "address" TEXT,
    "website" VARCHAR(255),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "internal_notes" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "brand_id" UUID,
    "category_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "availability" VARCHAR(20) NOT NULL DEFAULT 'in-stock',
    "condition" VARCHAR(30) NOT NULL DEFAULT 'used',
    "short_description" TEXT,
    "description" TEXT,
    "regular_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sale_price" DECIMAL(12,2),
    "sale_starts_at" TIMESTAMP(3),
    "sale_ends_at" TIMESTAMP(3),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "show_price" BOOLEAN NOT NULL DEFAULT true,
    "make_offer_enabled" BOOLEAN NOT NULL DEFAULT false,
    "minimum_offer_price" DECIMAL(12,2),
    "stock_count" INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 10,
    "warehouse_location" VARCHAR(255),
    "public_item_location" VARCHAR(255),
    "lead_time" VARCHAR(100),
    "is_new_arrival" BOOLEAN NOT NULL DEFAULT false,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "custom_label" VARCHAR(100),
    "custom_label_color" VARCHAR(20),
    "sort_priority" INTEGER NOT NULL DEFAULT 0,
    "seo_title" VARCHAR(255),
    "seo_description" TEXT,
    "seo_keywords" TEXT,
    "og_image_url" TEXT,
    "canonical_url" TEXT,
    "internal_notes" TEXT,
    "purchase_cost" DECIMAL(12,2),
    "supplier_reference" VARCHAR(255),
    "product_type" VARCHAR(30) NOT NULL DEFAULT 'physical',
    "key_features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "compatibility_notes" TEXT,
    "condition_notes" TEXT,
    "warranty_notes" TEXT,
    "included_items" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excluded_items" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "legacy_id" VARCHAR(50),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "media_asset_id" UUID,
    "url" TEXT NOT NULL,
    "alt_text" VARCHAR(500),
    "label" VARCHAR(100),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_specs" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "value" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_industries" (
    "product_id" UUID NOT NULL,
    "industry_id" UUID NOT NULL,

    CONSTRAINT "product_industries_pkey" PRIMARY KEY ("product_id","industry_id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "parent_id" UUID,
    "icon" VARCHAR(100),
    "seo_title" VARCHAR(255),
    "seo_description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "logo_url" TEXT,
    "sectors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "website" VARCHAR(255),
    "country" VARCHAR(100),
    "seo_title" VARCHAR(255),
    "seo_description" TEXT,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "industries" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "icon" VARCHAR(100),
    "description" TEXT,
    "pain_points" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seo_title" VARCHAR(255),
    "seo_description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "industries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_number" VARCHAR(50) NOT NULL,
    "customer_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "payment_method" VARCHAR(50),
    "payment_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "payment_intent_id" VARCHAR(255),
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shipping_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "shipping_full_name" VARCHAR(255),
    "shipping_address_line1" VARCHAR(255),
    "shipping_address_line2" VARCHAR(255),
    "shipping_city" VARCHAR(100),
    "shipping_state" VARCHAR(100),
    "shipping_postal_code" VARCHAR(20),
    "shipping_country" VARCHAR(100),
    "tracking_number" VARCHAR(100),
    "courier" VARCHAR(100),
    "customer_notes" TEXT,
    "admin_notes" TEXT,
    "cancel_requested" BOOLEAN NOT NULL DEFAULT false,
    "cancel_reason" TEXT,
    "cancel_requested_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID,
    "product_name" VARCHAR(500) NOT NULL,
    "product_sku" VARCHAR(100),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "total_price" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_timeline" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_timeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfqs" (
    "id" UUID NOT NULL,
    "rfq_number" VARCHAR(50) NOT NULL,
    "customer_id" UUID,
    "full_name" VARCHAR(255) NOT NULL,
    "company" VARCHAR(255),
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "country" VARCHAR(100),
    "role" VARCHAR(100),
    "product_description" TEXT NOT NULL,
    "part_number" VARCHAR(255),
    "brand" VARCHAR(255),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "delivery_location" VARCHAR(255),
    "urgency" VARCHAR(20) NOT NULL DEFAULT 'standard',
    "status" VARCHAR(30) NOT NULL DEFAULT 'new',
    "assigned_to" UUID,
    "source" VARCHAR(50),
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "response_deadline" TIMESTAMP(3),
    "first_response_at" TIMESTAMP(3),
    "internal_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rfqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfq_items" (
    "id" UUID NOT NULL,
    "rfq_id" UUID NOT NULL,
    "product_name" VARCHAR(500) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" VARCHAR(50),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rfq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfq_notes" (
    "id" UUID NOT NULL,
    "rfq_id" UUID NOT NULL,
    "author_id" UUID,
    "note" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rfq_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL,
    "offer_number" VARCHAR(50) NOT NULL,
    "product_id" UUID,
    "rfq_id" UUID,
    "customer_id" UUID,
    "customer_email" VARCHAR(255) NOT NULL,
    "offered_price" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "message" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "counter_price" DECIMAL(12,2),
    "admin_notes" TEXT,
    "expires_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(500),
    "message" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'new',
    "assigned_to" UUID,
    "internal_notes" TEXT,
    "source" VARCHAR(50) NOT NULL DEFAULT 'contact-form',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_requests" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50) NOT NULL,
    "part_description" TEXT NOT NULL,
    "vessel_name" VARCHAR(255),
    "rfq_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'new',
    "contacted_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "filename" VARCHAR(500) NOT NULL,
    "original_name" VARCHAR(500),
    "url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "mime_type" VARCHAR(100),
    "file_size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "alt_text" VARCHAR(500),
    "label" VARCHAR(100),
    "hash" VARCHAR(64),
    "uploaded_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_settings" (
    "id" UUID NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "value" JSONB NOT NULL,
    "category" VARCHAR(100),
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_email" VARCHAR(255),
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID,
    "entity_name" VARCHAR(255),
    "previous_value" JSONB,
    "new_value" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_queue" (
    "id" UUID NOT NULL,
    "to_email" VARCHAR(255) NOT NULL,
    "to_name" VARCHAR(255),
    "subject" VARCHAR(500) NOT NULL,
    "html_body" TEXT NOT NULL,
    "text_body" TEXT,
    "template" VARCHAR(100),
    "template_data" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" UUID NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "payload" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'received',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE INDEX "products_availability_idx" ON "products"("availability");

-- CreateIndex
CREATE INDEX "products_sku_idx" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE INDEX "product_images_product_id_idx" ON "product_images"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_images_product_id_sort_order_key" ON "product_images"("product_id", "sort_order");

-- CreateIndex
CREATE INDEX "product_specs_product_id_idx" ON "product_specs"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE INDEX "categories_slug_idx" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE INDEX "brands_slug_idx" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "industries_slug_key" ON "industries"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_order_number_idx" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at" DESC);

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE INDEX "order_timeline_order_id_idx" ON "order_timeline"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "rfqs_rfq_number_key" ON "rfqs"("rfq_number");

-- CreateIndex
CREATE INDEX "rfqs_urgency_idx" ON "rfqs"("urgency");

-- CreateIndex
CREATE INDEX "rfqs_status_idx" ON "rfqs"("status");

-- CreateIndex
CREATE INDEX "rfqs_created_at_idx" ON "rfqs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "rfq_items_rfq_id_idx" ON "rfq_items"("rfq_id");

-- CreateIndex
CREATE UNIQUE INDEX "offers_offer_number_key" ON "offers"("offer_number");

-- CreateIndex
CREATE INDEX "offers_status_idx" ON "offers"("status");

-- CreateIndex
CREATE INDEX "offers_product_id_idx" ON "offers"("product_id");

-- CreateIndex
CREATE INDEX "offers_customer_email_idx" ON "offers"("customer_email");

-- CreateIndex
CREATE INDEX "contact_messages_status_idx" ON "contact_messages"("status");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_hash_key" ON "media_assets"("hash");

-- CreateIndex
CREATE INDEX "media_assets_hash_idx" ON "media_assets"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "store_settings_key_key" ON "store_settings"("key");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "email_queue_status_idx" ON "email_queue"("status");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_specs" ADD CONSTRAINT "product_specs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_industries" ADD CONSTRAINT "product_industries_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_industries" ADD CONSTRAINT "product_industries_industry_id_fkey" FOREIGN KEY ("industry_id") REFERENCES "industries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_timeline" ADD CONSTRAINT "order_timeline_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_timeline" ADD CONSTRAINT "order_timeline_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_items" ADD CONSTRAINT "rfq_items_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_notes" ADD CONSTRAINT "rfq_notes_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_notes" ADD CONSTRAINT "rfq_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_requests" ADD CONSTRAINT "emergency_requests_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

