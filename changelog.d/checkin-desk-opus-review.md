## 2026-11-18 · fix(checkin): a refused read of "Who runs the desk" no longer lets a turned-Off helper back in

`readDeskViewer` built a viewer's parts from `partsForRole` even when one of its four reads failed. A failed read of
`events.checkin_desk_access` parses as the DEFAULTS (coordinator all three, helpers Guests), so a helper or coordinator
the hosts had turned Off got the desk back — on the page and at `checkInGuest` / `undoCheckIn` — on a read blip. New
pure `deskPartsFor` (lib/checkin-desk.ts): when a read did not answer, only a host proven by a read that answered keeps
the parts; everyone else gets none, so the action says "try again" and the page opens the shipped Guests desk with its
notice, as its own comment already said. Test: `lib/checkin-desk.test.ts` "(opus review) a refused read never answers yes".

SPEC IMPACT: None
