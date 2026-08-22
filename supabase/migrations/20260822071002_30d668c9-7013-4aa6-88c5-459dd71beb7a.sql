CREATE TABLE public.relay_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint_type TEXT NOT NULL CHECK (endpoint_type IN ('task-update','hire-update')),
  callback_url TEXT NOT NULL,
  callback_host TEXT NOT NULL,
  ok BOOLEAN NOT NULL DEFAULT false,
  status_code INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  event TEXT,
  hire_ref TEXT,
  employee_email TEXT,
  payload_preview TEXT,
  response_preview TEXT,
  duration_ms INTEGER,
  source TEXT NOT NULL DEFAULT 'api',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX relay_deliveries_created_at_idx ON public.relay_deliveries (created_at DESC);
CREATE INDEX relay_deliveries_endpoint_idx ON public.relay_deliveries (endpoint_type, created_at DESC);

GRANT SELECT ON public.relay_deliveries TO authenticated;
GRANT ALL ON public.relay_deliveries TO service_role;

ALTER TABLE public.relay_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read relay deliveries"
  ON public.relay_deliveries FOR SELECT TO authenticated USING (true);