-- Module tracks
CREATE TABLE public.module_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  role_key text NOT NULL,
  summary text,
  source text NOT NULL DEFAULT 'manual',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_tracks TO authenticated;
GRANT ALL ON public.module_tracks TO service_role;
ALTER TABLE public.module_tracks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.module_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.module_tracks(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  duration_minutes integer NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_items TO authenticated;
GRANT ALL ON public.module_items TO service_role;
ALTER TABLE public.module_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL,
  department text NOT NULL DEFAULT 'Unassigned',
  stage text NOT NULL DEFAULT 'invited',
  notes text,
  track_id uuid REFERENCES public.module_tracks(id) ON DELETE SET NULL,
  user_id uuid,
  invite_sent_at timestamptz,
  invite_error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.candidate_module_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  module_item_id uuid NOT NULL REFERENCES public.module_items(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, module_item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_module_progress TO authenticated;
GRANT ALL ON public.candidate_module_progress TO service_role;
ALTER TABLE public.candidate_module_progress ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.candidate_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  track_id uuid REFERENCES public.module_tracks(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'not_started',
  score integer,
  max_score integer,
  ai_feedback text,
  submitted_at timestamptz,
  graded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_assessments TO authenticated;
GRANT ALL ON public.candidate_assessments TO service_role;
ALTER TABLE public.candidate_assessments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.assessment_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES public.candidate_assessments(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'mcq',
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index integer,
  points integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_questions TO authenticated;
GRANT ALL ON public.assessment_questions TO service_role;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.assessment_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES public.candidate_assessments(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  choice_index integer,
  answer_text text,
  correct boolean,
  ai_score numeric,
  ai_feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_answers TO authenticated;
GRANT ALL ON public.assessment_answers TO service_role;
ALTER TABLE public.assessment_answers ENABLE ROW LEVEL SECURITY;

-- Helper functions for candidate self-access
CREATE OR REPLACE FUNCTION public.is_my_candidate(_candidate_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.candidates WHERE id = _candidate_id AND user_id = auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.is_my_candidate(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_my_candidate(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_my_track(_track_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.candidates WHERE track_id = _track_id AND user_id = auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.is_my_track(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_my_track(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_my_assessment(_assessment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.candidate_assessments a
    JOIN public.candidates c ON c.id = a.candidate_id
    WHERE a.id = _assessment_id AND c.user_id = auth.uid()
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_my_assessment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_my_assessment(uuid) TO authenticated, service_role;

-- Policies: tracks / items
CREATE POLICY tracks_staff_all ON public.module_tracks FOR ALL TO authenticated
  USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));
CREATE POLICY tracks_candidate_read ON public.module_tracks FOR SELECT TO authenticated
  USING (is_my_track(id));

CREATE POLICY items_staff_all ON public.module_items FOR ALL TO authenticated
  USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));
CREATE POLICY items_candidate_read ON public.module_items FOR SELECT TO authenticated
  USING (is_my_track(track_id));

-- Candidates
CREATE POLICY candidates_staff_all ON public.candidates FOR ALL TO authenticated
  USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));
CREATE POLICY candidates_self_read ON public.candidates FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Progress
CREATE POLICY progress_staff_all ON public.candidate_module_progress FOR ALL TO authenticated
  USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));
CREATE POLICY progress_self_read ON public.candidate_module_progress FOR SELECT TO authenticated
  USING (is_my_candidate(candidate_id));
CREATE POLICY progress_self_insert ON public.candidate_module_progress FOR INSERT TO authenticated
  WITH CHECK (is_my_candidate(candidate_id));
CREATE POLICY progress_self_update ON public.candidate_module_progress FOR UPDATE TO authenticated
  USING (is_my_candidate(candidate_id)) WITH CHECK (is_my_candidate(candidate_id));

-- Assessments
CREATE POLICY assessments_staff_all ON public.candidate_assessments FOR ALL TO authenticated
  USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));
CREATE POLICY assessments_self_read ON public.candidate_assessments FOR SELECT TO authenticated
  USING (is_my_candidate(candidate_id));

CREATE POLICY questions_staff_all ON public.assessment_questions FOR ALL TO authenticated
  USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));
CREATE POLICY questions_self_read ON public.assessment_questions FOR SELECT TO authenticated
  USING (is_my_assessment(assessment_id));

CREATE POLICY answers_staff_all ON public.assessment_answers FOR ALL TO authenticated
  USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));
CREATE POLICY answers_self_read ON public.assessment_answers FOR SELECT TO authenticated
  USING (is_my_assessment(assessment_id));
CREATE POLICY answers_self_insert ON public.assessment_answers FOR INSERT TO authenticated
  WITH CHECK (is_my_assessment(assessment_id));
CREATE POLICY answers_self_update ON public.assessment_answers FOR UPDATE TO authenticated
  USING (is_my_assessment(assessment_id)) WITH CHECK (is_my_assessment(assessment_id));

-- updated_at triggers
CREATE TRIGGER module_tracks_touch BEFORE UPDATE ON public.module_tracks FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER module_items_touch BEFORE UPDATE ON public.module_items FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER candidates_touch BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER progress_touch BEFORE UPDATE ON public.candidate_module_progress FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER assessments_touch BEFORE UPDATE ON public.candidate_assessments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER answers_touch BEFORE UPDATE ON public.assessment_answers FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX candidates_org_idx ON public.candidates(org_id, created_at DESC);
CREATE INDEX module_items_track_idx ON public.module_items(track_id, position);
CREATE INDEX progress_candidate_idx ON public.candidate_module_progress(candidate_id);
CREATE INDEX questions_assessment_idx ON public.assessment_questions(assessment_id, position);
CREATE INDEX answers_assessment_idx ON public.assessment_answers(assessment_id);