## 2026-06-22 · feat(monogram): show the couple's mark on the anonymous public landing hero

Part of the animated-logo surface rollout (owner 2026-06-22 "roll the animated
monogram out across the product"). The anonymous `/[slug]` landing — the
highest-traffic shared-link open — was the lone hero that showed plain initials
with **no monogram**, while the signed-in `InvitationSite` and the
`PrivateLanding` hero both render the couple's chosen mark. This closes that gap.

- `PublicLanding` now takes `monogram: MonogramConfig` and renders `<HeroMonogram>`
  in BOTH hero treatments — the full-bleed hero-media banner (with `shadow`) and
  the cream-on-cream text-only fallback — between the "You're invited" label and
  the display name, mirroring `InvitationSite` exactly. The mark **animates** when
  the event owns the paid `ANIMATED_MONOGRAM` upgrade (the already-resolved
  `animatedMonogram` motion key), and renders the bespoke/uploaded SVG when present
  (`bespokeSvg`) — both values were already resolved at the page top level and
  threaded into all 3 call sites; this just feeds them to `HeroMonogram`.
- Tightened two `PublicLanding` props from optional to required to match its
  siblings (`PrivateLanding` / `InvitationSite`) and `HeroMonogram`'s non-optional
  signature: `animatedMonogram: MonogramMotionKey | false` and
  `bespokeSvg: string | null`. All 3 call sites already pass the non-optional
  top-level values, so this is a no-op at every call site.

No new data, no DB, no payment, no new component — a faithful structural mirror of
the existing `InvitationSite` hero. The STD content-film opening beat (the other
"first PR" candidate) was already wired end-to-end on `main`, so no change there.

SPEC IMPACT: None (visual parity — the anonymous hero now matches the signed-in
hero already specced under 0002 / the couple-website 4-path program). Rollout
progress logged in `DECISION_LOG.md`.
