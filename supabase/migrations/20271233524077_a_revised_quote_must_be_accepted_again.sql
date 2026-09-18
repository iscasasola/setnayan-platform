-- A REVISED QUOTE MUST BE ACCEPTED AGAIN (S5 · 2026-09-18)
--
-- Owner, verbatim: "they can do updates and must be reaccepted. so they can
-- negotiate of the benefits." And, testing live: "vendor cannot edit the
-- proposal." He chose option (a): a NEW proposal supersedes the old one; the old
-- one stays in the thread as history; the couple's acceptance resets to pending.
--
-- What already shipped (20270227904581): a 'superseded' status and a DEFINER
-- RPC that retires prior SENT/VIEWED proposals when a new one is sent. It
-- skipped ACCEPTED on purpose then — an accepted quote was treated as final.
-- Under the new ruling it is not final until Lock, so:
--
--   1. `supersede_prior_vendor_proposals` now ALSO retires an accepted quote.
--      When it does, the acceptance's footprint on `event_vendors` is undone:
--      a row the accept flipped to 'shortlisted' goes back to 'considering', and
--      the row's price becomes the NEW quote's total — the figure the supplier is
--      now asking, not the one they withdrew. Leaving the old accepted total in
--      place is how a couple would Lock at a price nobody is offering any more
--      (`finalizeVendor` books at `event_vendors.total_cost_php`).
--
--   2. It REFUSES when the booking behind the pair is already real: a CONFIRMED
--      status (contracted / deposit_paid / delivered / complete) or an open lock
--      request (`lock_request_state = 'pending'`) — the couple has asked to book
--      at the accepted price and the supplier must answer THAT, not re-quote
--      underneath it. Changes to a booked deal go through amendments and change
--      orders, which already exist. The refusal is `deal_locked` / `lock_requested`.
--
--   3. `vendor_may_requote` — the same rule as a PRE-CHECK the send paths call
--      before inserting anything, so the supplier is told before composing a
--      quote that cannot land, and no half-sent quote is left behind. One rule
--      (`vendor_requote_blocker`), two doors; neither side re-derives it.
--
-- Scope of the cross-party write: the vendor invokes this, and it touches the
-- couple's `event_vendors` row — but only the (event × THIS vendor profile) pair
-- the RPC already proves the caller owns, only a 'shortlisted' row (the state
-- the accept wrote), and only when an ACCEPTED quote is actually being retired.
-- A couple's manual shortlist of a supplier who never had an accepted quote is
-- untouched.
--
-- Idempotent. Applied by the pipeline (`supabase db push --include-all`), never
-- by hand — see CLAUDE.md "NEVER APPLY A MIGRATION DIRECTLY TO PRODUCTION".

-- ── The one rule ─────────────────────────────────────────────────────────────
-- NULL = the supplier may send a new quote (which supersedes any live one).
-- 'deal_locked'     = the booking is confirmed; use a change order.
-- 'lock_requested'  = the couple has asked to lock; answer that first.
create or replace function public.vendor_requote_blocker(
  p_event_id uuid, p_vendor_profile_id uuid
) returns text
language sql stable security definer set search_path = public as $$
  select case
    when ev.status in ('contracted','deposit_paid','delivered','complete') then 'deal_locked'
    when ev.lock_request_state = 'pending' then 'lock_requested'
    else null
  end
  from public.event_vendors ev
  where ev.event_id = p_event_id
    and ev.marketplace_vendor_id = p_vendor_profile_id
    and ev.archived_at is null
    and (ev.package_role is null or ev.package_role = 'anchor')
  order by
    -- A confirmed row outranks a pending request outranks anything else, so a
    -- pair with several rows is judged by its most committed one.
    case
      when ev.status in ('contracted','deposit_paid','delivered','complete') then 0
      when ev.lock_request_state = 'pending' then 1
      else 2
    end
  limit 1
$$;
revoke execute on function public.vendor_requote_blocker(uuid, uuid) from anon, public, authenticated;

-- ── The pre-check the send paths call BEFORE inserting ───────────────────────
create or replace function public.vendor_may_requote(
  p_event_id uuid, p_vendor_profile_id uuid
) returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if p_vendor_profile_id not in (select public.current_vendor_profile_ids()) then
    raise exception 'not_your_vendor_profile' using errcode = '42501';
  end if;
  return public.vendor_requote_blocker(p_event_id, p_vendor_profile_id);
end $$;
revoke execute on function public.vendor_may_requote(uuid, uuid) from anon, public;
grant execute on function public.vendor_may_requote(uuid, uuid) to authenticated;

-- ── Supersede: now also the accepted quote, undoing its footprint ────────────
create or replace function public.supersede_prior_vendor_proposals(
  p_event_id uuid, p_vendor_profile_id uuid, p_keep_proposal_id uuid
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_rows integer;
  v_accepted_retired integer;
  v_blocker text;
  v_new_total bigint;
begin
  if p_vendor_profile_id not in (select public.current_vendor_profile_ids()) then
    raise exception 'not_your_vendor_profile' using errcode = '42501';
  end if;

  -- Is there an ACCEPTED quote to retire? Only then does the booking state
  -- matter — a supplier replacing their own unanswered quote is never blocked.
  select count(*) into v_accepted_retired
    from public.vendor_proposals
   where event_id = p_event_id
     and vendor_profile_id = p_vendor_profile_id
     and proposal_id <> p_keep_proposal_id
     and status = 'accepted';

  if v_accepted_retired > 0 then
    v_blocker := public.vendor_requote_blocker(p_event_id, p_vendor_profile_id);
    if v_blocker is not null then
      -- 'deal_locked' | 'lock_requested' — the caller pre-checked; this is the
      -- backstop for a race or a caller that did not.
      raise exception '%', v_blocker using errcode = '22023';
    end if;
  end if;

  update public.vendor_proposals
     set status = 'superseded', updated_at = now()
   where event_id = p_event_id
     and vendor_profile_id = p_vendor_profile_id
     and proposal_id <> p_keep_proposal_id
     and status in ('sent','viewed','accepted');
  get diagnostics v_rows = row_count;

  if v_accepted_retired > 0 then
    -- The acceptance is no longer standing: the shortlist the accept wrote goes
    -- back to 'considering', and the bench price becomes what is NOW on offer.
    -- Never touches a confirmed row (the blocker above refused), never a row
    -- the couple merely marked 'considering' themselves.
    select total_centavos into v_new_total
      from public.vendor_proposals where proposal_id = p_keep_proposal_id;

    update public.event_vendors
       set status = 'considering'::public.vendor_status,
           total_cost_php = case
             when v_new_total is not null then v_new_total::numeric / 100.0
             else total_cost_php
           end,
           updated_at = now()
     where event_id = p_event_id
       and marketplace_vendor_id = p_vendor_profile_id
       and status = 'shortlisted'::public.vendor_status
       and archived_at is null;
  end if;

  return v_rows;
end $$;
revoke execute on function public.supersede_prior_vendor_proposals(uuid, uuid, uuid) from anon, public;
grant execute on function public.supersede_prior_vendor_proposals(uuid, uuid, uuid) to authenticated;

comment on function public.supersede_prior_vendor_proposals(uuid, uuid, uuid) is
  'Retires every earlier live quote (sent/viewed/ACCEPTED) for an (event, vendor) when a new one is sent. Retiring an accepted quote reverts the shortlist it wrote and re-prices the bench row at the new total; refuses (deal_locked / lock_requested) once the booking is confirmed or a lock is pending. S5, 2026-09-18.';
