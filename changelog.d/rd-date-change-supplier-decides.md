## 2026-10-02 · feat(dates): a clashing date goes to the supplier in conflict — Move or Unlock — and a fitting date applies with a notice

Owner rules, DECISION_LOG 2026-10-01 ("A CLASHING DATE GOES TO THE SUPPLIER IN
CONFLICT", "THE CLASHING-DATE FLOW — APPROVED WITH THE CONTROLLER'S THREE
SAFEGUARDS", "BUDGET IS FOR TRACKING, NEVER FOR LIMITING") and 2026-10-02 Q8.
The supplier side of #6241.

**The ask.** A clashing pick in the Maker's Details › Date now offers "Ask them to
move or unlock?" behind ONE confirm. Yes → one request (`event_date_change_requests`)
naming the conflicting booked suppliers — named by the server's own availability
read (`datePickClash`), never by the browser. The event keeps its date, guests see
nothing (RLS is couple-only, never `current_event_ids()`), and the couple can
withdraw anytime.

**The supplier.** Each conflicting supplier gets a `date_change_requested` notice
(emailed — on the allowlist), and Today's Next card becomes "Date change request"
whenever one waits (`nextAnswerOf`). The desk card has two buttons: **Move to
<date>** · **Unlock my service**, through one action (`vendorAnswerDateChange`).
Unlock is the couple's own Undo done for them (status → considering, pool
reservations released, a fee-held day reopened); with money logged, the booking's
OWN terms (`event_vendor_policy_acknowledgements`) go onto an admin case
(`force_majeure_flags`, type `other`) — Setnayan never computes a refund.

**The deadline.** After 3 days unanswered, Home offers keep waiting · drop that
supplier (the same release) · cancel the change. Home shows "Date change: n of N
suppliers answered".

**The date.** When every conflicting supplier has moved or unlocked, the new date
enters the draft and goes live only through Apply. Apply's `eventDateRefusal` is
relaxed ONLY for a cleared date (`dateMoveClearance`, fail-closed): one every booked
supplier can do (Q8) or one every clashing supplier moved to. Each booked supplier
then gets "The date moved to <date>" (`date_moved`), and their held day and pool
reservation follow the date (`events_booked_dates_follow_the_event`). Event
Details' `updateEventDate` keeps the lock (unchanged).

Budget never enters any of it (guarded in code and in the functions' SQL).

Server actions: 1225 → 1225 (`vendorAnswerDateChange` added; the unwired
`markGuestsInvitationSent` un-exported). Couple intents ride `hubDraftAction`
(`date_change`).

SPEC IMPACT: None
