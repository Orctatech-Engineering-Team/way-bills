ALTER TABLE "proof_of_deliveries" ALTER COLUMN "recipient_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_client_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_default_client_id_clients_id_fk" FOREIGN KEY ("default_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;