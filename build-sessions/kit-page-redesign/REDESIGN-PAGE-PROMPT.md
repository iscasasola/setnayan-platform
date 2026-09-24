**Model: Fable 5.1 (`claude-fable-5-1`) · Effort: medium**
Paste everything below the line into a new session. Replace `{{PAGE}}` with the page name or route.

---

# Redesign `{{PAGE}}`: less text, one clear flow, interactive prototype

The problem on this page: too much text, too many descriptions, and the flow of use is scattered.
The goal: a clean page that feels like an app. The user sees what it is for at a glance and moves
through it top to bottom without reading. **Deliver an interactive prototype**, not a code change.

## 0 · The house style — read before step 1 (owner, 2026-09-24)

> Owner: *"apply the new prompt for the whole look of the website … the succeeding builds needs to
> follow the prompt as well."* Every redesign from 2026-09-24 follows the design brief. It is the
> house style, not an option.

Read, in this order: the verbatim brief `~/Documents/Claude/Projects/Setnayan/DESIGN_BRIEF_2026-09-24.md`
(spec corpus), then `build-sessions/DESIGN-LANGUAGE-AMENDMENT.md` (short form + what it collides
with), then `build-sessions/DESIGN-FOUNDATION.md` (the shared pieces you must use). The rules, short:

- **No cards, no bordered boxes, no bordered grid containers.** Group by whitespace, type scale and
  layered depth. Radius and a hairline survive only on things you can press (buttons, inputs, chips).
- **No explanatory sentences on the page.** Helper text lives behind an `(i)` beside a visible label
  — never a lone circle.
- **The number is the interface.** Big numeric readouts, sharp micro-labels, no sentences to decode.
- **Depth over division.** Layered shadow, glass (blur + translucent fill), one continuous canvas.
- **Everything moves.** Every control has a transition and a press scale-down; panels slide in.
- **Four viewport states**, not two (step 7).
- **Deep actions open in a side panel, never a centred modal.**

⚠ **The Papic example in this kit predates the brief** (2026-09-21). Copy its METHOD — the order,
the cut words, one DOM with CSS `order` — not its LOOK (it still uses bordered cards and two layouts).

## 1 · Confirm which page (do not guess)
Several pages share a product name (e.g. the Papic **controller**, where a couple sets up and
buys Papic, is not the Papic section on the **Event Hub**). Name the exact route you will
redesign and the job it serves in one line. If two pages could match, ask before going further.

## 2 · Measure the real page
- Work from `origin/main` (`git show origin/main:<path>`), never from `~`.
- Open the **live page in production**, signed in as a real user of that page. Record the word
  count, number of buttons, number of blocks, and the order of blocks top to bottom.
- List **every feature and control** on the page (e.g. credits, filter, gallery, guest limits,
  challenges, Kwento, wall, settings). This list is the contract: every item must exist in the
  redesign. Nothing is removed to remove its text.
- Mark where the flow scatters: steps out of order, the same thing (like credits) shown in
  several places, a required step buried below things that depend on it, the purchase hard to find.

## 3 · Find the approved design and past rulings
Search `~/Documents/Claude/Projects/Setnayan/prototypes/` and `DECISION_LOG.md` for the page's
name. If a drawing or ruling exists, redesign **toward** it and respect what the owner already
decided or ruled out (e.g. the Papic tabs were ruled out on 2026-08-27). Say what you found.

## 4 · Use real parts and real data
- Reuse the page's existing controls and how they work (e.g. the credit − / + stepper, not
  invented packs). Name the shipped component behind each block.
- Real values only: prices read from the live page or `platform_retail_catalog_v2`, labels and
  options from the code (e.g. filter looks from `lib/papic-photo-styles.ts`), real content from
  the database or seeds (e.g. challenge prompts). Never invent a price or a number that governs money.
- Anything you cannot source is a visible placeholder like `[CODE]` and is listed in your reply.

## 5 · Order it by how the user actually uses it
- Order blocks in the sequence the user does them: set up first, then what depends on it, then
  buy (sized by the choices above it), then use.
