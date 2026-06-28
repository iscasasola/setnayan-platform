-- get_vendor_thread_summaries — masked inbox summaries for a vendor's own threads.
--
-- Why: a vendor is NOT an event_members row on the couple's event, and public.events
-- has only member/moderator SELECT policies, so the PostgREST embedded join
-- event:events(...) returns NULL under the vendor's RLS session — the masked event
-- name (which the vendor is supposed to see in place of the couple's private name,
-- per iteration 0019 identity masking) never renders, and every thread degrades to a
-- generic label. This SECURITY DEFINER function returns ONLY the safe masked fields
-- (event display_name + date) plus the last-message preview, for threads owned by the
-- CALLER's vendor profile (ownership re-validated against auth.uid() — never trust the
-- p_vendor_profile_id argument alone). It deliberately does NOT expose venue, monogram,
-- love_story, or any other event column.
--
-- Consumed by the native vendor inbox (Setnayan-Native lib/vendor-chat.ts
-- fetchVendorThreads) and available to the web vendor inbox, which has the same latent
-- NULL-join degradation (apps/web/lib/chat.ts fetchVendorThreads).

create or replace function public.get_vendor_thread_summaries(p_vendor_profile_id uuid)
returns table (
  thread_id uuid,
  event_id uuid,
  event_display_name text,
  event_date date,
  inquiry_status text,
  updated_at timestamptz,
  vendor_first_reply_at timestamptz,
  last_message_body text,
  last_sender_role text,
  last_message_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select ct.thread_id,
         ct.event_id,
         e.display_name,
         e.event_date,
         ct.inquiry_status::text,
         ct.updated_at,
         ct.vendor_first_reply_at,
         lm.body,
         lm.sender_role::text,
         lm.created_at
  from public.chat_threads ct
  join public.events e on e.event_id = ct.event_id
  left join lateral (
    select m.body, m.sender_role, m.created_at
    from public.chat_messages m
    where m.thread_id = ct.thread_id
    order by m.created_at desc
    limit 1
  ) lm on true
  where ct.vendor_profile_id = p_vendor_profile_id
    -- Ownership guard: the caller must OWN or STAFF this vendor profile. Without
    -- this a SECURITY DEFINER call would let any authenticated user read any
    -- vendor's masked inbox by passing an arbitrary p_vendor_profile_id.
    and (
      exists (
        select 1 from public.vendor_profiles vp
        where vp.vendor_profile_id = p_vendor_profile_id and vp.user_id = auth.uid()
      )
      or exists (
        select 1 from public.vendor_team_members tm
        where tm.vendor_profile_id = p_vendor_profile_id and tm.user_id = auth.uid()
      )
    )
  order by ct.updated_at desc;
$$;

revoke execute on function public.get_vendor_thread_summaries(uuid) from anon;
grant execute on function public.get_vendor_thread_summaries(uuid) to authenticated;
