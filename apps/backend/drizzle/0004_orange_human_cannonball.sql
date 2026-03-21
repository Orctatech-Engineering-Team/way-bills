DO $$
BEGIN
	CREATE TYPE "public"."rider_shift_status" AS ENUM('active', 'completed');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$
BEGIN
	CREATE TYPE "public"."shift_handover_status" AS ENUM('pending', 'completed', 'cancelled');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rider_shift_handovers" (
	"id" text PRIMARY KEY NOT NULL,
	"outgoing_shift_id" text NOT NULL,
	"outgoing_rider_id" text NOT NULL,
	"incoming_rider_id" text NOT NULL,
	"initiated_by" text NOT NULL,
	"completed_by" text,
	"status" "shift_handover_status" DEFAULT 'pending' NOT NULL,
	"note" text,
	"initiated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outgoing_confirmed_at" timestamp with time zone NOT NULL,
	"incoming_confirmed_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rider_shifts" (
	"id" text PRIMARY KEY NOT NULL,
	"rider_id" text NOT NULL,
	"started_by" text NOT NULL,
	"ended_by" text,
	"status" "rider_shift_status" DEFAULT 'active' NOT NULL,
	"note" text,
	"check_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"check_out_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'rider_shift_handovers_outgoing_shift_id_rider_shifts_id_fk'
	) THEN
		ALTER TABLE "rider_shift_handovers" ADD CONSTRAINT "rider_shift_handovers_outgoing_shift_id_rider_shifts_id_fk" FOREIGN KEY ("outgoing_shift_id") REFERENCES "public"."rider_shifts"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'rider_shift_handovers_outgoing_rider_id_users_id_fk'
	) THEN
		ALTER TABLE "rider_shift_handovers" ADD CONSTRAINT "rider_shift_handovers_outgoing_rider_id_users_id_fk" FOREIGN KEY ("outgoing_rider_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'rider_shift_handovers_incoming_rider_id_users_id_fk'
	) THEN
		ALTER TABLE "rider_shift_handovers" ADD CONSTRAINT "rider_shift_handovers_incoming_rider_id_users_id_fk" FOREIGN KEY ("incoming_rider_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'rider_shift_handovers_initiated_by_users_id_fk'
	) THEN
		ALTER TABLE "rider_shift_handovers" ADD CONSTRAINT "rider_shift_handovers_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'rider_shift_handovers_completed_by_users_id_fk'
	) THEN
		ALTER TABLE "rider_shift_handovers" ADD CONSTRAINT "rider_shift_handovers_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'rider_shifts_rider_id_users_id_fk'
	) THEN
		ALTER TABLE "rider_shifts" ADD CONSTRAINT "rider_shifts_rider_id_users_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'rider_shifts_started_by_users_id_fk'
	) THEN
		ALTER TABLE "rider_shifts" ADD CONSTRAINT "rider_shifts_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'rider_shifts_ended_by_users_id_fk'
	) THEN
		ALTER TABLE "rider_shifts" ADD CONSTRAINT "rider_shifts_ended_by_users_id_fk" FOREIGN KEY ("ended_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rider_shift_handovers_outgoing_shift_id_idx" ON "rider_shift_handovers" USING btree ("outgoing_shift_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rider_shift_handovers_outgoing_rider_id_idx" ON "rider_shift_handovers" USING btree ("outgoing_rider_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rider_shift_handovers_incoming_rider_id_idx" ON "rider_shift_handovers" USING btree ("incoming_rider_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rider_shift_handovers_initiated_at_idx" ON "rider_shift_handovers" USING btree ("initiated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rider_shifts_rider_id_idx" ON "rider_shifts" USING btree ("rider_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rider_shifts_status_idx" ON "rider_shifts" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rider_shifts_check_in_at_idx" ON "rider_shifts" USING btree ("check_in_at");
