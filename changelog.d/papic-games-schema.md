## 2026-07-22 · feat(papic-games): Phase 1 — missions/completions schema + flag + close the fake door

Foundation for Papic Games / Photo Challenge (spec `0012_papic/Papic_Games_and_Vendor_Missions_Spec_2026-07-21.md`).
Schema-first, behind a default-off flag; **no behaviour ships.**

- **New tables** (`20270832487160_papic_games_missions_schema.sql`), RLS at `CREATE TABLE`
  (couple/coordinator + admin; guests write via a later `SECURITY DEFINER` RPC — zero-account model):
  - `papic_missions` — mission on an event (`mission_type`, `source`, optional `vendor_id` → booked
    `event_vendors`, `prompt`, optional `target_guest_id`/`target_role`, `approved` for the §3.6 couple tap).
  - `papic_mission_completions` — one per guest per mission, references `papic_guest_captures(capture_id)`,
    with `consent_to_share` (the §4 per-photo opt-in that lets a photo reach the vendor — RA 10173, default false).
- **Flag** `NEXT_PUBLIC_PAPIC_GAMES_V1` (`apps/web/lib/papic-games-flag.ts`), default OFF.
- **Closes the live fake door:** the "Photo Challenge" advertising copy in `app/[slug]/page.tsx` (3 spots)
  is now gated behind the flag — the feature is no longer *advertised* until it's *built* (spec §1 / §5 #8).

Reused (not created), later phases: `event_vendors` (auto-gen source, booked-only via `status`),
`papic_guest_captures` + `papic_record_guest_capture` RPC pattern (guest capture), `guests` (identity/roles).

SPEC IMPACT: None — implements Phase 1 of the existing spec. Note: spec §3.4 prices the custom challenge in
retired TOKENS; the live model is the ₱400/event Pro/Ent add-on (Vendor_Front_Desk_Chatbot_Build_Plan §9) —
pricing lands in a later phase, not this schema.
