## 2026-09-10 · fix(story): the Story Maker is six steps with a rail — it was the old page with steps bolted on

**The owner, who approved the prototype, opened the page and said: *"the designed story maker is not
what showed. this looks like the old editorial setup page."* He was right.**

Every one of the six steps was **built and correct** — the desk, the theme modes, the cover, what's
next, the publish ladder, all with the ruled copy verbatim. They had been **appended to the bottom
of the old single-scroll editorial editor**. Measured in the live browser at 1907px: **no rail
anywhere**, and twelve headings for six steps —

> The desk · What goes in · The words · Your photos · Section order · Your own columns · What they
> said · What shows · Theme · The cover · What's next · Publish

— so **"The story" existed only as seven loose sections** between the desk and the theme.

🔑 **A CHECKLIST OF CAPABILITIES IS NOT A PORT.** A 30-agent verification pass had just asked
whether each piece existed, got yes six times, and reported the desk as working. Nobody asked
whether the PAGE was the one that had been approved. The design says it in capitals — *port the
prototype, never redraw it; a delta between the screen and the prototype is a defect in the port.*

### Three things the recon settled that would each have caused a rebuild

**1 · It is a TAB SWITCHER, not a scroll-spy.** Read out of the prototype rather than assumed:
`.panel{display:none}.panel.on{display:block}`, `show()` puts `.on` on exactly one panel, and its
last line is `window.scrollTo({top:0})`. No IntersectionObserver, no `scrollIntoView`, no hash
routing anywhere in the file. A rail that lit up sections as you scrolled would never reset scroll.

**2 · 🔴 SWITCHING PANELS THE OBVIOUS WAY WOULD DESTROY THE HOST'S WORK.** The story, theme and
publish steps share ONE unsaved form — twelve pieces of state, no autosave, saved only when a
publish rung is pressed. `{step === 'story' && …}` unmounts the subtree, so **everything typed
vanishes the moment the host taps "Theme"** — silently, with `dirty` still true, and no existing
test would notice. Panels are switched with `hidden`. `service-wizard.tsx` in this same app already
states the rule: *"All step sections live in the DOM (so every field submits); only the active one
is shown."*

**3 · The steps must NOT be extracted into files.** Four guards read `editorial-editor.tsx` by
hardcoded path and **42 of 50 patterns match only inside it**; extracting any step fails all four,
each reported as *"a capability was deleted"* about code nobody deleted. The loss-prevention
guard's own docblock names its purpose as catching *"a future edit tidying away 'the old
editor'"* — extraction is precisely the shape it distrusts. **So the restructure happens INSIDE the
file**; only the rail is new, and it is chrome, not capability.

### What changed

- `_components/story-rail.tsx` — **new**. The rail (≥1000px, sticky) and the phone's chip strip, one
  component and ONE selection, because two copies of "which step is open" is how two surfaces come
  to disagree. It owns no state and recounts nothing.
- `_components/editorial-editor.tsx` — a thirteenth piece of state (`step`), six `hidden` panels,
  the two-column grid. **No section moved files; no capability moved.**
- `page.tsx` — the desk becomes **step one**, handed in as a slot beside `cover`/`whatsNext` (a
  panel outside the switcher is a section that can never be switched away from), and the shell
  widens to `max-w-[1010px]` = 214 rail + 28 gap + **768 content, so the reading measure is
  byte-identical to what shipped**.

### Measurement

`TSC_EXIT=0` **and** `ERROR_LINES=0` — and it caught a real one: the prototype's rail chip *reads*
"Auto", so the mode was typed as `'auto'`, but the shipped union is
`StoryThemeMode = 'board' | 'own' | 'neutral'`. That comparison **can never be true**, so the Theme
chip would have read "Neutral" forever. The chip keeps the prototype's WORD; the code keeps the
app's NAME.

**All four loss-prevention guards still pass, with non-zero counts** — 3 · 5 · 3 · 9. Every
`scripts/lint-*.mjs` passes. New guard `lib/the-story-maker-is-six-steps.test.ts`, 6 tests,
**mutation-proved, all three RED**:

| sabotage | result |
|---|---|
| the `hidden` switch replaced by a data attribute | 6 pass → 5 pass, 1 fail |
| the cover panel unwrapped back into a loose section | 6 pass → 5 pass, 1 fail |
| `'auto'` restored (the always-false comparison) | 6 pass → 5 pass, 1 fail |

### ⏭ Not verified, and stated rather than buried

**Nobody has seen this render.** A local build is impossible in this project and preview builds are
cancelled, so the first sight of it is production. The port is verified by the prototype's markup,
the four loss guards and the typecheck — **not by a rendered page.** The rail's spacing and the
phone strip in particular want a human eye.

`SPEC IMPACT`: None — no schema, no pricing, no copy change.
