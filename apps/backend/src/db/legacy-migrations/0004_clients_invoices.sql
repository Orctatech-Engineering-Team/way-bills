DO $$
BEGIN
  CREATE TYPE invoice_status AS ENUM ('issued', 'paid', 'void');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS clients (
  id text PRIMARY KEY,
  name text NOT NULL,
  contact_name text,
  contact_phone text,
  contact_email text,
  billing_address text NOT NULL,
  currency text NOT NULL DEFAULT 'GHS',
  payment_terms_days integer NOT NULL DEFAULT 7,
  default_rate_cents integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS clients_name_unique ON clients (name);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS clients_active_idx ON clients (active);
--> statement-breakpoint
ALTER TABLE waybills
ADD COLUMN IF NOT EXISTS client_id text REFERENCES clients(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS billable_amount_cents integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS waybills_client_id_idx ON waybills (client_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS invoices (
  id text PRIMARY KEY,
  invoice_number text NOT NULL,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  currency text NOT NULL DEFAULT 'GHS',
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  subtotal_cents integer NOT NULL DEFAULT 0,
  status invoice_status NOT NULL DEFAULT 'issued',
  issued_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  paid_at timestamptz,
  notes text,
  created_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS invoices_invoice_number_unique ON invoices (invoice_number);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS invoices_client_id_idx ON invoices (client_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices (status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS invoices_created_at_idx ON invoices (created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS invoice_items (
  id text PRIMARY KEY,
  invoice_id text NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  waybill_id text NOT NULL REFERENCES waybills(id) ON DELETE RESTRICT,
  amount_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx ON invoice_items (invoice_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS invoice_items_waybill_id_unique ON invoice_items (waybill_id);
