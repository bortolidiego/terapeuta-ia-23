-- Create table for user sentiment filters
CREATE TABLE public.user_sentiment_filters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  sentimentos TEXT[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_sentiment_filters ENABLE ROW LEVEL SECURITY;

-- Create policies for filter management
CREATE POLICY "Everyone can view sentiment filters" 
ON public.user_sentiment_filters 
FOR SELECT 
USING (true);

CREATE POLICY "Everyone can create sentiment filters" 
ON public.user_sentiment_filters 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Everyone can update sentiment filters" 
ON public.user_sentiment_filters 
FOR UPDATE 
USING (true);

CREATE POLICY "Everyone can delete sentiment filters" 
ON public.user_sentiment_filters 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_sentiment_filters_updated_at
BEFORE UPDATE ON public.user_sentiment_filters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();