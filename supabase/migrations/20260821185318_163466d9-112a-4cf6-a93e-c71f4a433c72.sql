CREATE TYPE public.task_status AS ENUM ('not_started','in_progress','completed','failed','needs_human');
CREATE TYPE public.approval_decision AS ENUM ('approved','rejected');

CREATE TABLE public.hires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  full_name text NOT NULL,
  email text,
  role text NOT NULL,
  department text NOT NULL,
  seniority text,
  employment_type text,
  location text,
  start_date date,
  pii_access boolean NOT NULL DEFAULT false,
  on_call boolean NOT NULL DEFAULT false,
  direct_reports boolean NOT NULL DEFAULT false,
  owning_team text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hire_id uuid NOT NULL REFERENCES public.hires(id) ON DELETE CASCADE,
  external_task_id text,
  system text NOT NULL,
  action text NOT NULL,
  reason text,
  confidence numeric,
  sensitive boolean NOT NULL DEFAULT false,
  status public.task_status NOT NULL DEFAULT 'not_started',
  retry_count integer NOT NULL DEFAULT 0,
  error_message text,
  raw_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hire_id, system, action)
);

CREATE TABLE public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.onboarding_tasks(id) ON DELETE CASCADE,
  decision public.approval_decision NOT NULL,
  note text NOT NULL,
  decided_by uuid,
  decided_by_label text,
  channel text NOT NULL DEFAULT 'in_app',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.onboarding_tasks(id) ON DELETE CASCADE,
  hire_id uuid REFERENCES public.hires(id) ON DELETE CASCADE,
  kind text NOT NULL,
  channel text NOT NULL,
  detail text,
  send_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_hire ON public.onboarding_tasks(hire_id);
CREATE INDEX idx_tasks_status ON public.onboarding_tasks(status);
CREATE INDEX idx_approvals_task ON public.approvals(task_id);

GRANT SELECT ON public.hires TO authenticated;
GRANT SELECT ON public.onboarding_tasks TO authenticated;
GRANT SELECT, INSERT ON public.approvals TO authenticated;
GRANT SELECT ON public.alert_log TO authenticated;
GRANT ALL ON public.hires TO service_role;
GRANT ALL ON public.onboarding_tasks TO service_role;
GRANT ALL ON public.approvals TO service_role;
GRANT ALL ON public.alert_log TO service_role;

ALTER TABLE public.hires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signed_in_read_hires" ON public.hires FOR SELECT TO authenticated USING (true);
CREATE POLICY "signed_in_read_tasks" ON public.onboarding_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "signed_in_read_approvals" ON public.approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "signed_in_insert_approvals" ON public.approvals FOR INSERT TO authenticated WITH CHECK (decided_by = auth.uid());
CREATE POLICY "signed_in_read_alerts" ON public.alert_log FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER hires_touch BEFORE UPDATE ON public.hires FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER tasks_touch BEFORE UPDATE ON public.onboarding_tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.hires;
ALTER PUBLICATION supabase_realtime ADD TABLE public.onboarding_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.approvals;