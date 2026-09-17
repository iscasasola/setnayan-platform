## 2026-09-18 · fix(papic): a reported photo is flagged wherever it lives

The couple's Papic moderation page fetched **every** `user_reports` row for the
event into `reportedSet` — and then consulted that set in exactly **one** place,
against a `papic_guest_captures` id. The seat-photo grid never asked.

Measured on production:

```
select count(*) from papic_photos         where photo_id   = '1c178ae6…'  → 1
select count(*) from papic_guest_captures where capture_id = '1c178ae6…'  → 0
select count(*) from papic_photos         where event_id   = '0ccc7aa3…'  → 10
select count(*) from papic_guest_captures where event_id   = '0ccc7aa3…'  → 0
```

The one report on the platform targets a **`papic_photos`** row, on a
celebration with **10 photos and zero guest captures**. The read ran on every
page load and could never mark anything — a guest asked for their likeness to
come down and the couple who own the photograph were shown nothing.

🔑 **The repo's signature disease, and why it survived review:** the query is
there, the set is there, the badge is there. **The lookup was the missing half**,
and every piece around it looked correct.

One line computes `isReported` for the seat grid; the badge is the one the
capture grid already draws, reproduced rather than redesigned.

**The guard counts.** One lookup was the entire bug, so it asserts **one lookup
per grid (2)** and that **lookups === rendered badges** — a set consulted and
its answer discarded is the same bug in different clothes. Sabotage: the seat
grid ceasing to look fails 2, the capture grid ceasing to look fails 2, a
discarded answer fails 1.

⚠ **Honest scope:** the one production row is a test (`"Step-8 test"`) and was
actioned by a moderator on 14 September. The **mechanism** is the defect; no
real person is waiting.

SPEC IMPACT: None.
