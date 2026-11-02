## 2026-07-01 · feat(vendors): one profile, every life event — per-event-type track record

Surfaces a vendor's cross-life-event reputation, which the substrate had but
never broke out. A vendor's completed bookings + review score render today as a
single blended number (Experience badge + Review score), even though
`events.event_type` spans the whole catalog (wedding · debut · christening ·
gender_reveal · anniversary · …). This change groups the vendor's OWN completed
events by event type and shows a per-type breakdown: Weddings 12 · ★4.8 /
Debuts 3 · ★4.6 — only for types with at least one real completed event.

**Schema** (migration `20270415213000_vendor_cross_event_profile.sql`)

- `public.vendor_track_record_by_event_type(p_vendor_profile_id UUID)` — ONE
  read-only `SECURITY DEFINER` RPC, `STABLE`, `SET search_path = public`
  pinned, `REVOKE ALL … FROM PUBLIC` + `GRANT EXECUTE … TO authenticated`.
  Ownership-gated: returns empty unless the caller is a team member (≥ viewer)
  of the requested profile via `current_vendor_ids('viewer')` — no error leak
  for a non-member. Returns per event type: `completed_count`, `review_count`,
  `avg_rating` (`ROUND(AVG(vendor_reviews.rating_overall), 2)`), plus a human
  `event_type_label` (`event_type_vocab.label_en`, falling back to
  `initcap(replace(type,'_',' '))` so an unknown/retired slug is never dropped).
- No new table. Composes the EXISTING exclusion-hardened
  `public.vendor_completed_events` VIEW (already strips self-bookings, team,
  internal, self-comp, and archived events — so per-type counts match the flat
  public number, just split) + `public.vendor_reviews`. No PII in the output —
  aggregate counts + averages only.

**UI**

- NEW `apps/web/app/vendor-dashboard/_components/vendor-track-record-panel.tsx`
  — server component "Your track record across life events" + its
  `fetchVendorTrackRecord()` loader. Renders nothing when the vendor has no
  completed events (invisible on brand-new profiles); pluralizes labels; shows
  a ★ chip only when real reviews exist. Does NOT touch `vendor-stats-panel.tsx`.
- NEW route `apps/web/app/vendor-dashboard/track-record/page.tsx` — owner/admin
  only (agents/viewers redirect home); empty-state + no-profile state handled.
- ONE new sidebar entry `track-record` (Lucide `BarChart2`, already imported)
  added to the "My Shop" group in `vendor-sidebar.tsx`. The 6 flat desktop
  destinations are untouched; the entry is reachable via `/more` + mobile
  landing (both derive from `VENDOR_NAV_GROUPS`). `lint:navicon` passes.

SPEC IMPACT: None. Surfaces existing data (completed-events + reviews grouped by
the existing `events.event_type`) via a new read-only RPC + vendor-facing view;
no pricing, SKU, schema-rename, or locked-decision change.
