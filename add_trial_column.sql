-- Add trial_ends_at column to restaurants
ALTER TABLE "restaurants" 
ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp with time zone;
