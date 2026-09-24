**Model: Fable 5.1 (`claude-fable-5-1`) · Effort: medium**
Paste everything below the line into a new session. Replace `{{PAGE}}` with the page name or route.

---

# Redesign `{{PAGE}}`: less text, one clear flow, interactive prototype

The problem on this page: too much text, too many descriptions, and the flow of use is scattered.
The goal: a clean page that feels like an app. The user sees what it is for at a glance and moves
through it top to bottom without reading. **Deliver an interactive prototype**, not a code change.

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
- Controls say what they do in 1–2 words. Hints ≤ 6 words, only where a control is unclear.
- Keep text that carries a fact the user needs: money, dates, status, errors, consequences.
- Show instead of tell: a filter picked by seeing it applied, a switch instead of a sentence.

## 7 · Build the interactive prototype — ONE file, phone AND desktop
Copy the pattern in `papic-controller-prototype.html` (in this kit). Do not start from scratch.
- **One HTML file, one DOM, two layouts.** No framework, opens in any browser. The site's real
  look: read colours, font and radius off the live page into CSS variables.
- **Phone (< 1024px):** one column in the order from step 5. Sub-screens and the pay flow open
  **full screen** with a back arrow.
- **Desktop (≥ 1024px):** inside the site's real shell (top bar + left rail). The flow sits in a
  wide left column, and what the user needs at every moment (status at a glance, credits, Buy)
  sits in a **right column that stays in view** (`position: sticky`). Grids get more columns (e.g.
  gallery 6 across). Sub-screens open as a **right-side drawer** over a dimmed page.
- **Order by CSS `order`, not by duplicated markup.** A body class for the moment
  (`before` / `after`) re-orders the same sections, and finished setup collapses to one-line rows.
- A small grey **"Prototype" bar** at the top switches the moment. It is clearly not part of the app.
- **Every row and button works**: steppers step, switches switch, the buy flow ends pending, each
  "›" opens its screen, Escape closes it.
- Test it at 375px and 1440px in the browser before sending it (screenshots of both). Check that
  `hidden` really hides (`[hidden]{display:none!important}`, since `display:flex` overrides it).
- Optional: also publish it as a Design canvas (see `canvas-version/` for the file shape).

## 8 · Check the order, then report
Before replying, ask yourself: does any block depend on a choice made below it? Is anything the
user needs right now buried under something they already finished? Fix it.

Reply briefly with:
1. The prototype file (and link if published).
2. A table: section → what you can do there.
3. What's placeholder or unverified.
4. At most 2–3 decisions for the owner, recommendation first. Don't ask what the code or
   `DECISION_LOG.md` already answers.

**Do not change any code** until the owner approves the prototype. Then build it by trimming and
reordering the existing components.
