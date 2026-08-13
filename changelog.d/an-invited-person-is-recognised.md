## 2026-08-13 · fix(guests): an invited person who is signed in is not asked to prove it again — and the emailed sign-in link stops landing them on a 404

Follow-up to #4415, which put invited events on the events board for the first
time. Two defects, one of them **live in production today and independent of that
change**.

### 🔴 THE EMAILED SIGN-IN LINK SENT A CONNECTED GUEST TO A 404 — live, and reachable four ways

`app/join/[eventId]/connect/route.ts` is where a guest lands after clicking the
passwordless sign-in link. `connectEventForUser` writes
`member_type: 'guest'` — and the route then redirected to
`/dashboard/${eventId}`, a layout that admits `member_type = 'couple'` ONLY.

**So SUCCEEDING sent them to a not-found page while FAILING sent them somewhere
that worked** (`/dashboard`). The better the connect went, the worse the landing.

Reachable from four shipped call sites, and one of them is the couple
themselves — `dashboard/[eventId]/guests/[guestId]/actions.ts`, the *"send them a
sign-in link"* button on their own guest list — plus the three scan-to-join
branches in `join/[eventId]/actions.ts` and `app/[slug]/actions.ts`. **An emailed
link is the likeliest path a real invited guest ever takes**, likelier than a QR.

🔑 **This is the FOURTH door of the family #4415 closed three of** (the board
card, the ⌘K index, the auto-surfaced "you were added" row). It was not on the
board, so the sweep that found the other three never looked at it. *When you fix
a route-shaped bug, sweep every route with that shape.*

### 🎟 AND THE CARD'S OWN PROMISE ONLY HELD FOR 60 DAYS

#4415's invited card says a person gets their photos, their table and their RSVP.
That is true on `/{slug}` — but only if the page can **recognise** them, and
guest identity there is a cookie, not their account:

- `setnayan_guest_session` has a **hard 60-day life with no sliding refresh**
  (`setExpirationTime` at mint; `readGuestSession` never re-issues), and
- it carries exactly **ONE** `event_id`.

Save-the-dates go out **6–12 months** ahead — the same reasoning that moved
address forwarding from 90 days to 24 months on 2026-08-11. So the **ordinary**
invited guest is a stranger on that page by the wedding day, and anybody invited
to **two** events can only ever be recognised on one of them at a time. On a
`private` event — **3 of 5 in prod** — an unrecognised viewer meets
`PrivateLanding`: *"Already invited? Open the personal link the couple sent you,
or scan your invitation QR."* **We would be telling somebody whose membership row
we are holding to go and find a QR code.** Same shape as the printed-invitation
defect of 2026-08-11: a person who did the right thing is asked to do it again,
and it reads as the couple shutting them out.

🔑 **THE BINDING WAS ALREADY IN THE DATABASE — SO NO COOKIE IS NEEDED TO READ
IT.** `event_members.guest_id` exists precisely to say *"this account is that
seat"* and is written by **every** path that creates a guest membership (QR
scan-to-join, the cookie link, the cross-device magic link). The event page's own
visibility gate now also admits a signed-in person holding a seat on that event.
**Nothing new was built to become a guest**, and no session is written anywhere.

🔒 **Not a widening — the same claim by a stronger key.** The cookie says *"this
browser once held guest X's QR"*; the membership row says *"this **authenticated
account** is bound to guest X"*, and that binding was itself established by
holding the QR or clicking a link emailed to the address on the seat.

⚠ **What this does NOT do, named rather than skipped:** it admits them to the
page; it does not hand them a guest session, so the per-guest surfaces that key on
`guests.guest_id` (their table, the photos of them, their RSVP) still need the
cookie their invitation mints. Turning those on for a signed-in seat-holder is a
deliberate one-press act on that page — **not built here**, because a render
cannot write cookies and a link must not.

### Why re-minting is not an escalation, and the one trade-off

