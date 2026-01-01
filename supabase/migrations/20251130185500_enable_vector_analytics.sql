-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store analytics data for generated protocols (autocuras)
create table if not exists public.autocura_analytics (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.therapy_sessions(id),
  user_id uuid references auth.users(id),
  protocol_type text not null,
  event_description text,
  event_embedding vector(1536), -- Standard OpenAI embedding size
  sentiments text[],
  sentiments_count integer,
  generated_commands_count integer,
  execution_duration_seconds integer,
  created_at timestamp with time zone default now(),
  metadata jsonb default '{}'::jsonb
);

-- Enable RLS for analytics
alter table public.autocura_analytics enable row level security;

-- Policies for analytics
create policy "Users can view their own analytics"
  on public.autocura_analytics
  for select
  using (auth.uid() = user_id);

create policy "System can insert analytics"
  on public.autocura_analytics
  for insert
  with check (auth.uid() = user_id);

-- Create an index for faster similarity search
create index if not exists autocura_analytics_embedding_idx on public.autocura_analytics using ivfflat (event_embedding vector_cosine_ops)
  with (lists = 100);

-- Create table for audio fragments cache (Lego Strategy)
create table if not exists public.audio_fragments_cache (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  voice_id text not null,
  text_content text not null,
  text_hash text not null,
  audio_path text not null,
  created_at timestamp with time zone default now(),
  last_accessed_at timestamp with time zone default now()
);

-- Enable RLS for cache
alter table public.audio_fragments_cache enable row level security;

-- Policies for cache
create policy "Users can view their own cache"
  on public.audio_fragments_cache
  for select
  using (auth.uid() = user_id);

create policy "Users can insert into their own cache"
  on public.audio_fragments_cache
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own cache"
  on public.audio_fragments_cache
  for update
  using (auth.uid() = user_id);

-- Create unique index for fast lookups (Voice + Text Hash)
create unique index if not exists audio_fragments_cache_voice_text_idx on public.audio_fragments_cache (voice_id, text_hash);
