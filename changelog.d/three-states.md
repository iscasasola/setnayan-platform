## 2026-08-05 · fix(guest-site): "none yet", "we broke" and "here they are" stop looking the same

**SPEC IMPACT:** None.

**Photos of you disappeared entirely.** `getGuestLiveGallery` returned `null`
for zero photos AND `null` from its catch, and the invitation rendered the whole
section only when that value was truthy. So a guest photographed all evening
opened her page and found **no "Photos of you" area at all** — not an empty one,
not an error, just nothing where it should be. She has no way to tell whether the
photographers missed her or the page did.

An empty list is now a real result and `null` means only that the read failed, so
the three states can be told apart. The fix is a **deletion**, not a new return
type threaded through four callers: every other caller already handled an empty
list — `papic/me` checks `photos.length === 0`, the library maps to `refs: []`,
the hub reads `.photos`/`.total`. The catch stays; gallery trouble must never
take the wedding page down.

The section now renders for the whole live/post window with words for each
state, and the trailing promises ("More arrive as the day unfolds", "Tap any
photo") render only when there are photos to tap.

**The live wall promised photos it had stopped being able to fetch.** Both its
failure paths — `if (!res.ok) return;` and an empty `catch` — changed **no state
at all**. It retried every 25 seconds forever while the guest read *"The wall is
warming up — photos appear here the moment they're taken."* On a bad venue
network that sentence was a promise the page could no longer keep, with nothing
on screen to tap, retry or even suspect.

🔑 **The threshold is TWO consecutive failures, not one.** A single miss on venue
wifi is ordinary and must not accuse the network — and it must never fire on an
ordinary first-load-with-no-tiles, or every guest at a quiet moment sees an error
that is not true. Both failure paths count; a recovered fetch clears it.

`three-states.test.ts`, mutation-verified — including that BOTH wall failure
paths set the flag, since covering one leaves the other silent forever.
