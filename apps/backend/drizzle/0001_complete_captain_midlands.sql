ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "weekly_band_limit" integer;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "overflow_delivery_rate_cents" integer;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "pricing_tier" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "waybills" ADD COLUMN IF NOT EXISTS "item_value_cents" integer;
