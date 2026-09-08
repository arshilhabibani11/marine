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

-- CreateIndex
CREATE INDEX "email_queue_status_idx" ON "email_queue"("status");
