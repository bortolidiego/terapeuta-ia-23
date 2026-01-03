-- Migration: Create credit_purchases table and update profiles for Asaas integration

-- 1. Criar tabela credit_purchases
CREATE TABLE IF NOT EXISTS public.credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asaas_payment_id TEXT,
  package_name TEXT NOT NULL,
  llm_credits_added INTEGER NOT NULL DEFAULT 0,
  voice_credits_added INTEGER NOT NULL DEFAULT 0,
  amount_brl DECIMAL(10,2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('pix', 'credit_card', 'boleto')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. Adicionar coluna asaas_customer_id na tabela profiles (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'asaas_customer_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN asaas_customer_id TEXT;
  END IF;
END $$;

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_credit_purchases_user_id ON public.credit_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_status ON public.credit_purchases(status);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_asaas_payment_id ON public.credit_purchases(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_profiles_asaas_customer_id ON public.profiles(asaas_customer_id);

-- 4. Habilitar RLS
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS
-- Usuário pode ver suas próprias compras
CREATE POLICY "Users can view own purchases"
  ON public.credit_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

-- Usuário pode criar compras para si mesmo
CREATE POLICY "Users can create own purchases"
  ON public.credit_purchases
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role pode fazer tudo (para o webhook)
CREATE POLICY "Service role full access"
  ON public.credit_purchases
  FOR ALL
  USING (auth.role() = 'service_role');

-- 6. Adicionar coluna provider e model na usage_tracking (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'usage_tracking' 
    AND column_name = 'provider'
  ) THEN
    ALTER TABLE public.usage_tracking ADD COLUMN provider TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'usage_tracking' 
    AND column_name = 'model'
  ) THEN
    ALTER TABLE public.usage_tracking ADD COLUMN model TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'usage_tracking' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.usage_tracking ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 7. Trigger para atualizar créditos automaticamente quando compra é confirmada
CREATE OR REPLACE FUNCTION public.handle_purchase_confirmation()
RETURNS TRIGGER AS $$
BEGIN
  -- Só executa quando status muda para 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    -- Atualizar créditos do usuário
    UPDATE public.user_credits
    SET 
      openai_credits = COALESCE(openai_credits, 0) + NEW.llm_credits_added,
      elevenlabs_credits = COALESCE(elevenlabs_credits, 0) + NEW.voice_credits_added,
      updated_at = now()
    WHERE user_id = NEW.user_id;
    
    -- Se não existir registro de créditos, criar
    IF NOT FOUND THEN
      INSERT INTO public.user_credits (user_id, openai_credits, elevenlabs_credits)
      VALUES (NEW.user_id, NEW.llm_credits_added, NEW.voice_credits_added);
    END IF;
    
    -- Atualizar confirmed_at
    NEW.confirmed_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger
DROP TRIGGER IF EXISTS on_purchase_confirmed ON public.credit_purchases;
CREATE TRIGGER on_purchase_confirmed
  BEFORE UPDATE ON public.credit_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_purchase_confirmation();

-- 8. Comentários para documentação
COMMENT ON TABLE public.credit_purchases IS 'Histórico de compras de créditos via Asaas';
COMMENT ON COLUMN public.credit_purchases.asaas_payment_id IS 'ID do pagamento no Asaas';
COMMENT ON COLUMN public.credit_purchases.package_name IS 'Nome do pacote: Básico, Premium, Pro';
COMMENT ON COLUMN public.credit_purchases.llm_credits_added IS 'Créditos LLM adicionados';
COMMENT ON COLUMN public.credit_purchases.voice_credits_added IS 'Créditos de voz adicionados';
COMMENT ON COLUMN public.credit_purchases.payment_method IS 'Método: pix, credit_card, boleto';
COMMENT ON COLUMN public.credit_purchases.status IS 'Status: pending, confirmed, failed, refunded';
