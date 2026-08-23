-- Background checks
CREATE TABLE public.background_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hire_id uuid NOT NULL REFERENCES public.hires(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  risk_score int NOT NULL DEFAULT 0,
  summary text,
  ai_error text,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hire_id)
);

CREATE TABLE public.background_check_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  check_id uuid NOT NULL REFERENCES public.background_checks(id) ON DELETE CASCADE,
  category text NOT NULL,
  claim text NOT NULL,
  evidence text,
  verdict text NOT NULL DEFAULT 'pending',
  finding text,
  confidence numeric,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX background_check_claims_check_idx ON public.background_check_claims(check_id);

-- Business intelligence signals
CREATE TABLE public.employee_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hire_id uuid NOT NULL REFERENCES public.hires(id) ON DELETE CASCADE,
  source text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  live boolean NOT NULL DEFAULT false,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hire_id, source)
);

CREATE TABLE public.performance_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hire_id uuid NOT NULL REFERENCES public.hires(id) ON DELETE CASCADE,
  headline text NOT NULL,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  coaching jsonb NOT NULL DEFAULT '[]'::jsonb,
  score int NOT NULL DEFAULT 0,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hire_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.background_checks TO authenticated;
GRANT ALL ON public.background_checks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.background_check_claims TO authenticated;
GRANT ALL ON public.background_check_claims TO service_role;
GRANT SELECT ON public.employee_signals TO authenticated;
GRANT ALL ON public.employee_signals TO service_role;
GRANT SELECT ON public.performance_briefs TO authenticated;
GRANT ALL ON public.performance_briefs TO service_role;

ALTER TABLE public.background_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_check_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_read_bg_checks ON public.background_checks FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY org_write_bg_checks ON public.background_checks FOR INSERT TO authenticated WITH CHECK (public.is_org_member(org_id));
CREATE POLICY org_update_bg_checks ON public.background_checks FOR UPDATE TO authenticated USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));
CREATE POLICY org_delete_bg_checks ON public.background_checks FOR DELETE TO authenticated USING (public.is_org_member(org_id));

CREATE POLICY org_read_bg_claims ON public.background_check_claims FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY org_write_bg_claims ON public.background_check_claims FOR INSERT TO authenticated WITH CHECK (public.is_org_member(org_id));
CREATE POLICY org_update_bg_claims ON public.background_check_claims FOR UPDATE TO authenticated USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));
CREATE POLICY org_delete_bg_claims ON public.background_check_claims FOR DELETE TO authenticated USING (public.is_org_member(org_id));

CREATE POLICY org_read_signals ON public.employee_signals FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY org_read_briefs ON public.performance_briefs FOR SELECT TO authenticated USING (public.is_org_member(org_id));