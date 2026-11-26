## 2026-11-25 · fix(admin): studio, colours and moderation say what is true (final check area 8, batch 9)

- Reveal Studio: "Open their Event Hub" goes to the couple's Event Hub by its slug (it went to /{public_id},
  a 404). The switch that saved a value nothing reads is gone. A failed read of the house reveal settings
  withholds the editor, so a save cannot overwrite the real settings with the defaults.
- Website: every homepage widget row has Move up / Move down on a phone too.
- Journal Spotlights, the moodboard colour tags and the social queue say each failed read; Save tags and the
  autopilot form are off while their state is unread.
- Colours: the icon-tile colours and Liveliness switches (drawn nowhere yet) are no longer pressable; Band and
  Frames lose their stale "next update" tag. "Reset to current" is now "Built-in colours" and asks first,
  because it replaces the live set for every screen.
- Reviews: Escalate keeps an appeal in the queue for a second admin (no separate two-admin queue exists), and
  Reject or Escalate on an already-decided appeal says so and changes nothing. User reports: an escalated
  report stays open and never reads "Resolved".
- Live Studio channels: a failed connections read is said (no "Not connected" and no Connect over it);
  connect errors and statuses are plain words. Papic storage reads past the 1,000-row reply ceiling.
- Guard: `apps/web/app/admin/studio-and-moderation-say-what-is-true.test.ts`.
- Findings: A8·G-3 A8·G-5 A8·G-6 A8·G-7 A8·G-8 A8·G-10 A8·G-11 A8·F-8 A8·F-13 A8·F-14 A8·F-15 A8·F-16
  A8·F-18 A8·F-21 A8·F-25.

SPEC IMPACT: None. No amount, fee, plan content or sign-in rule changes.
