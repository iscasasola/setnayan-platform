## 2026-09-27 · fix(invite-themes): Luxe's scrim deepens 62%→86% so small text clears AA

The RSVP prototype (DECISION_LOG 2026-09-27, owner "YES TO ALL" row, last sentence) measured
Luxe's small text failing contrast over the chandelier/spotlight loop at the theme's 62% scrim:
muted body text ~4.8:1 and gold small-caps/counts ~3.5:1, both under the AA_BODY floor (4.5:1).
The big foil heading was already fine at 62% (only needs AA_LARGE, 3:1).

`INVITE_THEMES.velvet.scrim.opacity` (`apps/web/lib/invite-themes.ts`) is raised from 0.62 to
0.86 — the value every consumer already reads generically (`lib/hub-legibility.ts`'s
`theme-ground` branch via `app/[slug]/_lib/theme-ground.ts` → `GuestGround` in
`app/[slug]/_components/guest-look-scope.tsx`, plus print via `lib/print-pieces.ts`), so no
other file needed a change. Re-measured at 86%: ink 12.7:1 · muted 10.1:1 · gold/heading
7.4:1 — all comfortably clear AA. `measured` docs on the theme updated to match. Every other
theme's `scrim` is byte-identical.

Not shipped in this pass: a per-scene two-stop scrim that keeps 62% specifically behind the
big foil heading for a lighter chandelier reveal (the design session's stated ideal). That is
scene-level work that belongs to the RSVP builder (`app/[slug]/_components/rsvp-widget.tsx`,
out of scope here) — the uniform 86% is a strict legibility improvement everywhere and does
not block that follow-up.

Added: `apps/web/lib/luxe-scrim-clears-small-text.test.ts` — asserts Luxe's own body/muted/
heading/accent all clear their WCAG targets over both the loop's lightest and darkest sample
under the theme's own scrim, asserts the floor is literally 0.86, and asserts every other
theme's `scrim` is unchanged from its currently-shipped value.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/assets/theme-backgrounds-2026-09-24/THEMES-2026-09-24.md`
— Luxe's "Text" and "Print" rows updated from 62%/old contrast numbers to 86%/new numbers,
with a note that the per-scene 62%-behind-the-heading split is separate, unshipped work.
