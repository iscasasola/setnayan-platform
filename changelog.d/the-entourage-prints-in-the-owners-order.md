## 2026-09-20 · feat(entourage): the owner's printing order, and family on the page at last

⚖ OWNER 2026-09-20, verbatim: *"1. Maid of Honor & Best Man ... 2. Principal
Sponsors ... 3. Secondary Sponsors ... 4. Bride's Crew & Groom's Crew ...
5. Bearers ... 6. Flower Girls"*, with Parents and Immediate Family above all of
them.

- The honour attendants move from fourth to first of the entourage proper —
  they sat under BOTH sponsor groups until today.
- Bearers and Flower Girls become two headings. They shared one, which printed
  a flower girl under a heading that called her a bearer.
- "Bridesmaids & Groomsmen" → "Bride's Crew & Groom's Crew" (heading only; the
  label beside each name stays Bridesmaid / Groomsman).

🔴 **VISIBILITY CHANGE, not a layout one.** `bride_immediate_family` and
`groom_immediate_family` appeared in NO group and therefore on no page — a
couple who marked their siblings found them nowhere. They now publish. Because
`ENTOURAGE_ROLES` is derived from the group list and is also the query's
`role.in.(…)` filter, this makes those people's real names readable by anyone
who can open the invitation: the entourage section is NOT behind the
recognised-viewer gate that hides the plain guest list.
`landing_page_visibility` remains the only control that closes that door.

Also: **the printed order was never stable.** Neither entourage query carries an
`ORDER BY`, so within one role the names arrived in whatever order Postgres
returned and could reshuffle between page loads. Names now sort by surname then
given name, per ROLE rather than across the group (the role order inside a group
is itself meaningful — ninong before ninang). This is the DEFAULT: when the
couple can drag their own order, that override sorts first and this stays as the
tiebreak.

Guarded in `lib/entourage.test.ts` (23 tests), including the property that
matters — the same people fed in two arrival orders produce one identical
printed result. Both sabotages (sort removed; group renamed) were confirmed red.

SPEC IMPACT: None — no locked decision changes. The 2026-09-14 order note in
`lib/entourage.ts` is amended in place with the owner's new ruling rather than
deleted, so the reasoning behind the old order stays readable.
