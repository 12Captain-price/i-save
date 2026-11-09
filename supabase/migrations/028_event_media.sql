-- 028: events can carry videos and PDF fliers as well as pictures.
-- The table keeps its name (event_images) so nothing that already uses it breaks;
-- every existing row is a picture, which is what the default says.

alter table public.event_images
  add column if not exists media_type text not null default 'image'
    check (media_type in ('image', 'video', 'pdf')),
  add column if not exists file_name text;

-- Storage: allow video and PDF files in the site-media bucket and raise the size limit.
-- Pictures are still shrunk in the browser before upload. Supabase's own plan limit
-- (50 MB per file on the free plan) still applies on top of this.
-- Skipped on the local test database, which has no storage.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    update storage.buckets
       set file_size_limit = 52428800,
           allowed_mime_types = array[
             'image/jpeg', 'image/png', 'image/webp',
             'video/mp4', 'video/webm',
             'application/pdf'
           ]
     where id = 'site-media';
  end if;
end $$;
