## 2026-10-21 · fix(prints): ⚙ Print settings has one way to save — every press posts, no Save button

Owner, verbatim, on the sheet's ✓ Save: *"why is there a save here? when any press changes it right away?"* — and *"most of the
settings is already on the event hub. like parents and other details."*

- MEASURED in the lab before (`/dev/maker-lab?studio=1`, `window.__labPrintWords` counted per press): no switch, dropdown or typed
  line in the sheet posted until ✓ Save — a press followed by Done was lost — while the foot said "Guests see this right away".
- The Studio's print words form now posts itself on a person's change (`SoftPost autosave`, `lib/print-words-autosave.ts`): a press at
  once, typing after 800 ms or on leaving the box, one post at a time (a change during a post is sent once after it). The SAME form,
  the SAME route (`/api/hub-print/words`), the SAME fields. The shipped (non-Studio) Maker keeps its Save untouched.
- The sheet's foot (✓ Save · "Guests see this right away ⓘ") is gone; `StudioPrintSave` retired. Each kept press says "Saved." in the
  house toast (`PeekToast`), a refusal says so with Try again. "Show it as ▾" (seat plan) now tells the form on a pick. The special
  message box also announces its (drafted) save.
- Ticket style keeps "What each guest saves · waits for Apply" — it is drafted (owner 2026-10-02 Q7) — and its behaviour.
- ONE HOME PER FACT, measured: every input in the sheet is either a print-only choice (`events.print_details`: include switches, opening
  line, who guests reply to, ticket style, poster photo) or the SAME editor writing the Hub's own column (special message →
  `events.special_message`, thank-you → `events.pabuya_message`, parents → their guest rows). Production (read-only): no event stores a
  print copy of a hub-owned fact.
- Guard `lib/print-settings-has-one-way-to-save.test.ts` (no Save · every press posts through the one form · every hidden carrier told ·
  "waits for Apply" only on a drafted write · print_details keeps only print-only keys); sabotaged red then restored.

SPEC IMPACT: amends DECISION_LOG 2026-10-17 "PRINTS: ONE SETTINGS SHEET…" (its "one Save") — the sheet has no Save; every press posts.
Corpus row left for the controller (the local corpus checkout has diverged from origin; not edited from this worktree).
