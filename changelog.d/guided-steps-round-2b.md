## 2026-10-05 · fix(maker,guest): guided steps round 2b — the controller's live walk after #6354

- **"Made with Setnayan" is legible on any ground.** `text-xs` (the 12px guest floor), on the card's own paper (`bg-surface/90`, `text-ink/75`), so it reads on a dark theme or a photo. `door-shell.tsx` joins `lint-guest-legibility`'s scan; its baseline was regenerated with the generator (2 existing decorative lines).
- **An instant-save control never makes a step "changed".** The Wedding March order and Reply by write live ("Guests see this right away"), so a press on them is already saved. `writesLive` / `noteStepTouch` (lib/guided-step-touch.ts) skip a touch inside a block that carries the live mark. Skip then asks nothing. A drafted field still asks.
- **Parents & hosts shows the people the invitation names.** On maria-and-jose (read-only SQL: 0 parents, 1 accepted co-host account, a `wedding_planner_external`), the step listed "Ana & Marco · wedding planner external · <email>". Where the type prints parents:
  - a collaborator account is never a row;
  - it never counts the step "set" (`readYourEventFacts` zeroes `hostCount`);
  - with none, the step opens on the add, whose own line says "No parents on your guest list yet."

  A type with no parents keeps its Kindly-reply host.
- **"Same as theme" for the Save the Date film.**
  - **Studio picker.** "Same as theme" is the first choice, and the default for every new event (nothing stored). The studio saves it as `std_background = null` (`backgroundFollowsTheme`), and its preview paints the theme's canvas as guests see it, never the Mood Board veil.
  - **Theme step.** While the film keeps a background of its own, one line under Theme reads "Your Save the Date film keeps its own background · Same as theme". A tap writes `std_background: null` into the **draft** (a new draft column that holds only that value; Apply names it "Save the Date · Film background"; free, since it is a removal).
- **"See you soon." reads on every theme.** It was `text-gild`, which measured `rgb(190,153,88)` on maria-and-jose's Mood-Board page at about 2.4:1. It is now `text-terracotta-700`, every theme's deepest accent: on that page's tokens `rgb(99,80,45)` at about 7.4:1, and white on Cyber Neon's own canvas.
- Guards:
  - `lib/the-guided-steps-share-one-layout.test.ts`: (11) rewritten, (22) extended, (23)–(24) new.
  - `app/[slug]/the-guest-doors-wear-the-event.test.ts`: (1) extended.
  - Each was sabotaged red → green.

SPEC IMPACT: None. This applies the 2026-10-05 DECISION_LOG row ("consistency-first owner calls") and the controller's relayed walk notes.
