## 2026-09-18 · fix(supplier-desk): drop two "do not join" rows the platform already fixed (SUP-53/58)

`ANSWERS_THAT_DO_NOT_JOIN` in `apps/web/lib/answers-desk.ts` still withheld
`waitlist_pick` and `crew_shift` from the supplier answers desk, citing
defects that no longer reproduce: waitlist picking now notifies the picked
couple (`waitlist_picked`, `vendor-dashboard/calendar/actions.ts`, fixed
2026-08-29) and manpower crew shifts can be posted, seen, and accepted by a
host/vendor (`manpower_gigs`, migration `20260704020000`, RLS policies
`manpower_gigs_host_reads_own_event` / `manpower_gigs_vendor_reads_own`, and
`apps/web/app/vendor-dashboard/manpower/actions.ts`). Both rows are removed;
the list still guards the two rows whose defects are real
(`song_request`, `payment_claim`).

Added an executable check, not just a grep at review time:
`song_request stays withheld only while its cited defect is real` in
`apps/web/lib/answers-desk.test.ts` greps every non-test application file for
a caller of `guest_submit_song_request` / `open_submit_song_request` and
fails the moment one appears — the next session to wire song requests into
the app (PR #5601 in flight) will be told, in the test output, to update
`answers-desk.ts` rather than leaving another stale row. `payment_claim`'s
defect ("no 'no', and it cannot be taken back") is a UI/DB shape claim, not a
call-site claim, so it is left as the existing prose-guarded row.

SPEC IMPACT: None.
