## 2026-08-17 · fix(guards): the writer detector could not see a table named by a constant

Blind spot #5, found the day after the other four, by the one baseline line
whose own column comment contradicted the measurement.

`event_vendor_preferences.auto_send` was recorded as a gate with no handle
because nothing appeared to write it. The column comment said "Written by …".
**The comment was right and the detector was wrong:** `lib/event-preferences.ts`
writes it as

```ts
const TABLE = 'event_vendor_preferences';
await client.from(TABLE).upsert({ …, auto_send: autoSend, … })
```

and the detector only understood a string literal. A real checkbox —
"Auto-send to my next inquiries" — has been writing it all along. 18 call sites
in this repo use `from(CONSTANT)`.

🔑 **When a column's own comment contradicts this guard, suspect the guard
first.** A missed WRITE is the expensive direction: it puts a working screen on
a list of broken ones, and a list with wrong entries on it stops being read.

Fixed in `lib/gate-writers.ts` rather than excused with a baseline line, so the
finding count drops on merit. The baseline keeps the worked example. Caught by
the guard's own stale-line check, which named exactly this one row and no other.

SPEC IMPACT: None.
