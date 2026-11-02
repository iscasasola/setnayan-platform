## 2026-09-18 · chore(live-studio): delete the unused liveStudioControlLegacyPath() helper

`liveStudioControlLegacyPath()` had zero non-test callers. Its own docblock said
"never link to it", and the tombstone redirect it exists to describe
(`app/dashboard/[eventId]/studio/live-studio-control/setup/page.tsx`) is a static
file-path route, not a computed one — it redirects TO `liveStudioControlPath()`
and never calls this function to build its own location. Deleted the helper and
its two test assertions.

Note: `decideBroadcastWindow` (lib/live-studio-window.ts) and its retirement of
the per-event-DAY model (LS6) are NOT dead — confirmed by grep, it is actively
imported by `live-studio-window-server.ts` and exercised by three passing test
files. The old per-day apparatus it replaced was already deleted, not left
behind ("gone, not hidden" — its own module header). Searched for other
DSK/LS-LEGACY/DAY-13-adjacent dead files across `lib/live-studio-*.ts` and
`lib/panood-*.ts`: every file has at least one real (non-test) importer.

SPEC IMPACT: None.
