-- Migration v7: Add closed_at column to leads
-- Run this in the Supabase SQL Editor

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- Backfill: set closed_at for leads already marked as won or lost
UPDATE public.leads SET closed_at = updated_at WHERE status IN ('won', 'lost') AND closed_at IS NULL;
