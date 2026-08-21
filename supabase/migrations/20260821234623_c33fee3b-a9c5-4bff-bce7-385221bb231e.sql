ALTER TABLE public.hires
  ADD COLUMN IF NOT EXISTS slack_channel_id text,
  ADD COLUMN IF NOT EXISTS slack_channel_name text,
  ADD COLUMN IF NOT EXISTS slack_channel_error text;