## 2026-10-10 · feat(hub): a scene can be shown or hidden PER STAGE — the stored value and every reader ("What guests see", step 1)

Step 1 of the owner's tick table (*"a table on event hub to know what
information they want to share… during Save the Date, RSVP, Invitation, The Day,
and Post Event"* → *"give them freedom to pick what they want to add. but have
our recommendation as the checked one"*). **No screen, no control, and nothing a
couple or a guest can see changes**: no control writes the new value yet.

**The value.** `invitation_widgets.config_json.stage_show`, beside `stage_order`
and shaped like it: `Partial<Record<'save_the_date' | 'rsvp' | 'event' |
'editorial', boolean>>`. `false` = hidden on that stage · `true` = shown on that
stage, over the event-wide eye and on a stage whose own list leaves the scene out
· no entry = our pick (`STAGE_SCENES`) and the event-wide eye decide, exactly as
before. No migration (jsonb).

**Its road** is `stage_order`'s: the draft sanitizer, the stage-by-stage merge
(`null` takes a choice back), the preview overlay, the Apply classifier (the
whole merged key, free), the live writer, the kept draft after a hold, the Apply
sheet's line ("Hidden on The Day"). An always-on row refuses it as it refuses
the eye. A scene of the couple's own that no guest sees today is still Pro to
put in front of guests — one stage at a time as much as all at once.

**One rule, every reader** (`lib/what-guests-see.ts`, pure):

- the guest page's list of scenes (`resolveSiteBodyPlan`, a listed guest and a
  reader with no key, open browsing off and on);
- what The Day draws WITHOUT its list: the Welcome's look and reminders, a
  guest's own schedule block, the directions;
- the love story's other tellers: the prose that stands in for a missing scene,
  the Our Love Story tab, the Save-the-Date film's view (its love story, its
  countdown, its gallery);
- the Maker: the navigator's list and fold, each stage's full order, the move
  action (live and in the draft).

A `true` is refused where the scene cannot be: after the day (countdown, what to
bring, camera cues), a Post Event preset off Post Event, "Two ways to celebrate"
anywhere, a guest's own scene for a reader with no key. On The Day the dress code
and the reminders stay on the Welcome (never a second copy in the list); under
the film the gallery stays the film's.

`sceneOnStage` / `whatGuestsSee` is the answer the table will read: drawn ·
hidden by the couple · not possible (with the rule) · our pick.

**Proof.**
- Recorded first, on untouched `origin/main` a316051dd, in a commit that touches
  no page file: 28 real guest pages (4 stages × two readers × three
  arrangements, and the Save the Date's two leads) by length and SHA-256
  (`every-stage-is-todays-page`). Unchanged after the build, and
  `site-body-fixture.golden.html` was not regenerated.
- A property test over 4,000 random events × 4 stages: the function, the page's
  plan and the Maker's list agree. And 480 questions put to the REAL page for 60
  random arrangements: what the function calls drawn is on the page.
- One test per reader, each reader switched back once and seen red.

**Not built (step 2 and 3), by design:** the table itself; re-aiming the Maker's
eye (`eyeWrite`, and `sceneDrawEffect` beside it) to the per-stage value; "Back
to our picks"; and every row that is not an `invitation_widgets` scene (E-Gifts,
Entourage, Your seat, the ticket, Announcements, Live, Camera, the reply card,
Names / date / place, Reveal, Post Event's own sections).

SPEC IMPACT: None beyond the row this implements — DECISION_LOG 2026-10-10
"OWNER IDEA + SHAPE — 'WHAT GUESTS SEE': A TICK TABLE OF INFORMATION BY STAGE,
FIVE COLUMNS" (the stored value's name and shape, `config_json.stage_show`, are
this build's proposal and are not yet in the corpus).

## 2026-10-11 · feat(hub): "What guests see" — the sheet, and the Maker's eye on the same value (step 2)

**The sheet.** A row "What guests see" in the Maker's Studio ▾ opens a tall
sheet: the prototype's table (six groups, five columns — Save the Date · RSVP ·
Invitation · The Day · Post Event), a status line, the key, and three buttons in
the lower third (↺ Undo · Back to our picks · Apply · N changes). It lives in the
Studio parts' own lazy chunk; the Maker's first load gains no code.

- **Every cell is read from `whatGuestsSee`** (`lib/guests-see-build.ts`, on the
  server, riding on the navigator's data). A tick = guests meet it; an empty box
  = hidden; the small dot = our pick.
- **Only boxes that work are boxes**: a scene on one of the four lifecycle
  stages. A scene that cannot be there is a dash with its one line. Every row
  that is not a scene (Names and date, Place, E-Gifts, Entourage, Reply card,
  Your seat, Digital pass, Announcements, Live, Camera, Photos of you, Reveal)
  is shown in its current state and locked — "This one cannot be changed here
  yet." — and so is every scene's RSVP column — "Not on the reply screens yet."
- **Saving is the Maker's own**: ticks wait in the sheet; Apply puts exactly
  those `stage_show` entries into the Event Hub DRAFT in one save through the
  work area's draft door; the Maker's ✓ publishes. Closing with ticks waiting
  asks first.
- A row switched off for the whole event keeps meaning "hidden everywhere":
  empty boxes with our marks, and one tick shows it on that stage only.

**The Maker's eye / Remove** now writes the same value: hide = off the stage on
screen, show = on it — never the event-wide `is_visible` / `mode`. The two stuck
states from step 1 are gone, and `sceneDrawEffect` knows a stage with its own
choice is not moved by an event-wide write. The editor outside the Maker keeps
the event-wide eye.

**One list fault fixed:** on The Day the Maker's fold said the dress code and
the reminders were "Not part of this stage" while a guest reads both on the
Day's Welcome; it now says where.

SPEC IMPACT: None beyond the row this implements (DECISION_LOG 2026-10-10 "WHAT
GUESTS SEE"). New couple-facing lines are listed in `GUESTS_SEE_WORDS`
(`lib/guests-see-table.ts`) for the owner to read in one place.

