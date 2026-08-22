-- One organization only.
CREATE UNIQUE INDEX organizations_singleton ON public.organizations ((true));
DROP FUNCTION IF EXISTS public.create_organization(text, text);

-- Members become an invite list keyed by email; user_id is filled on first sign-in.
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS email text,
  ALTER COLUMN user_id DROP NOT NULL;

UPDATE public.organization_members m
SET email = u.email
FROM auth.users u
WHERE u.id = m.user_id AND m.email IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organization_members_email_key
  ON public.organization_members (org_id, lower(email));

-- Links a pending invite to the signed-in user when the email matches.
CREATE OR REPLACE FUNCTION public.claim_membership()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  _claimed int := 0;
BEGIN
  IF _uid IS NULL OR _email = '' THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = _uid) THEN
    RETURN true;
  END IF;

  UPDATE public.organization_members
  SET user_id = _uid
  WHERE user_id IS NULL AND lower(email) = _email;

  GET DIAGNOSTICS _claimed = ROW_COUNT;
  RETURN _claimed > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_membership() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_membership() TO authenticated;

-- Owners manage the member list; nobody can self-insert any more.
DROP POLICY IF EXISTS org_members_insert_self ON public.organization_members;
DROP POLICY IF EXISTS org_members_delete_self ON public.organization_members;

CREATE POLICY org_members_owner_insert ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_owner(org_id));

CREATE POLICY org_members_owner_update ON public.organization_members
  FOR UPDATE TO authenticated
  USING (public.is_org_owner(org_id))
  WITH CHECK (public.is_org_owner(org_id));

CREATE POLICY org_members_delete ON public.organization_members
  FOR DELETE TO authenticated
  USING (public.is_org_owner(org_id) OR user_id = auth.uid());
