## 2026-07-23 · refactor(guest-site): OPEN-BROWSE PR2 — cached domain loaders for `app/[slug]/page.tsx`

Second PR of the 5-tab guest-site rebuild (council build plan §3 row 2,
`Guest_Event_Website_Open_Browse_Council_Verdict_2026-07-22.md`). The ~900-line
inline data-resolution block of the orchestrator moves verbatim into
`React.cache`'d domain loaders in `app/[slug]/_lib/loaders.ts` — **zero
behavior change**: same queries, same fallbacks, same error handling,
reordered only as function extraction requires (verified mechanically, see
PR). `page.tsx` shrinks 2,726 → 2,130 lines.

**The loaders.** `loadEventShell` (the event row by slug — page.tsx's
`fetchEventBySlug` re-homed, still slug-keyed so generateMetadata + body keep
sharing one DB roundtrip) · `loadMedia` (hero/photos/monogram/STD media +
entitlement resolution) · `loadGuestContext` (**the ONLY loader that may
select guest columns** — takes the verified guest session as a required
parameter and is structurally unreachable without one; returns a
discriminated `not_found`/`unconfirmed_tba`/`ready` result so the
invalid-invite landing and the /welcome redirect stay orchestrator control
flow) · `loadLiveLayer` (public schedule, RSVP-era backdrop config,
live-window Watch-Live + Live Photo Wall, anonymous event-day chrome) · plus
two shell-domain cached reads: `loadWidgets` (the invitation_widgets
registry) and `loadHostMembership` (the event_members/event_moderators pair —
previously duplicated verbatim at the private gate AND the `?phase=` preview
gate; now one deduped read when both fire).

**The hard rule held.** `cookies()` / `readGuestSession()` / the
cookie-scoped `createClient()` are never called inside a cached function —
the orchestrator reads cookies/auth and threads results in as arguments.
Loader return types live in `_lib/types.ts` (`EventMedia` · `LiveLayerData` ·
`GuestContext` + friends). The `revalidate = 60` export is untouched. The
benefit is per-request dedup + orchestrator shrinkage, NOT cross-route
sharing — the loaders are route-private.

SPEC IMPACT: None — refactor only; no product surface, price, or copy
changed. (Corpus updates for the open-browse program land with PR11 per the
council verdict.)
