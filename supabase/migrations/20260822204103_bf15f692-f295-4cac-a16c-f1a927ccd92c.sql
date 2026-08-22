ALTER TABLE public.hires
  ADD COLUMN IF NOT EXISTS calendar_orientation_event_id text,
  ADD COLUMN IF NOT EXISTS calendar_first_1on1_event_id text,
  ADD COLUMN IF NOT EXISTS drive_folder_id text,
  ADD COLUMN IF NOT EXISTS drive_folder_url text,
  ADD COLUMN IF NOT EXISTS notion_page_id text,
  ADD COLUMN IF NOT EXISTS notion_page_url text,
  ADD COLUMN IF NOT EXISTS sheets_row_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS teams_notified_at timestamptz;

CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hire_id uuid REFERENCES public.hires(id) ON DELETE SET NULL,
  tool text NOT NULL,
  action text NOT NULL,
  outcome text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_read_activity ON public.activity_log FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY org_delete_activity ON public.activity_log FOR DELETE TO authenticated USING (public.is_org_owner(org_id));

CREATE INDEX IF NOT EXISTS activity_log_org_created_idx ON public.activity_log (org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  briefing_date date NOT NULL DEFAULT (now()::date),
  summary text NOT NULL,
  next_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, briefing_date)
);

GRANT SELECT ON public.ai_briefings TO authenticated;
GRANT ALL ON public.ai_briefings TO service_role;
ALTER TABLE public.ai_briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_read_briefings ON public.ai_briefings FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY org_delete_briefings ON public.ai_briefings FOR DELETE TO authenticated USING (public.is_org_owner(org_id));