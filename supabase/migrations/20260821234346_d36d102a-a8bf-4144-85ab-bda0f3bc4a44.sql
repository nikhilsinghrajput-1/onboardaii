-- Organizations: owners may delete their own organization
CREATE POLICY "org_delete" ON public.organizations
  FOR DELETE TO authenticated
  USING (public.is_org_owner(id));

-- Hires: org members may manage hires of their own organization
CREATE POLICY "org_insert_hires" ON public.hires
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "org_update_hires" ON public.hires
  FOR UPDATE TO authenticated
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "org_delete_hires" ON public.hires
  FOR DELETE TO authenticated
  USING (public.is_org_owner(org_id));

-- Onboarding tasks: org members may manage tasks of their own organization
CREATE POLICY "org_insert_tasks" ON public.onboarding_tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "org_update_tasks" ON public.onboarding_tasks
  FOR UPDATE TO authenticated
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "org_delete_tasks" ON public.onboarding_tasks
  FOR DELETE TO authenticated
  USING (public.is_org_owner(org_id));

-- Alert log: written only by server-side automation; owners may clear their own history
CREATE POLICY "org_delete_alerts" ON public.alert_log
  FOR DELETE TO authenticated
  USING (public.is_org_owner(org_id));

-- Connector credentials: members can see which tools are connected, but never the secret material
REVOKE ALL ON public.org_connections FROM authenticated;
GRANT SELECT (id, org_id, connector_id, connected_by, created_at, updated_at)
  ON public.org_connections TO authenticated;
GRANT ALL ON public.org_connections TO service_role;

CREATE POLICY "org_read_connections" ON public.org_connections
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY "org_delete_connections" ON public.org_connections
  FOR DELETE TO authenticated
  USING (public.is_org_owner(org_id));

-- Trigger helper does not need to be callable by API roles
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC;