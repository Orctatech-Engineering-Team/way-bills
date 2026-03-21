ALTER TABLE "waybills"
ADD COLUMN IF NOT EXISTS "receipt_image_url" text,
ADD COLUMN IF NOT EXISTS "receipt_image_mime_type" text;