- If the page's job changes with time (before / on the day / after), the order changes too:
  setup leads before; the results (gallery, messages) lead after. Show both.
- One place per thing. Money appears once, beside what spends it, and buying is on the page,
  never hidden.
- A finished step folds into one line ("Cameras open · Jul 25 – Aug 1 ›").

## 6 · Cut the words
- One title, plus at most one status line (e.g. "50 credits · 4 cameras · 9 photos").
- Section headings of 1–3 words. No description paragraphs.
- Controls say what they do in 1–2 words. Any hint goes behind an `(i)` beside its label, never
  as visible text under the control.
- **The number is the interface:** where a page has a count or an amount (guests, ₱, credits,
  days), make it the biggest thing on the screen, with a micro-label, not a sentence.
- Keep text that carries a fact the user needs: money, dates, status, errors, consequences.
- Show instead of tell: a filter picked by seeing it applied, a switch instead of a sentence.

## 7 · Build the interactive prototype — ONE file, FOUR viewport states
Copy the METHOD in `papic-controller-prototype.html` (in this kit) — one DOM, CSS `order`, working
controls — but not its bordered-card look (see step 0). Do not start from scratch.
- **One HTML file, one DOM, four layouts.** No framework, opens in any browser. The site's real
  tokens: use the `--sn-*` / `--m-*` variables listed in `build-sessions/DESIGN-FOUNDATION.md`
  (glass, shadows, motion, z-layers, hero number), not colours eyeballed off a screenshot.
- **Phone portrait:** a native app shell — bottom nav, tight sticky header, one dense column in
  the order from step 5, big thumb targets. Sub-screens and the pay flow open **full screen** with
  a back arrow.
- **Tablet / foldable portrait:** master-detail, or the flow beside a collapsible left rail.
  Centred, never stretched.
- **Tablet / foldable landscape:** a multi-column workspace — the list or visual on the left, a
  context pane or inspector sliding in on the right.
- **Wide desktop:** inside the site's real shell (top bar + left rail), laid out editorially with
  generous whitespace and an asymmetric scale. What the user needs at every moment (status,
  credits, Buy) sits in a **column that stays in view** (`position: sticky`). Deep actions open as
  a **side panel** (the `SidePanel` piece — see `DESIGN-FOUNDATION.md` for where it lives) — never a centred modal.
- **No card, no bordered box, anywhere.** If two groups need separating, add space or change the
  type size. `(i)` tooltips open on hover (desktop) or tap (touch) and close on Esc / outside tap.
- **Every row, link and button moves** — a transition and a press scale-down (`sn-press`).
- **Order by CSS `order`, not by duplicated markup.** A body class for the moment
  (`before` / `after`) re-orders the same sections, and finished setup collapses to one-line rows.
- A small translucent **"Prototype" bar** at the top switches the viewport — **Mobile · Tablet P ·
  Tablet L · Desktop** — with a live CSS transition between them, and switches the moment. It is
  clearly not part of the app (brief §6).
- **Every row and button works**: steppers step, switches switch, the buy flow ends pending, each
  "›" opens its screen, Escape closes it.
- Test all four states in the browser before sending it (375px, ~820px portrait, ~1180px
  landscape, 1440px — a screenshot of each). Check that
  `hidden` really hides (`[hidden]{display:none!important}`, since `display:flex` overrides it).
- Optional: also publish it as a Design canvas (see `canvas-version/` for the file shape).

## 8 · Check the order, then report
Before replying, ask yourself: does any block depend on a choice made below it? Is anything the
user needs right now buried under something they already finished? Fix it.

Reply briefly with:
1. The prototype file (and link if published).
2. A table: section → what you can do there.
3. What's placeholder or unverified.
4. A line per brief rule from step 0: met, or not yet and why (e.g. a shared piece is missing).
5. At most 2–3 decisions for the owner, recommendation first. Don't ask what the code or
   `DECISION_LOG.md` already answers.

**Do not change any code** until the owner approves the prototype. Then build it by trimming and
reordering the existing components.
