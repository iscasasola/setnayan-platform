## 2026-10-25 · feat(rsvp): each +1 is its own screen, and a named +1 is confirmed with a required tick

Owner, 25 Oct, on the guest's reply: *"Each plus shouldn't come from a drop down and also allow them to checkbox
Accept that they are coming (required) if name is written down?"*, then on the look *"one at a time"*, then *"Tick
only shows when there is name written. and that is required. If you are not yet sure, delete name"*, and *"Yes,
build the +1 screens as shown."*

- **One screen per +1** (`rsvp-plus-ones.tsx`): the "Filling in for ▾" PickMenu is gone. Each seat is its own
  `data-rsvp-step` ("Who are you bringing?" · "+N · Not sure yet? Leave the name empty." ⓘ), so the progress dots
  count every +1 and Back returns to the one before with what was typed. An empty +1 is passed with plain Next.
- **"They're coming"**: drawn only once a name is written, then required. Next stays on that seat with "Tick to
  confirm they're coming"; clearing the name takes the tick away, unticked. Never pre-ticked — it reopens ticked
  only for a seat already `attending`.
- **Calm refusals everywhere on the reply** (`rsvp-one-at-a-time.tsx`): Next checks every box on the screen and a
  refusal is a line at the field ("Needed to continue", or the field's own words) with focus moved there — never the
  browser's bubble, never a greyed Next. Send's Terms tick gets the same line under it.
- **One house tick box** (`tick-box.tsx`) shared by the +1 tick and the Terms tick, filled with the page's paper
  (`bg-cream`) — the Terms tick's white square on a dark Event Hub is gone.
- **Server** (`submitRsvp` → `nameTheSeats`): a named seat posted without its tick is refused before anything is
  planned (`splitUnconfirmedSeats`, said as `SEAT_NAME_NOT_TICKED`), never written or minted; a ticked seat is
  written `rsvp_status = 'attending'`, `rsvp_set_by = 'guest'`, `rsvp_responded_at` (a minted seat too). The seat
  loaders carry each seat's `rsvp_status` so the tick can reopen ticked.
- Guards: `plus-ones-are-one-at-a-time.test.ts` (no seat dropdown · one screen per +1 · the tick only with a name ·
  a name without the tick blocks Next · never pre-ticked · an unticked +1 never saved · the shared box has no white
  fill), each broken once; `every-plus-one-is-named`, `the-reply-says-the-seats-first`, the walked-pages Terms line,
  `a-guest-can-name-who-they-bring` and `ask-your-guests` re-pointed; the reply-card golden recorded again (dated
  note in its `_about`); port-control baseline regenerated (the PickMenu removal is deliberate).

SPEC IMPACT: `Setnayan/DECISION_LOG.md` — a 2026-10-25 row quoting the owner (one screen per +1, the required
"They're coming" tick shown only with a name, the shared tick box). No iteration `.md` changed.
