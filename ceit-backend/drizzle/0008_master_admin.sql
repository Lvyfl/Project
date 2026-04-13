-- Add isMasterAdmin flag to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_master_admin" boolean NOT NULL DEFAULT false;

-- Mark lori04@gmail.com as master admin
UPDATE "users" SET "is_master_admin" = true WHERE "email" = 'lori04@gmail.com';
