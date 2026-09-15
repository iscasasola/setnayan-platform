## 2026-09-15 · fix(story): the maker keeps its step, and the sound control is a button

ST-4, two halves. The second was worse than the row described.

### A reload threw the host back to "The desk"

`editorial-editor.tsx` held the open step as plain `useState<StoryStepKey>('desk')`,
so every reload discarded it. Writing your own columns, refreshing, and landing
on the desk is the kind of small wrong that makes a tool feel untrustworthy —
nothing is lost, but the page has forgotten you.

Hash-driven now, reusing the idiom this codebase already has in
`panood/control/[eventId]/_components/setup-sheet.tsx`: read on mount, validate
against `STORY_STEPS`, listen for `hashchange` so Back and Forward work, and
write with `replaceState` — assigning `location.hash` would push a history entry
per rail click, so six clicks would need six Back presses to leave the page. A
plain `<a href="#theme">` deep-links for free as a result. An unknown or hostile
hash opens the desk rather than a rail with nothing selected.

### The ENTIRE living-moment tile was the mute button

The row says "the snippet mute button is smaller but still finger-sized".
Measured, the defect was larger than that: `living-moments.tsx` returned a
`<button className="group relative block w-full">` wrapping the clip, with the
speaker circle a decorative `aria-hidden` span inside it.

So the sound toggle's hit area was the WHOLE moment. A guest tapping a photo of
themselves to look at it turned the audio on, and tapping again to look closer
turned it off. The visible control was 32 px and controlled nothing; the real
control was a few hundred pixels wide and invisible.

The tile is now a `<figure>` and the speaker circle IS the button.

🔑 GROW THE TARGET, NOT THE DECORATION. The button box is `h-11 w-11` — 44 px,
the touch floor — while the drawn circle stays `h-8 w-8`, so it looks exactly as
it did. Round 3 removed the halos on this page because they stole presses; this
adds none. A nested button is also invalid HTML, which is the other reason the
tile could not stay interactive.

⚠ THIS CHANGES AN INTERACTION ON A PUBLIC PAGE, deliberately and flagged rather
than buried: tap-anywhere-to-unmute is gone, because it was indistinguishable
from tap-to-look. If the owner wants it back it is one line, and it should be his
call rather than a silent restoration.

SPEC IMPACT: None — no new step, no new control, no migration.
