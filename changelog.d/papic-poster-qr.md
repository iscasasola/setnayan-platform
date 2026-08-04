## 2026-08-01 · feat(papic): the poster QR — one code, anyone scans, camera on the shared pool

Owner: *"i cannot find the qr for the papic services"* → **"B now and A next."**
This is A. B (#4022) made the copy honest; this makes it true.

**One QR per event.** Print it, put it on a table, anyone who scans gets their
own camera shooting into the shared pool. Until now every Papic QR was a
per-SEAT claim link — single use, first scanner takes it — so the Pool card's
"every guest who scans your QR" had nothing behind it.

**Owner-locked bound, verbatim: "No limit — first come, first served."** No
per-scanner allowance, no camera cap, no host approval.

⚠ **What bounds it, then.** The pool's own fence, and only that.
`papic_reserve_event_points_for_seat` fails CLOSED — it refuses the shot that
would overshoot and returns 0 without touching the ledger (verified on prod:
50 → 41, over-spend refused, exact fit allowed, next shot refused). So unbounded
cameras still cannot spend more than the event holds. **The limit is the purse,
not the door** — worth stating, because "no limit" sounds like there is none.

**Added**
- migration `20271031174520` — `events.papic_pool_token` + rotation stamp, unique
  partial index, **no backfill**: the token is a capability, so it exists from
  the moment a host opens the QR surface and never for an event that has no use
  for a poster.
- `lib/papic-pool-join.ts` — lazy mint, rotate, resolve, and seat-on-demand at
  index base **300** (clear of 100–102 free pool, 110 free One, 200+ paid), with
  a bounded retry against the `(event_id, seat_index)` unique index for two
  simultaneous scanners.
- `/papic/pool/[token]` — the scanner's page. It renders a button and **nothing
  else**; the camera, the anonymous session and the seat are all minted by the
  server ACTION on POST. Chat apps fetch a URL the instant it is pasted, so a
  GET-minted camera would burn seats before a guest arrived.
- the couple's poster on the crew page + `/crew/poster` to print it.

**Refusals kept** (they prevent broken, not abuse): token must resolve · Papic
must be on · a pool must EXIST. An *empty* pool is deliberately not a refusal —
running out mid-party is normal, the capture screen already says so, and closing
the door at zero would strand guests who scanned seconds earlier.

## 🪤 The ACL boilerplate that would have been a privilege escalation

The house rule is "every new table/view ships OPEN — REVOKE in every migration".
Applied reflexively here it would have been a **widening**. Measured on prod
first:

```
anon           DELETE, REFERENCES, TRIGGER, TRUNCATE
authenticated  DELETE, REFERENCES, TRIGGER, TRUNCATE
```

`authenticated` holds **no select/insert/update** on `public.events`. A
reflexive `grant select, insert, update, delete … to authenticated` would have
handed every signed-in user direct CRUD on the events table. A column inherits
its table's grants and no table or view is created here, so the migration
touches no ACL at all. **Boilerplate is not automatically safe; the grant you
"restore" may never have existed.**

SPEC IMPACT: `DECISION_LOG.md` — poster QR shipped, bound = none (owner
2026-08-01), pool fence is the only limit.
