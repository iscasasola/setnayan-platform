# Design foundation — the shared pieces (owner-approved 2026-09-24)

> Owner: *"update the kit and build the shared pieces"*. Every screen built or redesigned from
> 2026-09-24 uses these instead of drawing its own. The rules they serve:
> `~/Documents/Claude/Projects/Setnayan/DESIGN_BRIEF_2026-09-24.md` (verbatim) and
> `build-sessions/DESIGN-LANGUAGE-AMENDMENT.md` (short form). Anchors below are symbols — grep them.

## Owner rulings this page carries (DECISION_LOG, 2026-09-24)

- **Radius stays on what you can press.** Buttons, inputs, chips keep their radius (and a hairline
  where needed). The ban on border + radius is for **containers** — cards, boxes, grid containers.
- **Glass drops its hairline and relies on shadow** → use `.sn-glass-bare`, not `.sn-glass`.
- **`lint:radius` and the `--m-r-*` scale are unchanged.** Use `rounded-*` classes, never `[Npx]`.
- **No dark mode now** (light lock 2026-06-04). New tokens ship `html.dark` pairs; there is no switch.
- **`(i)` only beside a visible label** (2026-08-21 PageMasthead ruling). `InfoTip` enforces it.

## The pieces

| Piece | Import | Use it for |
|---|---|---|
| `InfoTip` | `@/app/_components/info-tip` | Any helper sentence. It prints its own **required** `label` and puts the `(i)` beside it. Hover opens (mouse), tap pins (touch), Esc / outside press closes. `labelAs="h2"` makes the label a heading. |
| `Readout` | `@/app/_components/readout` | The number a screen is about (guests, ₱, credits, days). `value: number \| null` — **null renders "Couldn't load", never 0 / ₱0**. Pass `0` only when zero was measured. `format="php"` uses `formatPhp`. `size="sm"` for secondaries. Never inside a `<header>` (`lint:masthead`). |
| `Section` | `@/app/_components/section` | A group. Separates by space and type — no border, no fill. Title 1–3 words; anything longer goes in `info`. One `action` at the title's end. |
| `SidePanel` | `@/app/_components/side-panel` | Deep actions, at every width — **not a centred modal**. Slides in from the right, leaves a strip that is the way back. `size="wide"` for forms. Focus/Esc/scroll lock via `useModalA11y`. |
| `Sheet` (existing) | `@/app/_components/sheet` | A single decision in thumb reach — rises from the bottom on a phone, docks right from `lg`. |

Every interactive piece carries `sn-press` (press scale-down) and a transition on the house tokens;
the global `prefers-reduced-motion` block in `globals.css` stills them.

## Tokens (`app/globals.css` :root → exposed in `tailwind.config.ts` `theme.extend`)

| What | CSS | Tailwind |
|---|---|---|
| Layers | `--sn-z-raised` 10 · `sticky` 20 · `nav` 30 · `pop` 40 · `modal` 50 · `toast` 60 · `scrim` 74 · `panel` 75 | `z-sn-pop`, `z-sn-panel`, … |
| Shadows | `--sn-sh-sm/md/lg/tile/hi`, **`--sn-sh-float`** (borderless layers), **`--sn-sh-panel`**, `--m-shadow-sm/md/lg` | `shadow-sn-float`, `shadow-m-md`, … |
| Motion | `--sn-dur-micro` 120 · `control` 200 · **`elem` 320 (the brief's "300ms")** · `enter` 640; `--sn-ease`, `--sn-ease-out` | `duration-sn-elem ease-sn` |
| Glass | `.sn-glass-bare` (+ `--sn-glass-bg-raised`, `--sn-glass-blur`) | — |
| Canvas | `--sn-canvas` (= the `.sn-ambient` warm white). `.sn-canvas-drift` = opt-in slow gradient, off under reduced motion. **The ground stays flat by default** (owner 2026-07-28). | — |
| Type | `.sn-num` (hero number, tabular; `data-size="sm"`) · `.sn-h1` · `.sn-sec` · `.sn-eye` | — |
| Radius | `--m-r-*` (unchanged) | `rounded-md` / `rounded-full` for controls |

`.sn-glass` keeps its hairline on purpose: nine existing panels depend on it to be visible on the flat
ground. Move them to `.sn-glass-bare` one screen at a time, looked at.

## The guard — `lint:no-card`

`apps/web/scripts/lint-no-card.mjs`, a blocking CI step (`guard_no_card` in the aggregator of
`.github/workflows/ci.yml`). It counts, per file, lines holding a bare `border` **and** a container
radius (`rounded-lg|xl|2xl|3xl|card|tile`). Controls (`<button>`, `<input>`, `<select>`,
`<textarea>`, `<summary>`, `…Button`) are not counted. It is a **ratchet** against
`apps/web/scripts/no-card.baseline.txt`: a file's count may fall, never rise; a new file may hold
none. A chip that is not one of those tags takes `// no-card-ok: <why>` on its line.
When a redesign removes cards: `node apps/web/scripts/lint-no-card.mjs --update-baseline` in the
same PR. **Never regenerate to make a rise go green.**

## Not built yet (out of scope 2026-09-24)

Restyling existing screens · migrating the centred modals, local stat components and other `(i)`
copies · the three off-token CSS clusters (see the amendment) · a dark-mode switch · the collection
card (needs the owner's word) · per-screen archetype specs.
