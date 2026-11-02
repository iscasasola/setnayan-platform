## 2026-09-29 · feat(rsvp): plus-ones — "Add name" in place on Me, their own link's short door, and the host's number is never refused

Owner, verbatim: *"plus guests are only minimum questions. they don't need to
recommend songs and notes to the couple. They also get their own QR Code. they
can also link it to their account."* — and *"adding +1-4 should be a host
decision. and their QR auto adapts to it?"* Prototype
`prototypes/rsvp_plus_ones_2026-09-29.html`, frames E–G (A–D shipped in #6145,
which this stacks on).

**E · Me → Your guests → "Add name" opens in place.**
- `YourGuests` takes `addName` (Me passes it; the thank-you keeps its link to
  the reply's boxes one screen behind). A TBA seat's "Add name" unfolds the same
  four boxes the reply uses (`PlusOneSeatPanels`, new `idPrefix` so its ids never
  collide with the reply's on the same page — field names unchanged) with
  "Cancel" and "Save name" (`add-name-in-place.tsx`).
- Saving goes through the guest's own save — `submitRsvp`'s new
  `seat_names_only` branch (+0 server actions, the checklist tick's precedent):
  same key check, returns before anything of the reply is read. The seat write
  is now ONE function, `nameTheSeats`, used by both the reply and Me (entitlement
  re-read, the couple's switches, only this guest's seats). It now reads every
  write's error; Me says "Their name did not save" and keeps the boxes open.
  The page revalidates, so the row re-renders NAMED — "Send their invite" ·
  "Show <name>'s pass". Hidden when the couple's plus-ones switch is off.

**F · a plus-one opening THEIR OWN link.**
- `redeem` sends a named plus-one to `/[slug]/welcome` once per browser
  (`PLUS_ONE_WELCOMED_COOKIE`), never when the seat is already kept in an account.
- `/welcome` is now every plus-one's door (was: unnamed ones only): "Welcome,
  Ben" · "Maria Santos is bringing you as their guest" · what the bringer filled,
  shown and marked "from Maria" ("Something wrong? Change it" opens the same
  boxes in place) · ONLY what is missing of the four (first, last, meal, dietary
  — meal/dietary only when the couple asks) · the Terms · ONE "Save to my
  account" · "Not now — just show my pass" (their QR, on the same door). No
  attendance, mobile, song, note or selfie. Body in
  `welcome/_components/plus-one-door.tsx`.
- `SaveToAccount` gains `through`: in the offer state the one button posts the
  door's own save (answers + Terms tick in the same form), which then takes the
  device's method through the shipped doors (`signInWithApple/Google` →
  `/join/{eventId}/connect`, or `claimAccountAction`). Because the tick is set as
  the cookie before the provider, the device's method is used even with no tick
  carried in. Every other state and every other caller render unchanged.
- `confirmPlusOneName` (the same action) writes only the plus-one's own row
  (`.not('plus_one_of_guest_id','is',null)`) and only the four; never
  `rsvp_status` — their attendance follows their own reply if they give one.
- The Event Hub's key gate asks `plusOneGate` for a plus-one (name, and meal when
  asked) and sends them to their door — never the full reply (the reply gate now
  reads `!isPlusOne && keyGate.kind === 'ask'`). `lib/plus-one-welcome.ts` is the
  one rule the link, the door and the gate share.

**G · the host's number.**
- `planExtraSeats` no longer refuses a number below the named seats: it saves,
  removes placeholders only, never a named person, and reports `over`.
  `checkExtraSeats` refuses only a finalized list. (Retires the 2026-09-21
  "remove them from the guest list first" refusal.)
- Guest List rows (desktop + phone) read "+3 (2 named)"; an unnamed seat's row
  reads "+2 · TBA" (computed, so rows stored as "+ TBA · brought by …" read the
  same; new seats are stored as "+N · TBA" via `seatPlaceholderLabel`). Over the
  number: the quiet "3 named · 1 allowed." with a Remove per name — the host's
  own `softDeleteGuest` behind `RemoveGuestConfirm`'s two taps (new `compact`
  variant). Seats counted from the FULL roster (`bringerSeatsFrom(guests)`),
  never the filtered view. The +0…+4 menu says "2 named · 1 TBA" / "2 named · 1
  allowed" beside each number.

Guarded by `app/[slug]/_components/plus-ones-own-link-and-host.test.ts` (22
tests, each property sabotaged and seen to fail). Updated: `lib/extra-seats.test.ts`
(the refusal test now asserts the allow + `over`), `lib/extra-seats-are-chairs.test.ts`
(the picker's check is the finalized-list check), `the-guest-pathway.test.ts`
(the reply gate spares a plus-one).

SPEC IMPACT: DECISION_LOG.md row "AS BUILT — PLUS-ONES: ADD NAME IN PLACE · THEIR OWN DOOR · THE HOST'S NUMBER" (2026-09-29).
