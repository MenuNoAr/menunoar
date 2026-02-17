-- Add subscription fields to restaurants table
ALTER TABLE "restaurants" 
ADD COLUMN IF NOT EXISTS "subscription_plan" text DEFAULT 'free',
ADD COLUMN IF NOT EXISTS "subscription_status" text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;

-- Update RLS to allow system to read/write but users only read their own
-- (Existing policies already cover owner access via owner_id/username pattern usually)
