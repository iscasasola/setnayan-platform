## 2026-07-24 · feat(website): open-browse PR6 — guest-site menu shell (flag-dark)

Council build plan §3 row 6. Introduces the five-tab site menu — Home · Details
· Story · **Gallery** (owner rename, never "Photos") · Me — with the same
structure for every identity tier.

- `app/[slug]/_lib/site-menu.ts` — pure tab model + `siteMenuTabs(present)` (drops
  a middle tab whose section didn't render → no dead anchors, the council's
  rejected Program-Board bug) + `siteMenuEnabled({flag, isSample})`. 5-case unit
  suite (runs in CI via the B7 app/** glob).
- `SiteMenuBar` — presentational fixed bottom bar of in-page anchor links.
- Wired into SiteBody's ANONYMOUS tree, flag-dark behind
  `NEXT_PUBLIC_WEBSITE_MENU_ENABLED` (off; ALWAYS on for the sample event so the
  owner can walk it pre-flip). Anchor ids stamped: home (top), details
  (public widgets), story (Our Story), gallery (live photo wall), me (bottom).
  Present-flags computed from the plan so tabs match rendered sections.

Coexists with GuestHubBar + PublicEventDayBar (PR11 retires the old bars). The
guest-tree variant + QR-modal absorption are the next PR6 slice.

Gates: site-menu unit 5/5 · test:unit 2996 · anonymous-zero-guest firewall 16/16
· tsc 0 · next lint 0 · next build ✓. Flag OFF in prod — zero visible change.

SPEC IMPACT: None — flag-dark UI shell; PR11 rollout is the flip gate.
