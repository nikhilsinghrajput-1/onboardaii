ALTER TABLE public.hires
  ADD CONSTRAINT hires_org_id_external_id_key UNIQUE (org_id, external_id);