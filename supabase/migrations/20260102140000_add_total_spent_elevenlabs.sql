-- Add total_spent_elevenlabs column to user_credits table
ALTER TABLE public.user_credits 
ADD COLUMN IF NOT EXISTS total_spent_elevenlabs NUMERIC DEFAULT 0;

-- Ensure it's visible to the API if needed (usually automatic, but good to check permissions if RLS is strict)
-- (Assuming RLS policies are dynamic or already cover 'all columns', which is standard)
