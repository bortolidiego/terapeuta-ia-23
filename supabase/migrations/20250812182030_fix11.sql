-- Associar todas as sessões existentes sem user_id ao usuário admin bortolidiego@gmail.com
UPDATE public.therapy_sessions 
SET user_id = (
  SELECT id 
  FROM auth.users 
  WHERE email = 'bortolidiego@gmail.com'
)
WHERE user_id IS NULL;

-- Verificar quantas sessões foram atualizadas
SELECT 
  COUNT(*) as total_sessions_updated,
  user_id
FROM public.therapy_sessions 
WHERE user_id = (
  SELECT id 
  FROM auth.users 
  WHERE email = 'bortolidiego@gmail.com'
)
GROUP BY user_id;