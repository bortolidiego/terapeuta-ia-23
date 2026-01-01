-- Inserir o usuário bortolidiego@gmail.com como admin na tabela user_roles
-- Primeiro, verificar se o usuário existe em auth.users e obter seu ID
INSERT INTO public.user_roles (user_id, role)
SELECT 
  id, 
  'admin'::app_role
FROM auth.users 
WHERE email = 'bortolidiego@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Verificar se a inserção foi bem-sucedida
SELECT 
  ur.user_id,
  ur.role,
  au.email
FROM public.user_roles ur
JOIN auth.users au ON ur.user_id = au.id
WHERE au.email = 'bortolidiego@gmail.com';