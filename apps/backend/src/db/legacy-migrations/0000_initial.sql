DO $$
BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'ops', 'rider');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE waybill_status AS ENUM ('created', 'assigned', 'dispatched', 'delivered', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE document_type AS ENUM ('waybill_pdf', 'pod_pdf');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL,
  role user_role NOT NULL,
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users (phone);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS waybills (
  id text PRIMARY KEY,
  waybill_number text NOT NULL,
  order_reference text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  delivery_address text NOT NULL,
  notes text,
  requested_dispatch_time timestamptz,
  dispatch_time timestamptz,
  completion_time timestamptz,
  assigned_rider_id text REFERENCES users(id) ON DELETE SET NULL,
  status waybill_status NOT NULL DEFAULT 'created',
  created_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS waybills_waybill_number_unique ON waybills (waybill_number);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS waybills_status_idx ON waybills (status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS waybills_assigned_rider_idx ON waybills (assigned_rider_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS waybills_completion_time_idx ON waybills (completion_time);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS waybills_created_at_idx ON waybills (created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS proof_of_deliveries (
  id text PRIMARY KEY,
  waybill_id text NOT NULL REFERENCES waybills(id) ON DELETE CASCADE,
  recipient_name text NOT NULL,
  signature_file_url text NOT NULL,
  signature_mime_type text NOT NULL,
  signature_captured_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  note text,
  created_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS proof_of_deliveries_waybill_id_unique ON proof_of_deliveries (waybill_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS status_logs (
  id text PRIMARY KEY,
  waybill_id text NOT NULL REFERENCES waybills(id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  changed_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS status_logs_waybill_id_idx ON status_logs (waybill_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS status_logs_changed_at_idx ON status_logs (changed_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS documents (
  id text PRIMARY KEY,
  waybill_id text NOT NULL REFERENCES waybills(id) ON DELETE CASCADE,
  type document_type NOT NULL,
  file_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS documents_waybill_id_idx ON documents (waybill_id);
