## 2026-07-27 · feat(song-desk): guest song requests — the data layer for "a guest asks, the act accepts"

Owner, 2026-07-27: *"they will mark accept if they play. (so a bar can use us
everyday to document their event and the band play and the guest can request a
song via app as well)"*

**ACCEPT IS THE SETLIST — which is why this ships no ordering table.** The act
taps Accept; the accepted rows, in the order accepted, ARE the set. That answers
the deferred question from the song desk PR (#3803) better than the
position-column design I had sketched: one action, one table, no ordering to
maintain.

**Two lanes, because a bar has no guest list** (owner-chosen: "both — depends on
event type"):

| lane | who | identity | cap |
|---|---|---|---|
| `origin='guest'` | wedding guest | a real `guests` row — the same identity `guest_submit_column` already trusts | 5 / hour |
| `origin='open'` | bar / gala walk-in | the `events.master_qr_token` they scanned + an opaque per-device key | 3 / hour / device |

Both land in one table so the act reads **one** inbox.

**No new event type was needed.** `gala_night` and `simple_event` are already
live in `event_type_vocab`, and `LIFE_GATE_BY_TYPE` limits only 5 life types
(debut · christening · birthday · graduation · gender_reveal) — everything else
is unlimited. A bar can already create a night every night. This avoided the
~30-touchpoint new-event-type checklist entirely.

**New — `supabase/migrations/20271014090000_guest_song_requests.sql`.**
`event_song_requests` + two service-role RPCs.

- **NO INSERT policy, by design** — the shipped `guest_columns` pattern
  ("guest authoring goes ONLY through the service-role submit RPC; zero-account
  guests have no `auth.uid()`"). A requester on either lane may have no account,
  so there is no `auth.uid()` for a policy to test. An open INSERT policy on a
  public route is the exact shape of the 2026-07-26 findings.
- **RPCs revoked from `PUBLIC, anon, authenticated`** — naming the roles, not
  just PUBLIC, per the verified-against-prod note in `supabase/security/README.md`.
- **The shared block lever is honoured** — `guest_message_blocks` already
  silences guest columns and Kwento; a song request must respect it too, or the
  lever has a hole.
- **One song = one row** (`UNIQUE (event_id, song_id)`), so a room of 200 asking
  for the same track is **one** decision, not 200. A duplicate is a silent no-op,
  not an error thrown at the guest.
- Read + decide (UPDATE) go to the booked act ∪ host ∪ admin, reusing
  `current_vendor_booked_event_ids()` — the same one definition of "booked" as
  the schedule-blocks and song-picks policies.

**New — `apps/web/tests/db/song-requests.db.test.ts` · 14 tests**, asserted
against a full replay of all migrations. Covers the boundaries, not the happy
path: `anon` holds no privilege; the policy set is exactly `{SELECT, UPDATE}`;
neither RPC is EXECUTE-able by `anon`/`authenticated`; a **wrong QR token
inserts nothing**; the block lever bites; both rate caps bite and one device
hitting its cap does not mute another phone; casing/spacing collapse to the same
song; and neither lane can forge the other's identity.

**Changed — `supabase/security/exposure-surface.baseline.txt`** (6178 → 6192).
Regenerated in the same PR per the README. Every added line reads
`anon=-` — including `anon_key` — and **no `func` line appears**, which is the
proof the RPC revokes held.

⏭ **NOT in this PR — this is the data layer only.** Still to come: the guest-side
request button on `/[slug]`, the accept/decline UI in the song desk, and the
`NEXT_PUBLIC_*` flag to switch it on. Shipping the capability first with its
boundaries pinned is the same rhythm as the specialization gate (#3778, "capability
only, unwired") and the day-of frame (#3796).

⏭ **Pricing deliberately untouched** — owner: "free for now, decide later."
Nothing here bills.

SPEC IMPACT: `DECISION_LOG.md` — row appended recording the accept-is-the-setlist
model, the two-lane identity split, and that no new event type was required.

---

## 2026-07-27 (same PR) · feat(song-desk): the act opens and closes the requests window

Owner: *"the band will open or close accepting requests."* A band does not want
requests during the ceremony, during their break, or after last call.

**New — `supabase/migrations/20271014100000_song_requests_open_close.sql`.**

**One column, no new table, no new policy.** `vendor_dayof_configs` is already
the sparse per-(vendor × event) day-of config the module configurator writes,
and the vendor already holds INSERT/UPDATE/SELECT on their own row via
`current_vendor_profile_ids()`. So `song_requests_open BOOLEAN` lands there and
the act can flip it with **nothing new about who may open the window**.

**CLOSED is the default, and that is the point.** A band that never touches the
toggle never receives a request — the feature cannot arrive unannounced at
someone's gig, and the whole guest-request path is inert on every existing
booking the moment this ships.

**Any open act opens the room.** The pool is per-event (one inbox), the toggle
is per-act. With two acts booked, either one accepting opens it — a guest should
not have to know which band is on stage to ask.

Both lanes now check `song_requests_open_for_event()` (SECURITY DEFINER, since
the caller is a guest with no read on vendor configs; returns one boolean and
leaks nothing about who is booked) and raise `songreq:closed` **before** the
block or rate-limit checks — so a guest is never told "you are blocked" about a
room that was not taking requests anyway.

**6 more DB tests (20 total):** closed-by-default refuses both lanes and stores
nothing · opening starts them landing · closing mid-night goes quiet *without*
retracting requests already made · "closed" is reported ahead of "blocked" ·
opening one act's window does not open another event · the gate helper is not
anon/authenticated-callable.

### ⚠️ Pre-existing exposure found and CLOSED (not introduced here)

Adding the column surfaced that **`vendor_dayof_configs` already granted `anon`
`SIUD` at table level**, with every existing column reading `anon=SIU`. The
table never got the explicit `REVOKE` every relation in `public` needs. The new
column merely inherited it.

Not exploitable today — all four policies are `TO authenticated`, so an anon
caller held the grant but no policy admitted a row. It is the shape that becomes
a hole the day someone adds a permissive policy, so it should not survive a
migration already touching the table:

```sql
REVOKE ALL    ON TABLE public.vendor_dayof_configs FROM anon;
REVOKE DELETE ON TABLE public.vendor_dayof_configs FROM authenticated;  -- backs no policy
```

Net effect in the baseline: the `|anon SIUD` row is **gone** and all 7 columns
flip `anon=SIU` → `anon=-`. This is a **NARROWING**, which the freeze allows
without ceremony. Baseline 6178 → 6192 overall.
