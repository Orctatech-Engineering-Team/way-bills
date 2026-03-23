CREATE TYPE "public"."invoice_email_status" AS ENUM('not_sent', 'queued', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."invoice_source" AS ENUM('manual', 'automatic');--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "source" "invoice_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "email_status" "invoice_email_status" DEFAULT 'not_sent' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "email_delivery_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "last_email_error" text;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_client_period_unique" ON "invoices" USING btree ("client_id","period_start","period_end");