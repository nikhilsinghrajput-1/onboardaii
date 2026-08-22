DROP TABLE IF EXISTS public.relay_deliveries;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS flow_trigger_url;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS resume_url;
ALTER TABLE public.hires DROP COLUMN IF EXISTS flow_triggered_at;
ALTER TABLE public.hires DROP COLUMN IF EXISTS flow_trigger_error;