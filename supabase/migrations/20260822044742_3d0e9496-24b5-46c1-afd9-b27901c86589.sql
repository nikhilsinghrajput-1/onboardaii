ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS flow_trigger_url text;
ALTER TABLE public.hires ADD COLUMN IF NOT EXISTS flow_triggered_at timestamptz;
ALTER TABLE public.hires ADD COLUMN IF NOT EXISTS flow_trigger_error text;