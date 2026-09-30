## 2026-09-29 · feat(event-hub): the entourage and the day's own parts get their Style row — picks drafted, written at Apply

Follow-up to #6107 (every scene has three styles). The five parts with no section row — the entourage, Find
your seat, each guest's own photos, the announcements and the live hub — now have a home for their pick with
**no migration**: `events.style_preferences.scene_styles` (the existing JSON the QR look already lives in).

- **Draft → Apply, never live before Apply.** New hub-draft key `fixedStyles` (sanitised, merged part by part,
  undoable), classified at Apply against the live picks (free — never Pro, never held), and written by
  `hubDraftAction`'s existing Apply branch (**+0 exported "use server"**) through ONE read-merge-write,
  `lib/style-preferences.server.ts` → `writeStylePreferenceKey`. (Folded onto main 2026-09-29: the QR look is now itself drafted and applied by main's own Apply branch, so it no longer calls this writer.) Every other key
  of `style_preferences` is kept; a write that changed no row is a failure. Admin client after the host check
  (`authenticated` holds no UPDATE grant on the column); the live read is `events_host` (couple-scoped).
- **Guest page:** `lib/fixed-scene-styles.ts` resolves each part's style through the one registry. No pick =
  style A, byte-identical to before (tested for all five). The event shell already selects `style_preferences`
  (admin read), so no GRANT changes. The announcement's style is read in `app/[slug]/layout.tsx`; Theatre /
  Wall first draw the live player and the live wall together.
- **Maker:** the entourage's panel gets its Style row; Find your seat, guest photos, Announcements and Live hub
  get tiles on the stages where guests meet them (after the entourage), a panel with the Style row, and a
  stand-in on the Maker's canvas only (`maker-fixed-parts.tsx`) — the navigator and the canvas read one list
  (`makerDayPartsOn`).
- Registered in `lib/scene-styles-stages.ts` (Two sides: weddings only; Find your seat recommends The table
  number as a hint).
- Also fixes typecheck errors already on the framework branch: `HubDraftItem` narrowing in
  `hub-draft-actions.ts` and four tests.

SPEC IMPACT: DECISION_LOG.md "AS BUILT — the five fixed parts' styles live in style_preferences.scene_styles".
