CREATE OR REPLACE FUNCTION public.create_organization(_name text, _slug text)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _org public.organizations;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'You need to be signed in.';
  END IF;
  IF coalesce(trim(_name), '') = '' OR coalesce(trim(_slug), '') = '' THEN
    RAISE EXCEPTION 'Organization name is required.';
  END IF;

  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (trim(_name), trim(_slug), _uid)
  RETURNING * INTO _org;

  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (_org.id, _uid, 'owner')
  ON CONFLICT (org_id, user_id) DO NOTHING;

  RETURN _org;
END;
$$;

REVOKE ALL ON FUNCTION public.create_organization(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization(text, text) TO authenticated;