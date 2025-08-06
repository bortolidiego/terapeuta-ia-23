-- Create sentimentos table for managing user sentiment selections
CREATE TABLE public.sentimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('base_contexto', 'gerado_contexto', 'personalizado')),
  criado_por TEXT NOT NULL CHECK (criado_por IN ('sistema', 'usuario')),
  frequencia_uso INTEGER NOT NULL DEFAULT 0,
  ultima_selecao TIMESTAMP WITH TIME ZONE,
  contexto TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sentimentos ENABLE ROW LEVEL SECURITY;

-- Create policies for universal access (as per existing pattern)
CREATE POLICY "Everyone can view sentimentos" 
ON public.sentimentos 
FOR SELECT 
USING (true);

CREATE POLICY "Everyone can create sentimentos" 
ON public.sentimentos 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Everyone can update sentimentos" 
ON public.sentimentos 
FOR UPDATE 
USING (true);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_sentimentos_updated_at
BEFORE UPDATE ON public.sentimentos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();