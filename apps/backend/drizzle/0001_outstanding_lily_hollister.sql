ALTER TABLE "waybills" ADD COLUMN "entry_mode" text DEFAULT 'live' NOT NULL;--> statement-breakpoint
ALTER TABLE "waybills" ADD COLUMN "delivery_proof_method" text DEFAULT 'signature' NOT NULL;