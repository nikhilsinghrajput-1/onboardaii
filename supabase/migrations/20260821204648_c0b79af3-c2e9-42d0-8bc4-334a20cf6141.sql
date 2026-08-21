ALTER TABLE public.organizations
  ADD COLUMN slack_approval_channel text,
  ADD COLUMN slack_alert_channel text,
  ADD COLUMN resume_url text;