## 2026-07-11 · feat(vendors): inquiry basics on the masked lead (gated RPC)

Owner-approved disclosure change (2026-07-11): a vendor's PENDING/masked lead
now surfaces four non-identifying inquiry basics — event date, pax, event type,
and region — plus a "Setnayan AI · Active" badge, so the vendor can make an
accept/decline call without the couple's identity being revealed. This
supersedes the pre-accept-blank aspect of the 2026-07-03 disclosure ladder.

Because a vendor is NOT an `event_members` row while the inquiry is pending, a
direct read on `events` returns NULL under their RLS. The fix is a new
SECURITY DEFINER RPC `public.get_pending_inquiry_basics(p_thread_id uuid)`
(migration `20270719512846_get_pending_inquiry_basics.sql`) that returns ONLY
`event_date` / `region` / `event_type` / `setnayan_ai_active`, and ONLY for a
`pending` thread whose `vendor_profile_id` the caller owns (gated via
`current_vendor_profile_ids()`). It NEVER returns the couple's name, email,
phone, or venue — the full event brief still gates behind accept
(`get_vendor_event_brief`). The vendor thread page calls it fail-soft, so the
masked lead still renders if the function isn't in prod yet.

SPEC IMPACT: Vendor_Customer_Master_Build_Plan_2026-07-11.md (PR 1 — un-gated)
