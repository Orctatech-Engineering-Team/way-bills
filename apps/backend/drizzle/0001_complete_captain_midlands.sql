ALTER TABLE "clients" ADD COLUMN "weekly_band_limit" integer;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "overflow_delivery_rate_cents" integer;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "pricing_tier" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "waybills" ADD COLUMN "item_value_cents" integer;