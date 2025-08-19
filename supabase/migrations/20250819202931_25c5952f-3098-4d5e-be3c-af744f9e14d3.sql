-- Clean up duplicate audio library entries and standardize paths
-- Keep only the most recent entry for each component_key per user
WITH ranked_entries AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, component_key 
      ORDER BY updated_at DESC, created_at DESC
    ) as rn
  FROM user_audio_library
)
DELETE FROM user_audio_library 
WHERE id IN (
  SELECT id FROM ranked_entries WHERE rn > 1
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE user_audio_library 
ADD CONSTRAINT unique_user_component 
UNIQUE (user_id, component_key);

-- Update existing audio paths to use standardized format where needed
UPDATE user_audio_library 
SET audio_path = CASE
  WHEN audio_path NOT LIKE 'user-audio-library/%' 
  THEN 'user-audio-library/' || user_id || '/' || audio_path
  ELSE audio_path
END
WHERE audio_path IS NOT NULL;