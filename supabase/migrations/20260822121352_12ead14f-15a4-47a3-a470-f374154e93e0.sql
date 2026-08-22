UPDATE public.onboarding_tasks SET status='completed', error_message=NULL, updated_at=now()
WHERE system='slack' AND action='create_onboarding_channel' AND status IN ('in_progress','not_started')
AND hire_id IN (SELECT id FROM public.hires WHERE slack_channel_id IS NOT NULL);