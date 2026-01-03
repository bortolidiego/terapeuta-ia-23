-- Create usage_tracking table
create table if not exists usage_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  service text not null,
  operation_type text not null,
  tokens_used integer,
  cost_usd numeric(10, 4),
  metadata jsonb,
  created_at timestamptz default now()
);

-- Enable RLS for usage_tracking
alter table usage_tracking enable row level security;

create policy "Users can view their own usage"
on usage_tracking for select
to authenticated
using (auth.uid() = user_id);

-- Create user_notifications table
create table if not exists user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  type text not null,
  title text not null,
  message text not null,
  metadata jsonb,
  read boolean default false,
  created_at timestamptz default now()
);

-- Enable RLS for user_notifications
alter table user_notifications enable row level security;

create policy "Users can view their own notifications"
on user_notifications for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can update their own notifications"
on user_notifications for update
to authenticated
using (auth.uid() = user_id);
