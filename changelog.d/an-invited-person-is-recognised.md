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

🔑 **THE BINDING WAS ALREADY IN THE DATABASE — ONLY THE COOKIE WAS MISSING.**
`event_members.guest_id` exists precisely to say *"this account is that seat"*
and is written by **every** path that creates a guest membership (QR scan-to-join,
the cookie link, the cross-device magic link). New: `/{slug}/enter` re-mints the
session from that binding, then lands them on the page. **Nothing new was built
to become a guest**, and the invited card now points at the hop.

- Placed at `app/[slug]/enter/` — under the event's own address, sibling to
  `redeem` — so it needs **no new reserved top-level word** (the `/creators` ·
  `/open-shop` lesson).
- Both fixes go through that **one** gate. The connect route is a Route Handler,
  so a second cookie write there would have been legal — but checking the same
  thing in two places is two chances to forget and the next surface makes three.

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

⚠ **NAMED, NOT HIDDEN — QR rotation.** Rotation exists to kill sessions minted
from a *leaked* QR; it now no longer evicts a viewer who has **bound an account**
to that seat. Bounded, because a leaked QR can be bound to at most one account
(`seedClaimedByOther` refuses a second), so rotation still does its whole job
against everyone else; and the eviction path for a bound account — removing the
membership or soft-deleting the seat — **is honoured**. Minting always reads the
**current** `qr_token`, so `GUEST_SESSION_TOKEN_CHECK` keeps agreeing with the
database. If the owner wants rotation to evict bound accounts too, that is a
revocation stamp on the membership row, not the removal of this door.

Refusals disclose nothing: unsafe slug → site root (the open-redirect its sibling
shipped to live prod on 2026-08-06); no seat → `/{slug}`, exactly what a direct
visit gives them, so a refusal is neither a 404 nor an admission; renamed address
→ forwarded.

### Guard

`app/[slug]/enter/an-invited-person-is-recognised.test.ts` — 11 assertions.

🔑 **The strongest one is derived from the HELPER OUTWARD:** it takes the path
`eventBoardHref` actually returns and proves a Next.js route file sits at it. A
destination nothing serves is the "never proven reachable" defect with a URL in
front of it, and nobody writes a test for it.

🛡 **18 sabotages, every one occurrence-counted before → after, all 18 caught,
baseline green either side** — including deleting the route file itself, and
including each individual gate.

🪤 **AND THE SUITE RAN ZERO TESTS ON ITS FIRST INVOCATION, GREEN.**
`tsx --test "app/[slug]/enter/x.test.ts"` prints `# tests 0 … # fail 0`: the
brackets are a glob **character class**, so an explicit bracket path matches
nothing and exits 0. Every run here uses a pattern (`app/*/enter/*.test.ts`), and
the mutation harness refuses any run that reports zero tests. Recorded before,
re-measured today.

Verified: typecheck clean · **7925/7925** unit tests · all 22 lint scripts · every
column named in the two new reads confirmed to exist in prod (9 of 9), so neither
is a phantom.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-13 — a signed-in invited person is
recognised from the seat binding they already hold; the emailed sign-in link lands
them on the event, not on the organiser's dashboard.
