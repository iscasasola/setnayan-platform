## 2026-11-14 · style(public): template wave · public pages 1 — the sign-in, join, claim and pay doors follow the sheet

The owner's template wave (14 Nov, *"let's launch them all to cloud now"*): 17 public / signed-out pages onto the
approved design template sheet (`prototypes/design_template_sheet_2026-11-14_fable.html`, unchanged). Style only — same
words, same data, same actions; no shell changed; no new design. Score (paragraphs×2 + cards + hand buttons×2 + hex + mono
+ empty cards×2 + selects×2) **171 → 11** across the 17 pages.

- **Hand-made buttons → the shared pill.** Every `button-primary` / `button-secondary` link and every hand-painted filled
  button (`bg-ink` / `bg-mulberry` + rounded) is `actionButtonClass` (main = brand filled, the rest neutral), at 44.
  Where a guard counts `<Link>` (the pay page's two exits), the element stays a `<Link>` and wears the class.
- **Typewriter capital captions → the sheet's section label** (12 px, bold capitals, slate).
- **Cards → plain.** Bordered door cards and info boxes lose their border; the pay summary and the top of the claim /
  fit / invite doors sit on the warm surface (`--m-paper-2`) — the sheet's "one strong top of the page". Pick-one rows
  with a radio keep their frame (the sheet: a frame means "press me").
- **Long paragraphs → one line + ⓘ** (`InfoTip`), every word kept.
- **Money and codes leave the typewriter font** (`tabular-nums`); the signup name check's two colour codes → tokens.
- **The join request's native selects → the ▾ picker** (the guest card's `FormPick`: `PickMenu` + the posted field).

| Page | Before | After |
|---|---|---|
| `/pay/[reference]` | 27 | 3 |
| `/vendor/lock/[token]` | 17 | 3 |
| `/vendor/fit/[ref]` | 14 | 0 |
| `/vendor/claim/[token]` | 14 | 0 |
| `/vendor/claim/[token]/finalize` | 4 | 0 |
| `/vendor-invite/[slug]` | 11 | 2 |
| `/join/[eventId]` | 15 | 0 |
| `/host/accept/[token]` | 11 | 2 |
| `/v/[slug]/guest-review` | 11 | 0 |
| `/samahan/join/[token]` | 10 | 0 |
| `/claim/[token]` | 8 | 0 |
| `/join/[eventId]/success` | 6 | 0 |
| `/wall/[eventId]` | 6 | 0 |
| `/signup` | 5 | 0 |
| `/join/[eventId]/connect/confirm` | 4 | 0 |
| `/join/crew/[token]` | 4 | 1 |
| `/reset-password` | 4 | 0 |

SPEC IMPACT: None — applies the approved template.

**Fix (same PR, before ship):** `actionButtonClass` was called from SERVER pages while it lived in the `'use client'`
`components/action-button.tsx` — Next refuses that at render ("Attempted to call actionButtonClass() from the server"),
so those pages showed the error screen while typecheck and every unit test were green. Caught by rendering the pages.
The builder (with `ActionTone` / `ACTION_TONES`) moved to the plain `components/action-button-class.ts`; the client file
re-exports it, so every import still works. Server files now import it from the plain module, and a new guard
(`lib/a-server-file-calls-the-plain-class.test.ts`, sabotage-checked) fails if a server file imports it from the client
file again. All 17 pages re-rendered with no such error.
