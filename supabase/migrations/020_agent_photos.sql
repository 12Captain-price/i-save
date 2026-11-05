-- 020: optional photo for each registration agent, shown on the Apply page card.
-- Pictures live in the existing site-media bucket (folder "agents"); only the path is stored.
alter table public.agents add column photo_path text
  check (photo_path is null or length(photo_path) <= 300);
