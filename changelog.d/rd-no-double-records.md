## 2026-10-18 · fix(event-day): no double records — a retry, a double tap or two tabs never write twice

Lane L1 of the event-day load audit (owner 2026-10-18: "making sure there are no overlaps"). Each guest write that a
bad venue signal can send twice now lands once; nothing the guest sees changes except honest errors.

1. **Plus-one seats** — `guest_plus_one_seat_mint` (migration `20271272305444`): one mint per bringer under an advisory
   lock, the couple's count re-read inside it, a live seat with the same name returned instead of a second one.
2. **Papic guest capture** — `papic_guest_captures.client_capture_id` + UNIQUE (guest, id) and a 9-arg
   `papic_record_guest_capture` (`20271272777206`): the phone mints the id at the shutter and sends it on every retry
   and from the offline queue; a repeat is answered with the first row before any meter, the R2 object is named by
   it, and the route puts back the pool booking on `duplicate`.
3. **Ask-to-join** — `guest_join_request_create` (`20271273586425`): one request per form (a browser-minted
   `request_key`), the per-event ceiling counted inside a lock on the event, and no second couple notice.
4. **"I sent it" gifts** — `event_gift_records.client_ref` + UNIQUE (giver, ref) (`20271274314846`): a retried Send
   is answered with the first record and can no longer carry a wish to "got" on money said once.
5. **Find-me door** — budgets per phone (signed cookie) first, the connection's sized for a venue on one Wi-Fi.
6. **RSVP notice** — the "changed" report is decided by a compare-and-set write, so two saves tell the couple once.
7. **Seat reconcile** — write errors are read; a lost chair race is planned again from fresh reads, then recorded.
8. **Guest-facing limits** — upload, QR rotate, live pairing and Papic buy/pay on the durable limiter.

Left, named: the Papic pool booking is a separate RPC before the record and can leak if the function dies between
them (not contained); the Papic media route and vendor qr-guard stay on the per-instance limiter on purpose
(reasons in `apps/web/lib/guest-limits-are-durable.test.ts`).

SPEC IMPACT: None.
