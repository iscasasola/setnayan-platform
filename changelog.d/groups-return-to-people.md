## 2026-10-28 · fix(groups): every way back from a group lands on People › Groups

Owner, 28 Oct: *"an issue on groups is it makes us go back to groups which was not part of people. it did not return to
people"*.

- The group page's back link, about ten group actions (leave · archive · not found · not a member) and the events
  board's "N more groups" row sent people to the old standalone `/dashboard/samahan` index. They now go to People ›
  Groups — one address, `PEOPLE_GROUPS_HREF` (`lib/people-views.ts`); refreshes revalidate `/dashboard/people`.
- The old index now FORWARDS to People › Groups and carries the left / archived note, which People says ("You left the
  group."). A group's own page `/dashboard/samahan/<id>` is unchanged.
- Guard `lib/groups-return-to-people.test.ts`: nothing in the app sends anyone to the bare old index; the old page
  forwards to exactly People › Groups; People says the note. 3 sabotages red, restored green.
- Re-aimed (they pinned the old page, which now draws nothing): `small-rulings-copy` — the Groups empty state still
  names no parish, now on People › Groups; `an-empty-screen-is-deliberate` — no inline copy of the card on the old page.
- Ugat screens map regenerated: `/dashboard/samahan` is now a forwarding stub to People › Groups.

SPEC IMPACT: None (bug fix; DECISION_LOG 2026-10-28 rows on Groups unchanged).
