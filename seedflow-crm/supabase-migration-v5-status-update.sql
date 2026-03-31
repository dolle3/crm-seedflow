-- Migration v5: Update leads status constraint to match new 9-step flow
-- Run this in the Supabase SQL Editor
--
-- Old statuses: hot_lead, existing_client, nurturing, stale
-- New statuses: new_lead, message_sent, no_response, response_received,
--               meeting_planned, meeting_done, proposal_sent, won, lost

-- 1. Drop the old CHECK constraint on leads.status
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;

-- 2. Convert existing leads with old statuses to the new system
UPDATE public.leads SET status = 'new_lead' WHERE status = 'hot_lead';
UPDATE public.leads SET status = 'won' WHERE status = 'existing_client';
UPDATE public.leads SET status = 'response_received' WHERE status = 'nurturing';
UPDATE public.leads SET status = 'no_response' WHERE status = 'stale';

-- 3. Add the new CHECK constraint with all 9 statuses
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check
  CHECK (status IN (
    'new_lead',
    'message_sent',
    'no_response',
    'response_received',
    'meeting_planned',
    'meeting_done',
    'proposal_sent',
    'won',
    'lost'
  ));

-- 4. Update the default value
ALTER TABLE public.leads ALTER COLUMN status SET DEFAULT 'new_lead';
