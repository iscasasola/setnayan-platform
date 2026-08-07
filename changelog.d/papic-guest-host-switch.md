## 2026-08-07 · feat(papic): the host decides when guests may shoot

Owner: *"The guests can have the option to use the app on the exact event or when
the host allows it."* → *"this means there should be a button for the host of the
event to allow guests to use the papic."*

🚨 **Guests had NO time gate of any kind.** `eventPapicGuestActive()` asks one
question — does this event hold a guest-camera pass — which is WHETHER, never
WHEN. A guest who redeemed their invite six months out could open the camera and
shoot into the couple's gallery on any random Tuesday, and the couple had no way
to say no.

That is the exact **mirror** of the seat-camera defect fixed the same day: seat
cameras were pinned to a single day and refused everything; guest cameras were
open permanently. Both wrong, in opposite directions, in the same feature.

**The model** — `events.papic_guest_capture_early`, default FALSE:
- OFF → guests shoot the **event day** only, the whole Manila day.
- ON → guests shoot the event's **whole Papic capture window**.

A boolean, not a date: the owner asked for a button, and the permission is a
judgement made once ("the pre-nup is tomorrow"), not a schedule. A date field
would also be a second window to keep in sync with the seat window — two values
that look alike and mean different things.

- New pure resolver `guestCaptureGate()`, used by **both** the guest page and the
  upload route. Two copies of a time comparison is exactly how the seat window
  broke (`Date.parse('2026-09-19')` is midnight **UTC** = 08:00 Manila).
- **The route is the enforcement**; the page is a courtesy. The route is reachable
  directly and the RPC behind it checks ownership and quota, never time.
- The `web_copy` follow-up is deliberately **exempt** — it completes a clip we
  already accepted, and refusing it once the day rolls over strands the raw with
  no playable copy.
- Fails **open** on missing data: an event with no date has no "event day", and
  silently refusing a guest at a live celebration is the worse outcome.
- Host control is membership-checked (`couple` only) and writes via service-role,
  because `events` UPDATE is column-privileged and its RLS is **row**-level — a
  column `authenticated` can write is writable by anyone who can update the row.
  The card is **absent** when the event has no guest cameras, rather than offering
  a button that governs nothing.

🪤 **A window refusal would have said "please try again" forever.** A 403 is
correctly treated as permanent (so it is not queued offline), but both the photo
and clip branches formatted their own generic message. One shared helper now names
the real reason and the date — the test pins **three** occurrences so fixing one
branch and not the other fails.

🪤 **`timeout` does not exist on macOS**, so the baseline regen "ran" with
`exit=0` and did nothing. Re-run properly: 1073 migrations replay, exposure
surface **unchanged** (6241 facts).

Sabotaged 3 ways, all caught: neutering the switch · ripping the gate out of the
route · dropping the copy from the clip path only. Green under Asia/Manila, UTC
and America/New_York. Typecheck clean; all 12 `lint-*.mjs` clean; exposure-freeze
and both UGAT guards pass.

SPEC IMPACT: Yes — the Papic spec describes guest cameras with no timing rule at
all. Applied separately with the retention re-sync.
