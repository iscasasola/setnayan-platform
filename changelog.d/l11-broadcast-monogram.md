## 2026-09-02 · fix(live-studio): the broadcast bug draws the couple's real monogram, not just derived initials

The Live Studio monogram overlay (`resolveOverlays` in `apps/web/lib/live-studio-overlays.ts`)
drew only `events.monogram_text ?? deriveMonogram(display_name)` as plain text — an event with a
real custom mark (Monogram Studio / Bespoke AI / uploaded SVG) had it silently ignored on the one
surface most seen: the live broadcast, both on the controller's CH 1 monitor
(`app/panood/control/[eventId]/page.tsx`) and the actual OBS capture surface
(`app/panood/program/[eventId]/program-surface.tsx`).

`resolveOverlays` now accepts an optional `monogramMarkSvg` (the same
`resolveEventMonogramSvg(event)` precedence — `monogram_uploaded_svg ?? monogram_custom_svg` — the
public hero already resolves), re-sanitizes it at this read site via `safeMonogramSvg` (SEC-3
fail-closed, independent of the caller), and returns it as an inert `markDataUri` alongside the
existing `text`. Both surfaces render the mark as a data-URI `<img>` when present and fall back to
the original derived-initials pill exactly as before when it isn't — a lookup miss degrades to the
old behaviour, never to a blank broadcast.

SPEC IMPACT: None — no schema change, no new column, no new entitlement. Reuses existing
`events.monogram_uploaded_svg` / `monogram_custom_svg` columns and the existing SEC-3 read-time
sanitizer.
