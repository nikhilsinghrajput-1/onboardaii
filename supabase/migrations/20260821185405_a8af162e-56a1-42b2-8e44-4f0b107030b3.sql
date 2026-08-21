INSERT INTO public.hires (id, external_id, full_name, email, role, department, seniority, employment_type, location, start_date, pii_access, on_call, direct_reports, owning_team) VALUES
('11111111-1111-1111-1111-111111111111','WD-10041','Amara Osei','amara.osei@example.com','Senior Backend Engineer','Engineering','senior','full_time','Berlin, DE','2026-09-01', false, true, false, 'Platform'),
('22222222-2222-2222-2222-222222222222','WD-10042','Diego Marín','diego.marin@example.com','Payroll Analyst','Finance','mid','full_time','Mexico City, MX','2026-08-31', true, false, false, 'Finance Ops'),
('33333333-3333-3333-3333-333333333333','WD-10043','Priya Nair','priya.nair@example.com','Engineering Manager','Engineering','lead','full_time','Bengaluru, IN','2026-09-07', false, true, true, 'Platform');

INSERT INTO public.onboarding_tasks (hire_id, external_task_id, system, action, reason, confidence, sensitive, status, retry_count, error_message, raw_response) VALUES
('11111111-1111-1111-1111-111111111111','T-1','Google Workspace','create_account','Every hire needs a mailbox and calendar',0.99,false,'completed',0,NULL,NULL),
('11111111-1111-1111-1111-111111111111','T-2','Slack','invite_to_workspace','Standard for all hires',0.98,false,'completed',0,NULL,NULL),
('11111111-1111-1111-1111-111111111111','T-3','GitHub','add_to_org_backend_team','Backend engineer needs repo access',0.94,false,'in_progress',0,NULL,NULL),
('11111111-1111-1111-1111-111111111111','T-4','Okta','assign_prod_access_group','On-call rotation requires production access',0.71,true,'needs_human',0,NULL,NULL),
('11111111-1111-1111-1111-111111111111','T-5','PagerDuty','add_to_on_call_schedule','On-call flag is set',0.88,false,'failed',3,'403 Forbidden from PagerDuty','{"error":{"message":"Caller is not authorized to perform this action","code":2012},"request_id":"6f1c-9a"}'),
('22222222-2222-2222-2222-222222222222','T-6','Google Workspace','create_account','Every hire needs a mailbox and calendar',0.99,false,'completed',0,NULL,NULL),
('22222222-2222-2222-2222-222222222222','T-7','NetSuite','grant_payroll_module_read','Payroll analyst needs financial system access',0.62,true,'needs_human',0,NULL,NULL),
('22222222-2222-2222-2222-222222222222','T-8','Jira','add_to_finance_project','Team project membership',0.91,false,'completed',0,NULL,NULL),
('22222222-2222-2222-2222-222222222222','T-9','Okta','assign_pii_training_group','PII access flag requires mandatory training',0.83,true,'needs_human',0,NULL,NULL),
('33333333-3333-3333-3333-333333333333','T-10','Google Workspace','create_account','Every hire needs a mailbox and calendar',0.99,false,'completed',0,NULL,NULL),
('33333333-3333-3333-3333-333333333333','T-11','Slack','invite_to_workspace','Standard for all hires',0.98,false,'completed',0,NULL,NULL),
('33333333-3333-3333-3333-333333333333','T-12','Workday','enable_manager_self_service','Hire has direct reports',0.86,false,'in_progress',1,NULL,NULL),
('33333333-3333-3333-3333-333333333333','T-13','GitHub','add_to_org_owners_readonly','Manager needs org-wide visibility',0.55,true,'needs_human',0,NULL,NULL),
('33333333-3333-3333-3333-333333333333','T-14','Lattice','create_review_cycle_membership','Manager onboarding checklist',0.79,false,'not_started',0,NULL,NULL);

INSERT INTO public.alert_log (task_id, hire_id, kind, channel, detail)
SELECT id, hire_id, 'task_failed', 'slack', 'PagerDuty returned 403 Forbidden after 3 retries'
FROM public.onboarding_tasks WHERE external_task_id = 'T-5';