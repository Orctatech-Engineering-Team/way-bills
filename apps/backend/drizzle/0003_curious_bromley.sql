ALTER TABLE "proof_of_deliveries" ALTER COLUMN "recipient_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "default_client_id" text;--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'users_default_client_id_clients_id_fk'
	) THEN
		ALTER TABLE "users" ADD CONSTRAINT "users_default_client_id_clients_id_fk" FOREIGN KEY ("default_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
	END IF;
END $$;
