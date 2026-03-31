-- Migration v6: Proposals table
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.proposals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  subtotal numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 21,
  vat_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  validity_days integer DEFAULT 14,
  valid_until timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Proposals viewable by authenticated"
  ON public.proposals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Proposals insertable by authenticated roles"
  ON public.proposals FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin', 'manager', 'sales'));

CREATE POLICY "Proposals updatable by authenticated roles"
  ON public.proposals FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('admin', 'manager', 'sales'))
  WITH CHECK (public.current_user_role() IN ('admin', 'manager', 'sales'));

CREATE POLICY "Proposals deletable by admins"
  ON public.proposals FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');
