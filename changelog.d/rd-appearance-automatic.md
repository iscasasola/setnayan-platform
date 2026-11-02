## 2026-10-23 · feat(appearance): Light · Dark · Automatic — Automatic follows the phone and is the default

Owner 2026-10-23, verbatim: "yes add automatic, default after steps 3-4", then "set it to automatic".
Supersedes call 1 of 2026-10-13.

- `lib/appearance.ts`: `Appearance` = light · dark · auto; `DEFAULT_APPEARANCE = 'auto'`; no cookie (or an
  unknown value) = Automatic; `choiceIsDark(choice, prefersDark)`; `darkApplies` takes `prefersDark`. Still only
  on a `DARK_READY` route, for a signed-in person; signed-out is always Light; the guest Event Hub untouched.
- The <head> script asks `matchMedia('(prefers-color-scheme: dark)')` for Automatic before first paint; the
  provider listens for the phone flipping while the app is open and repaints by the same rule. The native
  status-bar clock already follows `html.dark` (B1), so it follows the phone too.
- Preferences › Appearance is now ONE `PickMenu` dropdown (three choices — house rule 2026-09-28; call 2's pill
  was for a two-way choice). The save accepts `auto`.
- Migration `20271285255801`: default 'auto'; a 'light' row last touched before the Appearance row went live
  (2026-10-23 02:06:57 UTC) was the auto→light migration, not a pick → 'auto'. Picked Dark / a Light touched
  since are kept.
- `lib/appearance.test.ts` runs the real head script on a light AND a dark phone for every person × path
  (3 sabotages → red).

SPEC IMPACT: DECISION_LOG.md row 2026-10-23 "APPEARANCE GETS AUTOMATIC" (pushed, corpus 7637e3a3).
