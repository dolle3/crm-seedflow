-- Migration v3: Lead detail features
-- Run this in the Supabase SQL Editor

-- Add new columns to leads table
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lost_reason text,
  ADD COLUMN IF NOT EXISTS proposal_timer_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS website_url text;

-- Lead notes table (similar to deal_notes)
CREATE TABLE IF NOT EXISTS public.lead_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage lead_notes"
  ON public.lead_notes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
