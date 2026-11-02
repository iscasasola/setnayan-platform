## 2026-09-17 · fix(papic,join): two refusals now name the real cause, not a phantom one

**Papic seat capture.** When a claimed camera's capture window hasn't opened yet (or has
closed), the presign route's `capture_not_started`/`capture_window_closed` refusal used to be
routed through the same generic "tap it in the roll to retry" sentence every other terminal
rejection gets. Retrying can never succeed — the shot was never taken. The route now echoes the
seat's own `valid_from` date back to the client, and the client says "the camera opens on
<date>" / "this camera's window has closed" instead. Refusal-reason → message mapping is a pure
function (`apps/web/lib/papic-seat-capture-refusal-copy.ts`) with a unit test asserting the
property (no retry instruction), sabotaged and restored (3/6 → 6/6).

**Join door.** A private event's join link was refused with the exact same `error=invalid_token`
as a genuinely dead/expired token, so a guest scanning a perfectly good poster for a private
event was told "This invite link is no longer valid." `app/join/[eventId]/actions.ts` now
redirects with its own `error=event_is_private` code, and `lib/join-door-refusal-copy.ts` gives
it its own sentence ("This celebration is set to private right now…"). An unreadable event
(token doesn't resolve to anything) keeps `invalid_token`. Pure mapping, unit test asserting the
property (private ≠ invalid-token sentence), sabotaged and restored (5/7 → 7/7).

Verified against the live rehearsal event `S89E-EARXQ3TSKQ`: `landing_page_visibility = 'private'`
(so (b) applies directly), and its seats carry `valid_from = valid_until = '2026-09-19'` (so a
capture attempt before Saturday hits exactly the `capture_not_started` path (a) fixes).

SPEC IMPACT: None — application-layer copy fix only, no schema change, no product-decision change.
