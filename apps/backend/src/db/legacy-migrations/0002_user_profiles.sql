ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "profile_image_url" text,
ADD COLUMN IF NOT EXISTS "profile_image_mime_type" text,
ADD COLUMN IF NOT EXISTS "vehicle_type" text,
ADD COLUMN IF NOT EXISTS "vehicle_plate_number" text,
ADD COLUMN IF NOT EXISTS "license_number" text,
ADD COLUMN IF NOT EXISTS "address" text,
ADD COLUMN IF NOT EXISTS "notes" text;
