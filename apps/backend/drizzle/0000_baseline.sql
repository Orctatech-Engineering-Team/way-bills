CREATE TYPE "public"."document_type" AS ENUM('waybill_pdf', 'pod_pdf');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('issued', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'ops', 'rider');--> statement-breakpoint
CREATE TYPE "public"."waybill_status" AS ENUM('created', 'assigned', 'dispatched', 'delivered', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"contact_phone" text,
	"contact_email" text,
	"billing_address" text NOT NULL,
	"currency" text DEFAULT 'GHS' NOT NULL,
	"payment_terms_days" integer DEFAULT 7 NOT NULL,
	"default_rate_cents" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"waybill_id" text NOT NULL,
	"type" "document_type" NOT NULL,
	"file_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"waybill_id" text NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"client_id" text NOT NULL,
	"currency" text DEFAULT 'GHS' NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"status" "invoice_status" DEFAULT 'issued' NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proof_of_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"waybill_id" text NOT NULL,
	"recipient_name" text NOT NULL,
	"signature_file_url" text NOT NULL,
	"signature_mime_type" text NOT NULL,
	"signature_captured_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"note" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"waybill_id" text NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"changed_by" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"profile_image_url" text,
	"profile_image_mime_type" text,
	"vehicle_type" text,
	"vehicle_plate_number" text,
	"license_number" text,
	"address" text,
	"notes" text,
	"role" "user_role" NOT NULL,
	"password_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waybills" (
	"id" text PRIMARY KEY NOT NULL,
	"waybill_number" text NOT NULL,
	"order_reference" text NOT NULL,
	"client_id" text,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"delivery_address" text NOT NULL,
	"billable_amount_cents" integer DEFAULT 0 NOT NULL,
	"receipt_image_url" text,
	"receipt_image_mime_type" text,
	"notes" text,
	"requested_dispatch_time" timestamp with time zone,
	"dispatch_time" timestamp with time zone,
	"completion_time" timestamp with time zone,
	"assigned_rider_id" text,
	"status" "waybill_status" DEFAULT 'created' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_waybill_id_waybills_id_fk" FOREIGN KEY ("waybill_id") REFERENCES "public"."waybills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_waybill_id_waybills_id_fk" FOREIGN KEY ("waybill_id") REFERENCES "public"."waybills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_of_deliveries" ADD CONSTRAINT "proof_of_deliveries_waybill_id_waybills_id_fk" FOREIGN KEY ("waybill_id") REFERENCES "public"."waybills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_of_deliveries" ADD CONSTRAINT "proof_of_deliveries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_logs" ADD CONSTRAINT "status_logs_waybill_id_waybills_id_fk" FOREIGN KEY ("waybill_id") REFERENCES "public"."waybills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_logs" ADD CONSTRAINT "status_logs_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waybills" ADD CONSTRAINT "waybills_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waybills" ADD CONSTRAINT "waybills_assigned_rider_id_users_id_fk" FOREIGN KEY ("assigned_rider_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waybills" ADD CONSTRAINT "waybills_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_name_unique" ON "clients" USING btree ("name");--> statement-breakpoint
CREATE INDEX "clients_active_idx" ON "clients" USING btree ("active");--> statement-breakpoint
CREATE INDEX "documents_waybill_id_idx" ON "documents" USING btree ("waybill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_waybill_type_unique" ON "documents" USING btree ("waybill_id","type");--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_items_waybill_id_unique" ON "invoice_items" USING btree ("waybill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_invoice_number_unique" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_client_id_idx" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_created_at_idx" ON "invoices" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "proof_of_deliveries_waybill_id_unique" ON "proof_of_deliveries" USING btree ("waybill_id");--> statement-breakpoint
CREATE INDEX "status_logs_waybill_id_idx" ON "status_logs" USING btree ("waybill_id");--> statement-breakpoint
CREATE INDEX "status_logs_changed_at_idx" ON "status_logs" USING btree ("changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_unique" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "waybills_waybill_number_unique" ON "waybills" USING btree ("waybill_number");--> statement-breakpoint
CREATE INDEX "waybills_client_id_idx" ON "waybills" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "waybills_status_idx" ON "waybills" USING btree ("status");--> statement-breakpoint
CREATE INDEX "waybills_assigned_rider_idx" ON "waybills" USING btree ("assigned_rider_id");--> statement-breakpoint
CREATE INDEX "waybills_completion_time_idx" ON "waybills" USING btree ("completion_time");--> statement-breakpoint
CREATE INDEX "waybills_created_at_idx" ON "waybills" USING btree ("created_at");