## 2026-08-15 · fix(storytellers): the storyteller's name is a door to their page — on all four public shelves, not none

A story card names the person who wrote it. **On every public shelf that name was printed text.** Pressing it did nothing; the whole card opened the story. The only way into a storyteller's own page was to open their story first and find a small back-link at the top of it.

**This is a defect in the PORT, not a new design decision — which is the only reason it shipped without a fresh sign-off.** The binding front-door document ([`FRONT_DOOR_AND_SEAM_FINAL_2026-08-12.md`](FRONT_DOOR_AND_SEAM_FINAL_2026-08-12.md):37) calls this line **"the channel line"**, and records that the reference the page was rebuilt from is YouTube's desktop view — where it has always been pressable. `front-door.css` opens by stating the rule: a delta from the drawing "is a defect in the PORT, not a fresh design decision."

### The four surfaces, fixed as four

| where | what it renders on |
|---|---|
| the 16:9 story card | `/` |
| the 9:16 story row | `/` — the SAME story, drawn a second time on the same page |
| `StorytellerTile` | `/realstories` · `/v/{slug}` · the bare-root shop address `/{slug}` |
| the Journal's chapter block | `/blog/{slug}` |

🔑 **The front door draws one story TWICE**, and a fix landing on one of the two renderings is a regression this page has already had — `front-door-invariants.test.ts` exists partly because of it. Both are asserted separately; a file-level count cannot say which card still carries the door.

The card's own destination is unchanged everywhere: the poster and the title still open the story.

### Two anchors on one card, and nothing in CI catches the wrong answer

An `<a>` inside an `<a>` is invalid HTML, and browsers recover by **splitting the outer link** — which silently breaks the card's own tap target. **`lint-nested-forms.mjs` tracks `<form>` depth and does not tokenize anchors at all**, and `next lint` was measured on this branch not to complain. So the structure is the only guard there is, and it is now asserted on **rendered HTML**, not on source text: a tag-stream walk that fails if any anchor opens before the previous one closes. A source regex cannot see nesting.

The cards therefore stop being one `<Link>` and become shells whose **title** carries the stretched press target (`::after { inset: 0 }`). Anchoring the real title rather than an empty `aria-label`ed overlay means the accessible name **is** the visible name, with nothing announced twice.

🔑 **THE STACKING ORDER IS THE WHOLE MECHANISM.** Drop the `z-index` on the byline and it is still coloured, still underlined on hover, still announced as a link by a screen reader — and completely unpressable, because the title's overlay sits on top of it. **It would look exactly like a working feature.** Asserted as arithmetic (`.fd-chan` z-index > `.fd-stretch::after` z-index), not as prose.

### A door must lead somewhere — two latent faults fixed with it

Both were already reachable through the chapter link that shipped months ago; neither can fire in production today, and both are named rather than left.

- **A handle that collides with a route word 404s.** `resolvePublicProfile` refuses a reserved segment on its first line, and `RESERVED_SLUGS` is **generated from the route folders on disk** — so the set grows every time a new top-level page ships, while a handle is validated only when it is claimed and never re-checked. `fetchPublicOwners` never asked. It does now, and dropping such a card is the honest answer: the chapter link `/u/{slug}/c/{id}` was already dead for the same reason, so this removes a card nobody could open rather than hiding a working one.
- **A refused read was reported as "this person has published nothing."** `fetchPublishedChapters` destructured only `data`. A rejected Supabase query resolves `{ data: null, error }` — it does not throw — so a broken read returned `[]`, and with one ongoing public event the profile page **redirects**. Someone who pressed a storyteller's name would have landed on a stranger's wedding page, with nothing on screen wrong. A read that failed now decides nothing. ⚠ The omission was inconsistent inside one module: `fetchPublishedChapterForShare` in the same file always checked its error.

### Contrast — one deliberate delta, and one pre-existing failure named not fixed

The drawing renders the channel line in the same grey as the metadata beside it. Measured on the cream page ground `#FDFBF7`, that grey `#8A857B` is **3.55:1** — below the 4.5:1 floor. Shipping a **new interactive control** at that ratio is not defensible in a repo that has treated 4.42:1 and 3.06:1 as real public-page defects, so the link alone steps to `#6E6A62` = **5.21:1**. The tile's `text-ink/55` → `/70` (~3.5:1 → ~5.3:1) for the same reason.

⏭ **The surrounding byline text is still 3.55:1 and always has been** — page-wide on the front door, pre-existing, and a palette decision rather than a port fix. Named here and deliberately not changed under this one. `lint-label-on-fill-contrast.mjs` cannot see it: it walks `.tsx` only and reads `.css` purely to harvest `:root` token values.

### Guards

`byline-is-a-door.test.ts` (12, source-level) + `byline-renders-as-a-door.test.ts` (4, render-level). **All 13 sabotages killed, each verified to have LANDED by printing the occurrence count before → after** — an unmeasured mutation proves nothing. One sabotage exists only to prove the second file earns its place: an anchor that still points at `/u/{slug}` and renders **empty** passes every source check and is caught only by rendering.

🪤 **Two of these guards were wrong on their first run, and both failed against correct code.** The no-nested-anchor check fired on the *article* card in the same row — legitimately a single link — and a guard that cries wolf teaches you to skim past the one time it is right; the slice was narrowed to the story branch. And `zIndexOf('.fd-chan')` matched the **docblock above the rule**, which mentions `.fd-chan` while explaining why it needs a z-index, then parsed to the next `}` and reported the property missing. CSS comments are now stripped. Same disease the file exists to catch: *a sentence is not a mechanism.*

🪤 **The render tests set `globalThis.React` before DYNAMIC imports, and that is load-bearing.** The repo's tsconfig sets `"jsx": "preserve"` for Next, so `tsx` compiles components for the test runner with the CLASSIC runtime — bare `React.createElement` with no import of its own. Without the global every component throws before an assertion runs, and a static import is hoisted above the assignment and fails again.

### What a person can see today: nothing

Production holds **1** chapter, and it is **not featured**, so it reaches no public shelf — the live front door reads *"34 ours · 0 theirs"*. **None of these cards renders anywhere a visitor can reach**, so there is no screenshot and this is not verified on the live site. It is verified by rendering the components and reading the emitted DOM. The one profile the door would point at (`/u/ana-at-marco`) was confirmed live to answer HTTP 200 with the chapter in its body.

SPEC IMPACT: `DECISION_LOG.md` row 2026-08-15 (the channel line is a door; the reserved-handle and failed-read gates that keep it honest).
