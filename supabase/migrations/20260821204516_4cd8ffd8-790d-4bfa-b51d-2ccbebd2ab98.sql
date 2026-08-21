-- enums
CREATE TYPE public.org_role AS ENUM ('owner', 'member');

-- organizations
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  webhook_secret text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.org_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE TABLE public.org_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connector_id text NOT NULL,
  connection_key_ciphertext text NOT NULL,
  connected_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, connector_id)
);

GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
GRANT SELECT, INSERT, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
GRANT ALL ON public.org_connections TO service_role;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_connections ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = _org_id AND user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = _org_id AND user_id = auth.uid() AND role = 'owner'
  )
$$;

CREATE POLICY org_read ON public.organizations
  FOR SELECT TO authenticated USING (public.is_org_member(id));
CREATE POLICY org_insert ON public.organizations
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY org_update ON public.organizations
  FOR UPDATE TO authenticated USING (public.is_org_owner(id)) WITH CHECK (public.is_org_owner(id));

CREATE POLICY org_members_read ON public.organization_members
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY org_members_insert_self ON public.organization_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY org_members_delete_self ON public.organization_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER organizations_touch BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER org_connections_touch BEFORE UPDATE ON public.org_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- scope existing data to organizations (tables are empty)
ALTER TABLE public.hires ADD COLUMN org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.onboarding_tasks ADD COLUMN org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.approvals ADD COLUMN org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.alert_log ADD COLUMN org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX hires_org_idx ON public.hires(org_id);
CREATE INDEX tasks_org_idx ON public.onboarding_tasks(org_id);
CREATE INDEX approvals_org_idx ON public.approvals(org_id);
CREATE INDEX alerts_org_idx ON public.alert_log(org_id);

-- hires: external_id must be unique per org
ALTER TABLE public.hires DROP CONSTRAINT IF EXISTS hires_external_id_key;
CREATE UNIQUE INDEX hires_org_external_id_key ON public.hires(org_id, external_id) WHERE external_id IS NOT NULL;

DROP POLICY IF EXISTS signed_in_read_hires ON public.hires;
DROP POLICY IF EXISTS signed_in_read_tasks ON public.onboarding_tasks;
DROP POLICY IF EXISTS signed_in_read_approvals ON public.approvals;
DROP POLICY IF EXISTS signed_in_insert_approvals ON public.approvals;
DROP POLICY IF EXISTS signed_in_read_alerts ON public.alert_log;

CREATE POLICY org_read_hires ON public.hires
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY org_read_tasks ON public.onboarding_tasks
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY org_read_approvals ON public.approvals
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY org_insert_approvals ON public.approvals
  FOR INSERT TO authenticated WITH CHECK (decided_by = auth.uid() AND public.is_org_member(org_id));
CREATE POLICY org_read_alerts ON public.alert_log
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));