## 2026-10-08 · feat(discover): your own public events join "Upcoming from people you follow"

Owner, verbatim: "on discover. you placed there event that from people you follow, include your own account there."
The people shelf now also lists events the viewer HOSTS (`event_members.member_type = 'couple'`), merged into its
soonest-first order and marked "Your event" (`relation: 'you'`). The allow-list is unchanged — only public, dated,
unfinished, slugged, unarchived events list — and only condition 6 ("not already a member") is waived, and only for
an event the viewer hosts; an event they merely attend still never lists. One event, one place: never also on the world shelf.

SPEC IMPACT: None (follows the owner's direct instruction; DECISION_LOG "DISCOVER IS THE DOOR" ordering kept).
