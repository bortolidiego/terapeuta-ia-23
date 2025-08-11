-- Fix security linter: set immutable search_path on functions
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.increment_sentiment_usage(text) SET search_path = public;