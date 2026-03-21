CREATE TABLE "waybill_handovers" (
	"id" text PRIMARY KEY NOT NULL,
	"waybill_id" text NOT NULL,
	"from_rider_id" text,
	"to_rider_id" text NOT NULL,
	"note" text,
	"created_by" text NOT NULL,
	"handed_over_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "waybills" ALTER COLUMN "customer_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "waybills" ADD COLUMN "delivery_method" text DEFAULT 'cash' NOT NULL;--> statement-breakpoint
ALTER TABLE "waybills" ADD COLUMN "return_time" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "waybill_handovers" ADD CONSTRAINT "waybill_handovers_waybill_id_waybills_id_fk" FOREIGN KEY ("waybill_id") REFERENCES "public"."waybills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waybill_handovers" ADD CONSTRAINT "waybill_handovers_from_rider_id_users_id_fk" FOREIGN KEY ("from_rider_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waybill_handovers" ADD CONSTRAINT "waybill_handovers_to_rider_id_users_id_fk" FOREIGN KEY ("to_rider_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waybill_handovers" ADD CONSTRAINT "waybill_handovers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "waybill_handovers_waybill_id_idx" ON "waybill_handovers" USING btree ("waybill_id");--> statement-breakpoint
CREATE INDEX "waybill_handovers_handed_over_at_idx" ON "waybill_handovers" USING btree ("handed_over_at");