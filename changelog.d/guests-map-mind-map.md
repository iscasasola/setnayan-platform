## 2026-10-30 · feat(guests): Guests › Map is the mind map — the couple in the centre, groups as hubs, faces around them (slice 10)

R4 slice 10 (HANDOVER: *"Map = the prototype's mind map (≤6 hubs on a ring + 'Other households · N' drill-in, '‹ All
households', couple centre, 36 px faces, …, fit on grouping change; grouping = the shared ⇅ Group by)"*; prototype
`mapHubs` / `ringsFor` / `facePos` / `fitMap`). The Map drew a left-to-right tree of name pills.

- Pure layout `lib/guest-mind-map.ts`: the ⇅ Group by's groups (the same `mapTree` of the same filtered list the List
  shows) as hubs on one ring around the couple — ≤ 6, the smallest beyond five fold into **"Other groups · N"**, which
  opens into its own map; each hub's people as 36-px faces on rings around it, ≤ 10 (**"+N more"** opens the hub alone);
  one hub alone shows everyone; a side's own groups fold into the side's hub.
- `guest-map-canvas.tsx` draws it — the couple · hub buttons (count; tap = select ring) · labels · faces (initials in
  the side's colour, the reply on the border; a face PEEKS, slice 6d) · **‹ All groups** after a drill. The shipped
  measure-to-the-dock, first-open fit and pinch / ctrl-wheel zoom are unchanged; a new grouping (or search) re-fits and
  closes a drill.
- NOT in this PR (follow-ups, said plainly): hold-drag a face onto another circle (a write per Group by — side · role ·
  RSVP · group), and the circle toolbar (Rename · ＋ Add guest here · Sit together ▾).
- Guard `lib/the-map-is-a-mind-map.test.ts` (executed layout). `map-is-the-screen.test.ts` still holds the canvas.
- ⚠ Stacked on the peek PR (a face peeks). Merge after it.

SPEC IMPACT: None — builds the approved prototype's map.
