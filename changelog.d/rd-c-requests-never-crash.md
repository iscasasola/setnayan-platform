## 2026-10-11 · fix(guest): a failed request never crashes or lies — the guest side and the couple's guest list

Owner: "make sure requests does not cause a crash". The database is on a small
plan (first call after a quiet gap up to 3 s, a ~40 s stall once a day), every
deploy with a migration has a schema-cache blip, and phones drop signal. A
request that FAILED was being drawn as a thing that is not there, or thrown at
an error screen that unmounted what the person had typed.

Built, not live. Six pieces, one commit each.

**1 · The link is never called dead by a failed read.** `app/[slug]/redeem/route.ts`
threw away the `error` on its three reads (the event, the guest's code, the
linked guest), so a failed read went to `?invite_error=invalid_token` — "That
invite link doesn't look right — it may have been replaced…". Each read is now
retried through a blip (`withSchemaRetry`) and, if it still failed, answered in
place (HTTP 503, never cached, no cookie) with the guest boundary's own words:
"This invitation didn't load." / "Your link is fine — something on our end is
having trouble. Give it a moment and try again." / "Try again" — which is the
same link, so the code is kept. A throw inside the route gets the same answer
instead of the browser's blank error page. "No such row" keeps `invalid_token`.
Guard: `app/[slug]/redeem/a-failed-read-is-not-a-dead-link.test.ts` (drives the
real route with scripted database answers).

**2 · Sending a reply never loses what was typed and never hangs.** The reply
card's three forms are `ReplyForm` (`app/[slug]/_components/reply-form.tsx`):
the same `<form>` with the same server action on it (so it still posts with
script off — the served HTML keeps `method="POST"` and the `$ACTION_…` fields),
with the press caught. A send that fails (offline, 5xx, the action throws)
leaves the form mounted with everything typed and says, under the button: "We
could not save your reply just now. Please try again — it has not been recorded
yet." A send that does not answer in 20 s gives the screen back with the same
line. A second press while one is out sends nothing. The card's recorded HTML
is unchanged (`the-reply-card-is-todays-page.test.ts`).
`submitRsvp` / `submitInviteReply` no longer fall back to `redirect('/')`: the
event is read once, honestly, BEFORE the write (a failed read stops the save —
it also used to treat a final guest list as open), and every later redirect
uses that address; a reply that landed is never reported as unsent.
`SubmitButton` gains an optional `pending` prop (unused by every other form).
Guard: `lib/reply-send.test.ts`.

**3 · A failed read never says "can't be found" or "nothing here".**
`hub`, `everyone`, `pabuya`, `recap`, `welcome`: the event read goes through
`guestRead` (`lib/guest-read.ts`) — retried through a blip, THROWN on any error,
so the guest boundary answers and `notFound()` now only means "no such event".
`everyone`: the entourage and guest-list reads throw instead of drawing "The
entourage hasn't been shared yet." / "No one else is on the list yet.".
`hub` / `welcome`: the guest's own row throws instead of drawing them as a
stranger (or bouncing a plus-one back and forth). `seat/claim`: answered in
place like the redeem (`lib/guest-did-not-load.ts`, shared). `seat`: the public
table view says "We couldn't load your seat pass" instead of "No one has been
seated here yet." on a failed read (the rest of that page was already honest).
Guard: `app/[slug]/a-failed-read-is-not-an-absence.test.ts` (walks every
database read in those eight files' syntax trees) · `lib/guest-read.test.ts`.

**4 · The arrival shows something while it loads.** `invite/enter` and
`invite/reply` draw the door — the couple's names, their mark, "Loading your
invitation…" for a screen reader — as soon as the routing is decided
(`ArrivalLoading`), through a `<Suspense>` placed after the last
`notFound()`/`redirect()`. No `loading.tsx` (it would turn a real 404 into a
200). Guard: `app/[slug]/invite/the-arrival-shows-something-while-it-loads.test.ts`.

**5 · The guest list's presses are caught.** Quick add (add · make a group ·
add a role · change a role), the capture bar, Add from people, Mark as sent
(the cell and the Send page) and the invitation message call their action
through `hearAction` (`guests/_components/hear-action.ts`): a failed request
answers like a refusal, so the sheet and what was typed stay and the page's
existing line is said ("Couldn't save that. Try again." …). It used to replace
the roster with the app's error screen.
Guard: `guests/_components/a-failed-press-keeps-the-sheet.test.ts`.

**6 · The find-seat name search gives up** after 15 s (`lib/abort-after.ts`) and
shows its existing "We couldn't check just now. Your seat is fine — try again
in a moment." Guard: `lib/abort-after.test.ts`.

No new words: every sentence above was already on the page it is now said on.

Seen in a browser (375×812, a dev server with no database): piece 2 only — the
Event Hub's reply sheet in the dev lab, and a throwaway page with a real
redirecting action. Not seen: a real phone, a real network drop, a chat app's
in-app browser, a production build, a real published event; pieces 1, 3, 4, 5
and 6 are held by tests only.

Left as found, on purpose: the re-entry code branch of the redeem (`?k=`: a
failed read is a refused code → the Event Hub, no "wrong link" sentence);
`isRecapPublished` ("The recap isn't ready yet" on a failed read — a publishing
gate, fails closed); `withdrawFaceConsent`'s `redirect('/')`; no read has a time
limit of its own (a database that stalls is waited on until the platform cuts
the request); a guest-list press whose request never answers still shows its
spinner until the browser gives up.

SPEC IMPACT: None.
