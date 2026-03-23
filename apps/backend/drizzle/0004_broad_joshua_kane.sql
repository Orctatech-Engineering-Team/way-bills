CREATE TABLE "automation_job_statuses" (
	"job_name" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"running" boolean DEFAULT false NOT NULL,
	"interval_minutes" integer DEFAULT 15 NOT NULL,
	"lookback_weeks" integer DEFAULT 8 NOT NULL,
	"last_run_started_at" timestamp with time zone,
	"last_run_finished_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"last_error" text,
	"last_invoice_summary" text,
	"last_email_summary" text,
	"last_email_failure_at" timestamp with time zone,
	"last_email_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "automation_job_statuses_updated_at_idx" ON "automation_job_statuses" USING btree ("updated_at");