create table event_category_decisions (
  id               bigserial primary key,
  event_id         uuid not null references public.events(event_id) on delete cascade,
  plan_group_id    text not null,
  decision         text not null check (decision in ('excluded', 'deferred')),
  decided_at       timestamptz not null default now(),
  unique (event_id, plan_group_id)
);

alter table event_category_decisions enable row level security;

-- Couples and admins can read their own event's decisions
create policy "members read own event category decisions"
  on event_category_decisions for select
  using (event_id in (select public.current_event_ids()));

-- Only couple members can write decisions
create policy "couples manage category decisions"
  on event_category_decisions for all
  using (event_id in (select public.current_event_ids()))
  with check (event_id in (select public.current_event_ids()));
