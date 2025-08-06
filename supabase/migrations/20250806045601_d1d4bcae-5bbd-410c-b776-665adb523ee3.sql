-- Create function to increment sentiment usage
CREATE OR REPLACE FUNCTION increment_sentiment_usage(sentiment_name TEXT)
RETURNS void AS $$
BEGIN
  UPDATE public.sentimentos 
  SET frequencia_uso = frequencia_uso + 1,
      ultima_selecao = now()
  WHERE nome = sentiment_name;
END;
$$ LANGUAGE plpgsql;