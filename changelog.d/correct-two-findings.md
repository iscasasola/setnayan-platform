## 2026-08-17 · docs(guards): two of my own "findings" were overstated — corrected against live prod

The enumerating switches guard seeded four `🔴 FINDING` lines. Re-measured against
production values, **two were mine and were wrong** — the same error shape both
times: I had the fact (nothing writes the column) and invented the consequence
(therefore the feature is broken).

- `platform_settings.radar_enabled` is **TRUE in production.** Shortlist Radar is
  ON and is sold on `/vendors`. My "cannot be turned on by the people who own it"
  was false; what is genuinely absent is an OFF switch, which nobody has asked for.
- `platform_settings.spotlight_homepage_enabled` is **FALSE, and that is the right
  state** — `/vendors` lists the homepage Spotlight strip as "soon", so off is what
  the public page promises. Building a control for an unlaunched feature would be
  the defect.

Both marked `⚖ CORRECTED` with the measured value rather than deleted, so the next
reader meets the reasoning instead of repeating it.

Header counts fixed in the same commit: the file said "These 51 lines" and "Four
are marked FINDING" while carrying 50 entries and one finding — the exact
read-from-the-middle staleness this repo keeps paying for. The count came down by
**measurement, not trimming**: one was a detector defect (PR #4490), two were
these.

🔑 **A list with wrong entries on it stops being read.** That is the whole value of
the file, so a wrong line in it is worse than a missing one.

One finding stands, unchanged and re-verified: `papic_photos.consent_to_public`
has no writer, and all 14 real production photos sit behind it.

SPEC IMPACT: None.
