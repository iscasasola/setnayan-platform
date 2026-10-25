## 2026-10-25 · fix(access): a Limited helper can view the event but not change it — every dashboard action refuses them

Owner, live on `cale-ice`: *"when we give access as helper/limited on a guest — they should be only able to view and
not edit. we tried it and they can change table, delete guests, and more."* The ruling already existed (DECISION_LOG
2026-09-28, "Limited Helper can keep. may view but may not edit").

**What was live, measured.** The database already refused a helper's writes (all areas 'view' + the RESTRICTIVE
`lh_ro_*` policies of migration `20271251336140`). The production edge log for the owner's test helper shows
`PATCH /rest/v1/guests` answered **200 with zero rows** — a refused UPDATE under RLS is an empty success, so the server
action returned normally and the screen showed the change as made. Actions that write with the service-role client are
not fenced by RLS at all.

**The fix.**
- `lib/limited-helper-gate.ts` (pure) + `refuseLimitedHelper` / `limitedHelperRefusal` in `lib/host-gate.ts`: one
  question — `public.is_limited_helper(event_id)`, the SAME SQL predicate the restrictive policies use — asked first by
  every server action under `app/dashboard/[eventId]` (131 files · 432 exported actions; all but 32 reads / own-row / couple-only ones, each listed with its reason). An action whose screen prints
  `{ ok: false, error }` returns "You can view this event but not change it." (shown in place through `plainRefusal`);
  the rest throw it. A check that does not answer refuses (never lets a write through).
- `app/dashboard/[eventId]/_components/view-only-line.tsx`: the helper reads that one line at the top of every event
  page (a thrown server-action message is replaced by a generic one in production, so the page says it itself).
- Guests: a delegate whose guest-list area is not 'edit' gets the list with nothing that writes offered (Select, Remove,
  Add, row verbs) — the same seam as the phone's last copy (`writesOff` in `guests-screen.tsx`).
- Guards: `app/dashboard/[eventId]/every-action-refuses-a-limited-helper.test.ts` (AST, per function, derived +
  floored file set, reasoned `NO_EVENT_WRITE` allowlist for reads; sabotage-proved) · `lib/limited-helper-gate.test.ts`
  · a db test that `is_limited_helper` is true for a viewer seat and false for a co-host, the creator and a removed seat.

Not done here: the guest CARD (opened from a row) still draws its edit controls for a helper — the server refuses each
write and the view-only line explains why.

SPEC IMPACT: None — implements the existing 2026-09-28 ruling; no decision changed.
