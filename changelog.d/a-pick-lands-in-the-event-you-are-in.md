## 2026-09-08 · fix(bench): a pick lands in the event you are standing in

Owner pressed **INQUIRE** on the bench and got *"We couldn't save that vendor.
Nothing was added."*

### One cause, two symptoms

`saveVendorToPicks` ignored the event it was called from and re-derived a
"primary" one. The bench is scoped to ONE event **by its own URL**, so a
supplier saved on event A's bench could land in event B — silently, and
correctly as far as every existing test was concerned.

It surfaced because the account holds **two events flagged `is_primary = true`**
— nothing enforces one — a wedding and a *"Movie Night"*:

| event | type | primary |
|---|---|---|
| Cale & Ice | wedding | **true** |
| Movie Night | **date** | **true** |
| Maria & Jose | wedding | false |

`resolvePrimaryHostEvent` sorts primaries first and takes `sorted[0]` — a stable
sort over an **unordered** query — so which one wins is arbitrary per request.
That same coin toss also pointed `/explore` at a `date` marketplace and
announced *"Date vendors are being recruited for Setnayan"* while a verified
wedding band sat inside it.

### The fix, and the trap inside the fix

The bench now sends its own `event_id`. **An id that arrives in a form is a
claim**, so it is checked before anything is written to it — passing the id
without checking it would have been a worse bug than the one it replaced.

`lib/events.ts` gains `userHostsEvent()`, sharing its definition of "hosts" with
`resolvePrimaryHostEvent` — both membership models (legacy
`event_members.member_type='couple'` and the iteration-0048 `event_moderators`
host roles), archived events excluded. 🔑 Two definitions of who hosts an event
is the same shape as the two definitions of "this shop is live" that cost seven
broken code paths.

`/explore` keeps the primary fallback: that page genuinely has no event on it.

### And the message says which refusal it is

Four distinct causes — signed out, no event, **not your event**, and a real
database error — all rendered as one sentence, while the action knew the
difference every time. `not_your_event` is now its own status with its own copy.

Mutation-tested four ways: stop sending the eventId (the original bug), trust it
without the host check (worse), delete the primary fallback (breaks `/explore`),
and drop the moderator membership model. Each turns it red.

⚠ **NOT fixed here:** nothing stops a user having two primary events. A partial
unique index would make it impossible; that is a migration and an owner call.

SPEC IMPACT: None.
