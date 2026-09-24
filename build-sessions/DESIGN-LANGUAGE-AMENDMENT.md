## 🎨 THE DESIGN LANGUAGE — owner ruling 2026-09-24, supersedes the card rule

> **Owner, verbatim:** *"apply the new prompt for the whole look of the website. meaning, the
> events hub build and the succeeding builds needs to follow the prompt as well"*

**Every build from 2026-09-24 onward follows the new design brief.** It is the house style, not
a per-screen option.

🔑 **THIS IS AN AMENDMENT TO A COMMITTED SYSTEM, AND IT WINS.**
`design_handoff_setnayan_redesign/README.md` says *"separate cards by border `#E1DCD1` + shadow,
never a second surface."* **That rule is superseded.** The new brief bans cards, borders and
bordered containers outright; grouping is by whitespace, typographic scale and layered depth.
Where the handoff and the brief disagree, **the brief governs**.

### What the brief requires — the short form

- **Four viewport states, natively** — mobile (app shell, bottom nav), tablet portrait
  (master-detail or rail), tablet landscape / unfolded (multi-column workspace), wide desktop
  (editorial, off-canvas panels — never centred modals).
- **No cards, no borders, no bordered grid containers.** Whitespace and type carry the hierarchy.
- **No explanatory paragraphs on the page.** Secondary text lives behind an `(i)`, revealed on
  hover or tap.
- **The number is the interface** — massive numerical readouts, sharp micro-labels, no sentences.
- **Depth over division** — layered shadow, backdrop-blur, one continuous canvas rather than
  blocky colour sections.
- **Everything moves** — transitions on every interactive element, scale-down on press,
  slide-in panels.

### What this collides with — check before building

⚠ **`lint:radius`** pins corners to `--m-r-*` (8 / 14 / 22 / 999). New-language work will go red
there until the amendment moves the scale. **Do not weaken the guard — raise the question.**

⚠ **The collection-card standard** approved 2026-09-23 (Planning / Alaga / Samahan / Shortlist,
`build-sessions/STANDARD-collection-card.md`) is card-shaped by definition. **It needs the owner's
word on whether collections are a carve-out or get rebuilt borderless.** Do not assume either.

⚠ **Three off-token clusters will visibly refuse to change** and read as bugs when the rest moves:
`_components/home/home-reskin.css` (155 hard-coded hex), `onboarding/wedding/_styles/onboarding.css`
(103), `vendors/_components/shortlist-categories.tsx` (93). **Fix these before any global switch.**

### How to apply it at scale — skin propagates, composition does not

```
COLOUR   32,028 uses · 93% tokenised   → change the token, 93% follows
RADIUS    7,847 uses · 99% tokenised   → 27 arbitrary px survive
INLINE    2,840 style={{…}}            → a token can NEVER reach these
```

**Four of the brief's changes propagate; three never can** — which number is the hero, which
sentence hides behind an `(i)`, and what shape the screen is. Those are **147 judgments no
template can make** (349 real screens, 145 mapped, 147 with no template — and 147 is a FLOOR,
the classifier reads one import hop).

🔑 **Declare composition, do not author it.** Each screen exports a small spec the template
consumes — archetype, hero metric, secondary metrics, the copy that belongs behind an `(i)`. Made
once, in data. **If those judgments live in JSX we pay them again at the next redesign** — the
difference between a six-week reskin and a one-week one.

**Every NEW screen declares its archetype from now on.** See
`build-sessions/DESIGN-COVERAGE-REGISTER.md`.
