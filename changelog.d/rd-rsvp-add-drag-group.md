## 2026-10-10 · feat(maker): the RSVP stage adds a line, drags to reorder, and groups (steps 5–7)

Owner's ruling (spec corpus `Maker_RSVP_Per_Element_Add_Drag_Group_LOCKED_2026-10-09.md` §3, approved prototype
`prototypes/maker_rsvp_add_drag_group_2026-10-09.html`): ＋ is back on the RSVP stage and adds a line (Heading ·
Message), a held line drags to a new place, and several lines can share one background as a group.

**5a · the database has room, and a live fault is cured**

- Migration `20271267092468_events_rsvp_ask_config_room_for_added_lines.sql`: the size CHECK on
  `events.rsvp_ask_config` goes from 2,048 to 24,576 bytes. Only the CHECK changes — no column, no data, no grant,
  no RLS, no view.
- The app's own refusal (`RSVP_CONFIG_ROOM`, `apps/web/lib/rsvp-look.ts`) goes from 1,900 to 19,000 JSON bytes, in
  the same change. The two numbers are a measurement, repeated on the replayed schema by
  `apps/web/tests/db/rsvp-ask-config-has-room.db.test.ts`: the worst config the app's shape allows is 17,327 JSON
  bytes and 19,025 bytes as stored (1,698 over); with no typed words the stored form is ×1.284 its JSON. So
  nothing the app saves is over about 20,700 bytes stored, and even all-structure 19,000 × 1.29 < 24,576.
- FOUND AND CURED: the old pair did not hold. The app counts JSON bytes, the database counts the stored value, and
  the stored value is the bigger one — a look-heavy config a little under 1,900 JSON bytes was over 2,048 as stored,
  so the app passed it and the database refused it at Apply. The db test writes that case down as a measurement.

SPEC IMPACT: None beyond the locked record already in the corpus (`Maker_RSVP_Per_Element_Add_Drag_Group_LOCKED_2026-10-09.md`
§4–§5 names the cap and the migration). The measured numbers confirm §5's (24,576 / 19,000).