The cookie asserts *"this browser once held guest X's QR."* An `event_members`
row asserts *"this **authenticated account** is bound to guest X"*, and that
binding was itself established by holding the QR or clicking a link emailed to
the address on the seat. Keyed on `auth.uid()` it is the **stronger** claim.

Gates, each a real one: the caller's **own** row · `member_type='guest'` ·
`guest_id IS NOT NULL` · `hidden_at IS NULL` (their own Leave) ·
`guests.deleted_at IS NULL` (the **host's** eviction path). A rejected read
**fails closed** — both reads check `.error`, because a lost grant returning `[]`
would silently restore the exact lock-out this exists to end.

✅ **QR rotation is untouched, because nothing is minted.** Rotation kills
sessions minted from a leaked QR; this writes no session. What rotation never did
is remove somebody from the guest list — and the two paths that do (removing the
membership, soft-deleting the seat) both close this door.

### Guard

`app/[slug]/an-invited-person-is-recognised.test.ts`.

🔑 **Its strongest assertion is the GENERAL rule, not the specific bug** (see the
third section below): every destination `eventBoardHref` can produce is resolved to
a file on disk and must be a `page.tsx`. A `route.ts` is refused outright — no
reasoning about whether *this* handler happens to be side-effect-free, because the
next one will not be.

🛡 **22 sabotages, every one occurrence-counted before → after, all 22 caught,
baseline green either side** — including re-creating the minting route handler,
pointing a card at a real handler path, and each gate individually.

🪤 **AND THE SUITE RAN ZERO TESTS ON ITS FIRST INVOCATION, GREEN.**
`tsx --test "app/[slug]/<file>.test.ts"` prints `# tests 0 … # fail 0`: the
brackets are a glob **character class**, so an explicit bracket path matches
nothing and exits 0. Every run here uses a pattern (`app/*/an-invited-*.test.ts`),
and the mutation harness refuses any run that reports zero tests. Recorded before,
re-measured today.

Verified: typecheck clean · **7926/7926** unit tests · all 22 lint scripts · every
column named in the two new reads confirmed to exist in prod (9 of 9), so neither
is a phantom.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-13 — a signed-in invited person is
recognised from the seat binding they already hold; the emailed sign-in link lands
them on the event, not on the organiser's dashboard.

---

## 2026-08-13 · fix(launcher): a dead card no longer animates, and it says why it cannot open

**Found by an adversarial pass over my own merged work** (six review lenses, each
finding attacked by two skeptics told to refute it). Both skeptics verified this
one line by line and **could not refute it**; they also corrected two small
overstatements in the original claim, which are reflected below.

### 🚨 A card that lifted under the pointer, squashed under the finger, and opened nothing

`CardShell` passed the caller's `className` **straight through** to the `<div>` it
renders when there is no destination — and that string carries `sn-press`
(`:active { scale: 0.97 }`) and `sn-lift-4` (`:hover { translateY(-4px) }`). Both
are plain class selectors in `globals.css`, so they fire on a `div` exactly as on
a link. **A control that animates under your finger has promised something.**
(The cursor never changed — those rules cover buttons and anchors only — which
made it quieter still. On the phone chip only `sn-press` applied, and `:active`
may not fire on a non-interactive div in iOS Safari, so there the symptom is
simply a card that does not respond.)

### 🚨 And the sentence explaining an unopenable card was unreachable on the shelf that needed it

`deriveEventView` tested `finished` **before** `invited`, so an invited event whose
day had passed always read `'Celebrated'` — and *"The host hasn't opened their page
yet"* could never print on the **Finished** shelf. `CardShell`'s own docblock
asserted the opposite: *"the card says so in its status line."*

🔑 **Not reachable-in-theory.** Prod's ONE past event is also its ONE slug-less
event (`Song Desk Test Night`, 2026-08-01, `slug IS NULL`, not archived) and it
**already carries a live join token and a guest seed row**. The join link is keyed
on `event_id`, never on a slug, and `join/[eventId]/connect` sends a guest of a
slug-less event to `/dashboard` — its own comment saying *"their board now carries
the invited card."* So **one QR scan or one emailed link** on an event that exists
today put a real person in front of a silent dead card.

### The fix, at the source rather than the branch

The reason is now tied to **the actual condition — no destination** — not
re-derived from a chain of stances, so it cannot be true on one shelf and false on
another. `deriveEventView` derives the href **once** and returns it alongside
`closedReason`; all three card compositions take both from that one derivation, so
where a card goes, what it says, and why it might not open can no longer disagree.
`CardShell` strips `PRESSABLE_CLASSES` from a linkless card.

🛡 **The matrix is now 24 sabotages, all occurrence-counted before → after, all 24
caught, baseline green either side** — including re-introducing the branch-order
bug, deleting the reason from each composition, restoring the affordances, and
shrinking the affordance list so `sn-lift-4` survives.

Verified again: typecheck clean · **7927/7927** unit tests · all 22 lint scripts.

---

## 2026-08-13 · fix: the invited card carried a SIDE EFFECT, and a `<Link>` prefetch fired it

**Retracting my own design from earlier in this same PR**, on the adversarial
pass's second lens. Both skeptics confirmed it against the installed framework
(Next 15.5.21) and could not refute it.

### 🚨 A card scrolling into view rewrote which wedding the browser was recognised at

The first cut pointed the invited card at a `/{slug}/enter` **GET route handler**
that minted the guest cookie. **App Router `<Link>` prefetches its href**, so a
card merely entering the viewport executed the mint — and because that cookie
holds exactly ONE `event_id`, somebody invited to two weddings had it silently
rewritten by looking at their own board:

> Ana holds a live session for wedding A and is standing at A's reception using
> her seat pass. She opens her board; B's *"You're invited"* card scrolls past.
> The prefetch runs, her cookie now names B, and back on A's page she is a
> stranger — A is private, so she is told to *"scan your invitation QR."*

**The exact lock-out this change existed to end, caused by looking at her own
board.** It would also have stamped the other couple's scan history with a row for
an invitation nobody opened.

🔑 **AND THIS REPO HAD ALREADY WRITTEN THE RULE DOWN.** `front-door-shell.tsx`, on
sign-out: *"⚠ SIGN OUT IS A FORM, NOT A LINK … It would also be prefetchable, i.e.
a row that can sign you out by being NEAR the pointer."* I read that file's
neighbours and not that line.

### The fix removes the class of problem, not the instance

- The `/{slug}/enter` route handler is **deleted**. The card points at the plain
  public page again — safe to prefetch, no side effect.
- The recognition moved to where it needs no cookie at all: **the event page's own
  visibility gate** now admits a signed-in seat-holder. That was always the real
  fix; the hop was a longer way round with a hazard attached.
- `findGuestSeatForUser` survives unchanged and is now the gate's helper — the
  gates were right, only the caller was wrong.

🛡 **The guard is the GENERAL rule, not this bug:** every destination
`eventBoardHref` can produce is resolved to a file and must be a `page.tsx`; a
`route.ts` is refused outright. Two of the 22 sabotages target it directly —
pointing a card at a real handler path, and re-creating the minting handler.

### Two more from the same pass, both confirmed

- **"Let's set up your first event" printed directly above the events you were
  invited to.** The greeting read the organiser-only set while the shelves below
  render the merged set; before invited events reached the board those were one
  list and could not contradict each other. The *"in motion"* tile had the same
  divergence and would have read **0** over a board full of invitations.
- **A dead card that animated** — see the section above.

⚖ **Two candidate findings from this pass were REFUTED and are not fixed**, both
because the state they need cannot exist: a countdown-precedence reading whose
scenario requires a future-dated slug-less event, and a variant of the same. The
skeptics measured prod and killed them — which is the pass working in both
directions.
