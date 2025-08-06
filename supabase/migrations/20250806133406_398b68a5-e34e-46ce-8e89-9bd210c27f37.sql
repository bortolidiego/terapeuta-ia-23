-- Remover o sentimento "raivas" dos sentimentos personalizados
DELETE FROM public.sentimentos WHERE nome = 'raivas' AND categoria = 'personalizado';