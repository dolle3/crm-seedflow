-- ============================================================
-- Seedflow CRM - Migration v2: Link deals to leads
-- Run this in Supabase SQL Editor AFTER the initial schema
-- ============================================================

-- Add lead_id to deals if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deals' AND column_name = 'lead_id'
  ) THEN
    ALTER TABLE public.deals ADD COLUMN lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;
  END IF;
END $$;
