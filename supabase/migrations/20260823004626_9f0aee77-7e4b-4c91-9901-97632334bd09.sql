DROP POLICY IF EXISTS questions_self_read ON public.assessment_questions;
DROP POLICY IF EXISTS answers_self_read ON public.assessment_answers;
DROP POLICY IF EXISTS answers_self_insert ON public.assessment_answers;
DROP POLICY IF EXISTS answers_self_update ON public.assessment_answers;