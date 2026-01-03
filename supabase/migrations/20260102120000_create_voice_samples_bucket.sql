-- Create the voice_samples bucket
insert into storage.buckets (id, name, public)
values ('voice_samples', 'voice_samples', false)
on conflict (id) do nothing;

-- Set up RLS for the voice_samples bucket

-- Allow authenticated users to upload files to their own folder
create policy "Users can upload their own voice samples"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'voice_samples' and
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to view their own files
create policy "Users can view their own voice samples"
on storage.objects for select
to authenticated
using (
  bucket_id = 'voice_samples' and
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own files
create policy "Users can update their own voice samples"
on storage.objects for update
to authenticated
using (
  bucket_id = 'voice_samples' and
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own files
create policy "Users can delete their own voice samples"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'voice_samples' and
  auth.uid()::text = (storage.foldername(name))[1]
);
