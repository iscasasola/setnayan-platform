## 2026-11-13 · fix(post-event): the rest of the live walk after #7596 (F-W2-44 … F-W2-54)

A phone-width walk of the just-shipped Post Event story (#7596) found these. F-W2-43 (Reads as unreachable) shipped
alone in #7626. Each item below names its cause as found in the code; each is held by a test.

- **F-W2-44 · the Maker's "Parts of this page · 26"** listed other stages' pieces (Cover Scene, Greeting, Digital pass,
  Love Story) and Memories twice. Post Event is ONE page in the Maker, so every section on its canvas that no list
  claimed was "added" to it. `makerStageOwnsCanvas` (`lib/maker-part-groups.ts`): on Post Event a part is its own only
  when it is one of its scenes (`p:`) or the closing. Test: `maker-part-groups.test.ts`.
- **F-W2-53 · the pre-day invitation under the story.** After the day the stranger's page still drew the invitation's
  text cover (its "Swipe up" foot) and "Find your seat" below the story. `site-body.tsx` `storyLeads`: neither is
  drawn once the story is the page; the rest of the page below the story stays (the 2026-08-05 ruling in `phasedBody`
  — the guest's photos and their notice), and the door keeps its own row.
- **F-W2-49 · "From the day · 7 photos" shot four days before the day.** The gallery's Papic read and its count had no
  date bound (the clip and timeline reads did). Rows are now kept to the event's own Manila days
  (`capturedOnTheDay`, `lib/story-day-window.ts`) and the heading counts the day (`galleryDayTotal`, one bounded count
  started the moment the date is known). Test: `story-day-window.test.ts`.
- **F-W2-48 · "0 · THE DAY" and "No minute of this day has been written up yet".** A road with nothing to count reads
  as the diary (`roadCountsDown`); a day nobody wrote a minute of is not drawn for a reader (never an empty scene).
- **F-W2-52 · raw labels.** Every Papic guest pack is "Papic" in Powered by (`serviceLabelOf`), one line per service;
  the colophon's "The Wedding Day (Live)" reads "The day as it happened" after the day.
- **F-W2-45 · "3 guests" beside 4.** The cover's number is the yes-replies — it now says "said yes", the magazine
  cover's own words.
- **F-W2-50 · the story's bars over the top bar** — they stand under it (`globals.css`, the `.hub-prog` offset).
- **F-W2-51 · the cover's date line wrapped with the rule through it** — the words are a held span.
- **F-W2-54 · Camera looked lit on the Recap** — a page of no tabs lights its Home ("Recap") in the guest bar.
- **/recap before the day** sent a visitor to the invitation with nothing said. It now sends `?story=later` and the
  page draws one line — "The story of the day opens here after the day." — only while the story is not the page.

Not changed: the bare "thank you" in F-W2-52. The Thank You scene already follows the approved scene sheet
(`prototypes/post_event_scenes_styles_2026-09-29.html` § 13: Letter by default; Words only is "Thank you." and
nothing else; the credits roll ends "thank you"), so which screen the walk read needs the controller's eye.

Tests: `lib/the-post-event-walk-is-fixed.test.ts` (one block per item) plus the two above.

SPEC IMPACT: None — each fix follows an approved ruling (DECISION_LOG "POST EVENT = A STORY (ONE SCENE PER SCREEN) —
SIX CALLS SETTLED"; "NEVER AN EMPTY SCENE").
