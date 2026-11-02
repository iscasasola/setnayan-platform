## 2026-06-25 · feat(seating-3d): turn the 3D seat plan ON by default (was flag-gated to 404)

Owner direction ("merge it, I want to see this"): the 3D seating lab — already
fully shipped to `main` (PR #1998 + the furniture / RSVP-colour / monogram-floor
follow-ups) — was invisible in production only because `NEXT_PUBLIC_SEATING_3D`
was unset, so the route 404'd and the Studio "Seat Plan" card fell back to the 2D
editor. This flips the **default to ON** for every couple.

- **`app/dashboard/[eventId]/seating/lab/page.tsx`** — the route gate inverts from
  "show only when `=== 'true'`" to "404 only when `=== 'false'`". The lab is now
  live by default; the flag becomes a **kill-switch** (set `NEXT_PUBLIC_SEATING_3D=false`
  in Vercel to instantly pull it) rather than an opt-in.
- **`lib/add-ons-catalog.ts`** — `addOnHref('seating')` flips in lockstep: the
  Studio "Seat Plan" card now opens `/seating/lab` by default, falling back to the
  2D `/seating` editor only when the kill-switch is set. Entry point + route stay
  consistent (no card pointing at a 404, no orphan route).

No DB, no new SKU, no env var required to enable — `NEXT_PUBLIC_*` vars are inlined
at build, so this ships on the next production build. The seat plan stays **free**
(no paywall); the only paid layer remains the optional Animated Monogram bloom on
the floor medallion, which already gates itself.

SPEC IMPACT: 0008 Seating + 0021 Studio — the 3D lab is now the default seat-plan
surface, not a flag-gated prototype. Decision logged for the corpus.
