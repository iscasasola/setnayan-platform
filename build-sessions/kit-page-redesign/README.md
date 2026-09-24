# Setnayan page redesign kit (2026-09-21 · updated 2026-09-24 to the house style)

> ⚠ **2026-09-24: every redesign now follows the design brief** — no cards or borders, `(i)` instead
> of sentences, the number is the interface, depth and motion, four viewport states. Read step 0 of
> `REDESIGN-PAGE-PROMPT.md` and `build-sessions/DESIGN-FOUNDATION.md` first. The Papic example below
> still shows the right METHOD; its bordered, two-layout LOOK predates the brief — do not copy it.

**For a Claude Code session: read this file first, then `REDESIGN-PAGE-PROMPT.md`.**

The owner's problem across the site: **too much text, too many descriptions, and the flow of use
is scattered.** This kit is the approved way to fix a page. It holds the method and one finished
example, the Papic controller. The owner reviewed the example and said the method was done correctly.

## What's inside

| File | What it is |
|---|---|
| `REDESIGN-PAGE-PROMPT.md` | **The method.** Eight steps, from confirming the page to reporting. Follow it for every redesign. |
| `papic-controller-prototype.html` | **The worked example and the template.** One file, works on phone and desktop. Open it in a browser and resize the window. |
| `canvas-version/` | The same redesign as a Design-canvas artifact (phone only, older order). Includes `Today.dc.html`, the live page as measured. Optional. |

## The concept in eight lines
1. **Confirm the exact page.** The Papic *controller* (`/dashboard/[eventId]/studio/papic`, set up +
   buy) is not the Papic section on the Event Hub.
2. **Measure the live page** (words, buttons, blocks, order) and list every control. Every
   control must survive.
3. **Find the approved drawing and past rulings** in the spec corpus (`prototypes/`,
   `DECISION_LOG.md`) and design toward them. For example, tabs on Papic were ruled out.
4. **Real parts and real data:** the real stepper, real prices, real options. Unknowns are `[PLACEHOLDERS]`.
5. **Order by use:** set up → what depends on it → buy → use. After the event date, results
   lead and setup folds to one line each.
6. **Cut the words:** one title, one status line, 1–3 word headings, no paragraphs; hints behind
   an `(i)`; the key number is the biggest thing on screen.
7. **One responsive prototype, four states:** phone app shell · tablet portrait master-detail ·
   tablet landscape workspace · wide desktop editorial with a sticky status column. No cards or
   borders; deep actions in a side panel; everything moves.
8. **Check the order, report briefly,** and change no code until the owner approves.

## The Papic example, in numbers
- Live page (2026-09-21): **1,149 words · 56 buttons · 17 blocks · about 8 phone screens**, with
  the "do this first" step at block 6, under the gallery it fills, and credits shown in 4 places.
- Redesign, **before the event:** Dates → Guests' shots → Credits → Filter → Challenges →
  Gallery → Kwento → Live wall → More.
- **On the day and after:** Gallery → Kwento → Live wall → Credits → Guests' shots / Filter /
  Challenges (one line each) → Dates → More.
- Real data used: the 17 price rungs read off production (₱70 for 100 up to ₱24,000 for 100,000;
  in code, `platform_retail_catalog_v2`); the 5 filter looks and their CSS from
  `apps/web/lib/papic-photo-styles.ts`; challenge prompts from the challenge-library seed
  migrations; the credit stepper's behaviour from `.../studio/papic/_components/credit-stepper.tsx`.
- Placeholders: guest messages, photos waiting for review, photo tiles, the screen code, and the
  payment instructions. Prod's "Continue to payment" was deliberately not pressed.

## Open owner decisions (do not re-ask what's settled)
1. One word everywhere: **"credits"** (the approved drawing) or **"shots"** (the live stepper).
2. Confirm the before/after order above.

## Where the source lives
Also saved in the spec corpus (`github.com/iscasasola/Setnayan-specs`):
`REDESIGN_PAGE_PROMPT_2026-09-21.md` and `prototypes/papic_controller_redesign_2026-09-21/`.
The approved design this builds on: `prototypes/papic_control_center_2026-08-25.html`.
