# HANDOVER — rd/call-time-per-role · started 2026-10-18 ~13:10 PHT by the controller

Owner, 2026-10-18, verbatim: "Call time: each role will have their call time." (after the controller explained: today a
call time can only be set in an old form in the desktop Maker's Dress code scene Content, so not on the phone; guests in
the wedding party see it above their outfit — dress-code-widget.tsx `mine.callTime`, "⏰ THE CALL TIME SITS ABOVE THE
OUTFIT"; recommendation accepted: put a call time next to each role in the Mood Board & Dress Code editor, where the
role's outfit is set, and retire the old form's call-time field.)

BUILD (Rule 0 — find where callTime is stored and read today; extend, never a second home for the fact):
1. In the Mood Board & Dress Code editor (DressCodeListsForm / the per-role rows that #6617 "each role presented by its
   figure and its colours" draws), each role gets ONE "Call time" field — the house time picker if one exists (grep), a
   PickMenu dropdown if it is a set of choices (memory: any set of choices is a dropdown), never a free-text hack.
   Phone first (375), in place (no "edit elsewhere" links), saved through the same save path (it now merges from base —
   #6626; do not rewrite save code, call it).
2. The guest page keeps showing the reader's own role's call time above their outfit (already built) — now fed from the
   per-role value; a role with no time shows nothing.
3. Remove the call-time field from the old desktop scene Content form (keep the form's other fields — headline,
   guidance, figure switch, notes, do/don'ts — those are not part of this ruling). Existing values must carry over
   (read the old field as a fallback, or migrate it) — nobody loses a time they set.
4. Prints that show the dress code (#6628 made prints read the page's dress-code rows) show the call time per role
   if they already show times; otherwise leave prints alone.
Tests + sabotage; 375 px WebKit shots (light + dark) of the editor with a time per role and the guest view as that role.
Own walk folder (scratchpad/call-times-walk/). Other builders running: Google sign-in, two-hosts round 3 (save paths),
Maker own-section photos, Papic capture — do not touch their files. Never open the owner's cale-ice Maker.
Shots → ~/Documents/Claude/Projects/shots-2026-10-18/<pr>/. Fragment changelog.d/rd-call-time-per-role.md (SPEC IMPACT: the
controller records the DECISION_LOG row).

## STATE (builder, 2026-10-18)
Rule 0 found: the call time ALREADY has one home — `dress_code_config[roles|groups][key].callTime` (`RoleAttireRule.callTime`,
lib/role-dress-code.ts). The guest page reads it through `resolveAttireFor` (the reader's Studio row) → dress-code-widget
`mine.callTime`. The Studio (mood-board-studio.tsx) already SHOWED it read-only ("Arrives 2:00 PM" in each row's header).
The old desktop form (`DressCodeFields` → RoleAttireField/GroupAttireField, Maker Dress code scene) was the only writer.
No migration needed: same field, so every old time shows in the Studio as-is.
Built so far (step 1, committed):
- lib/mood-board-studio.ts: `callTimeOf`, `withCallTime` (a row with no Wear has no line → unchanged).
- Studio: `CallTimeRow` per row (not guests) — native time field (house pattern), saves on blur via `saveDress`; Clear;
  "Pick what they wear first" when no Wear. Header "Arrives …" now reads the live draft.
- Old form: call-time inputs + CarriedAttire `_call_time` removed; `updateDressCode` `withCallTimesCarried` keeps stored
  times for a tier that posted none (a poster that still sends them is read as before).
- Prints: no times shown today (dressCodeLines) → left alone.
DONE: tests (new lib/each-role-has-its-call-time.test.ts; 2 updated) — 274/274 in the touched files; 12/12 sabotages red.
Lab fixtures carry times (details-lab ?attire=shared; guest lab ?as=1&asrole=… now also draws Me › Arrive by).
Walk (lab, Chromium touch + WebKit iPhone 13, 375, light + dark): scratchpad call-times-walk/ → shots copied to
~/Documents/Claude/Projects/shots-2026-10-18/<pr>/. Baselines regenerated (no-card, label-contrast-dark: 2 → 1 each, mine).
PR #6635 (draft, do-not-auto-merge, auto-merge off). NEXT: watch CI.
