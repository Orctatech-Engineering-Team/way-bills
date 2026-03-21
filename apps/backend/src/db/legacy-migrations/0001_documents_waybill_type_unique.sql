CREATE UNIQUE INDEX IF NOT EXISTS documents_waybill_type_unique
ON documents (waybill_id, type);
