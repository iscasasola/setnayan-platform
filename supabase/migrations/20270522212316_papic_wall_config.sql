-- papic_wall_config — Papic Live Photo Wall (Salamisim) per-event display config.
-- Owner 2026-07-08 (D5). The couple chooses how many photos the wall shows and
-- which tile layout; the venue projection (/wall/[eventId]) reads these. Fully
-- responsive by design — NO resolution field (the wall fills whatever screen
-- it's cast to).
--
-- events already has RLS enabled; new columns inherit its row policies. Couple/
-- coordinator writes go through an admin-client action with an explicit
-- membership check, so no new policy is needed here. Default 'mosaic' preserves
-- the current masonry look — existing walls are unchanged. Idempotent.

alter table public.events
  add column if not exists wall_photo_count integer not null default 40,
  add column if not exists wall_tile_layout text not null default 'mosaic';

alter table public.events drop constraint if exists events_wall_photo_count_range;
alter table public.events
  add constraint events_wall_photo_count_range check (wall_photo_count between 6 and 60);

alter table public.events drop constraint if exists events_wall_tile_layout_valid;
alter table public.events
  add constraint events_wall_tile_layout_valid
    check (wall_tile_layout in ('grid', 'mosaic', 'hero', 'polaroid'));

comment on column public.events.wall_photo_count is
  'Papic Live Photo Wall: max tiles on the venue projection (6-60). Owner 2026-07-08 (D5).';
comment on column public.events.wall_tile_layout is
  'Papic Live Photo Wall tile layout: grid | mosaic | hero | polaroid. Owner 2026-07-08 (D5).';
