## 2026-08-05 · fix(guest-site): the coordinator's announcement arrives on its own

**SPEC IMPACT:** None (no schema change — no new table, no realtime publication).

The day-of announcement was resolved **once, server-side, at render**. So *"phones
down, the ceremony is starting"* reached only the guests who happened to reload —
and nobody reloads a page they are already looking at. On the one day the product
exists for, the loudest thing it can say was arriving by accident.

**Which realtime pattern, and why.** Both shipped patterns were already in the
codebase, so this was a choice, not a build:

- **`postgres_changes`** (budget · chat · seating) honours RLS. It cannot work
  here: a wedding guest holds a signed **cookie**, not a Supabase auth session,
  so to Supabase they are anonymous. Making the rows readable by `anon` would
  publish every couple's announcements to anyone who could guess an event id.
- **`broadcast`** (the photo wall) has no RLS at all — which is exactly why the
  payload is **empty**. What travels is *"there is something new for this event"*,
  already implied by the page being live. The words come from a server action
  that checks the guest's own cookie and pins the request to their own event.

🔑 **The ping is a hint; the poll is the guarantee.** Venue wifi drops channels
constantly, so a 45s timer and a visibility-change catch-up sit behind it. A
dropped channel costs latency, never the message — the reasoning the photo wall
already states for its tiles. The send is wrapped so it can never fail the write
that already succeeded.

🔑 **A failed read never blanks a standing announcement.** "Phones down"
disappearing because one fetch stumbled is worse than it arriving late, and this
one is safety-adjacent — so only a real message ever replaces a real message.

`eventId` stays optional and the effect returns early without it: a caller that
forgets the prop would otherwise subscribe to `announce:undefined`, a channel
every event on the platform would share.

`announcement-live.test.ts` — 6 tests, all mutation-verified, including the
empty-payload rule and the own-event pin.
