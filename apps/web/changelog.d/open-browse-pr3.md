## 2026-07-23 · refactor(guest-site): OPEN-BROWSE PR3 — one body tree (`SiteBody`) for `app/[slug]/page.tsx`

Third PR of the 5-tab guest-site rebuild (council build plan §3 row 3,
`Guest_Event_Website_Open_Browse_Council_Verdict_2026-07-22.md`) — the
one-body-tree unification the council flagged as the program's
highest-subtlety step. The duplicated 3-way body (editorial | save-the-date |
normal — written twice, in PublicLanding and InvitationSite) merges into ONE
`SiteBody({ identity, … })`; the two old components dissolve. **Zero behavior
change**: under an anonymous viewer the unified tree renders exactly the old
PublicLanding output; with a verified guest cookie, exactly the old
InvitationSite output (verified mechanically — normalized branch-by-branch
source diff + golden tests + rendered-HTML preview-vs-prod diff, see PR).
`page.tsx` shrinks 2,130 → 608 lines.

**The pieces.**
- `app/[slug]/_components/site-body.tsx` — the unified tree. The shared
  chrome (InvitationShell · GuestPreload · PublicPageActions · StdViewBeacon
  · RevealOverlayServer · BackgroundMusic) and the `EditorialContent` /
  `SaveTheDateView` computation sites now exist ONCE; the per-identity
  "normal" bodies remain verbatim-preserved branches inside the one tree.
  The reveal/STD helper functions moved here with the trees that consume
  them.
- `lib/site-body-plan.ts` — `resolveSiteBodyPlan`, the ONE phase-spine
  computation site (body selection, full-bleed, beacon, reveal, music, STD
  text-hero, always-on widget gates, hideable order, anonymous allow-list
  fence). Pure; golden-tested across 4 phases × identities in
  `lib/site-body-plan.test.ts`.
- `app/[slug]/_lib/site-identity.ts` — the identity union. The ANONYMOUS
  variant is structurally unable to carry guest-derived data:
  `anonymousIdentity()` builds by explicit key-pick (runtime firewall), a
  compile-time `Leak extends never` assertion guards the type, and
  `lib/anonymous-zero-guest.test.ts` pins both plus the
  PUBLIC_WIDGET_ALLOWLIST fence (the entire anonymous widget filter now
  consumes PR1's exported constant via the plan).
- The `reason` variants (null / wrong_event / invalid_invite; loader
  `not_found` maps to invalid_invite) thread through the identity union —
  stale-cookie messaging preserved. The TBA `redirect()` stays
  orchestrator-side. `EventShellRow`'s loose typing at the prop boundary is
  deliberately untouched (resolveMonogram relies on it). GuestHubBar stays
  orchestrator-side, guest-only, unchanged.

SPEC IMPACT: None — structural unification; no product surface, price, or
copy changed. (Corpus updates for the open-browse program land with PR11 per
the council verdict.)
