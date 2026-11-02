## 2026-10-15 · test(march): a drag on the Wedding March never loses or doubles anyone (drop, draft, Undo)

Owner, 2026-10-14: *"while dragging a name in wedding march now, we lost Bridgette for a while. needed to undo to find her back."*

- New property guard `apps/web/lib/a-march-drag-never-loses-anyone.test.ts`: thousands of seeded random drags (every source the march draws dropped on every target kind) on maria-and-jose's lab march and the owner-shaped one (45 walks, tied walks, a person with two roles). After every drop the people are the same set, each exactly once — in what the drop draws at once (`planMove`), in the draft as the server lays it back (`replayMarch`), and after the toast's Undo. Seen red under two sabotages (a "not walking" replay that forgets the tray; a join that never places the joiner), then restored.
- Walked in a browser on the Maker lab (Chromium 375 x 812, mouse and touch): real drags across rows, into gaps, onto the tray and onto empty page, then Undo — nobody vanished or doubled.

SPEC IMPACT: None.
