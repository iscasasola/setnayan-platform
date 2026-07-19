## 2026-07-11 · fix(guests): quickCreateGroup reuse-lookup respects team_side

`quickCreateGroup`'s 23505 (duplicate) fallback resolved the existing group by
label ONLY (`.ilike('label').maybeSingle()`), but the `guest_groups` unique key
is `(event_id, lower(label), team_side)` — the same label legitimately exists
across team sides (a bride-side and a groom-side "Friends", per migration
`20260607050000`). With a cross-side namesake present, the label-only lookup
returned >1 row, `.maybeSingle()` threw, and a legitimate quick-add reuse of the
'both' group failed with "A group with that name already exists."

Fix: fetch the same-label rows and resolve the exact conflicting row in JS via a
new pure `lib/guest-group-reuse.ts::pickReuseGroup`, matching the full unique key
(exact `team_side` + case-insensitive exact `label`). The insert's `team_side`
is now held in one const so it can't drift from the reuse-lookup. The JS exact
label compare also neutralizes the pre-existing hazard where a label containing
`%`/`_` made the `ilike` fetch over-match unrelated groups. Unit-pinned by
`lib/guest-group-reuse.test.ts` (cross-side, case-insensitive, wildcard, trim,
no-match, empty).

Also documents a known narrow, pre-existing gap in `add-single-guest-core.ts`
(a freshly-minted EXTRA group whose membership attach fails AFTER a successful
guest insert is left empty — outside the T18 insert-failure window closed by
#3125) as a tracked follow-up comment, no behavior change.

SPEC IMPACT: None — bug fix; no schema, SKU, pricing, or API change.
