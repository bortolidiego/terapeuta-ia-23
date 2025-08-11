-- Add router prompt flags to therapist_config
ALTER TABLE public.therapist_config
ADD COLUMN IF NOT EXISTS use_system_defaults boolean NOT NULL DEFAULT true;

ALTER TABLE public.therapist_config
ADD COLUMN IF NOT EXISTS template_version text NOT NULL DEFAULT 'router-v1';

-- Create therapy_facts table
CREATE TABLE IF NOT EXISTS public.therapy_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
  fact_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sentiments JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.therapy_facts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Everyone can view therapy_facts"
ON public.therapy_facts
FOR SELECT
USING (true);

CREATE POLICY "Everyone can insert therapy_facts"
ON public.therapy_facts
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Everyone can update therapy_facts"
ON public.therapy_facts
FOR UPDATE
USING (true);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_therapy_facts_status ON public.therapy_facts (status);
CREATE INDEX IF NOT EXISTS idx_therapy_facts_session ON public.therapy_facts (session_id);

-- updated_at trigger
CREATE TRIGGER update_therapy_facts_updated_at
BEFORE UPDATE ON public.therapy_facts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();