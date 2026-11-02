## 2026-09-20 · feat(dress-code): each role is told its own outfit and colour

Owner 2026-09-20: *"each role has their specific color code, and outfit style to wear 'long gown'
'suit' 'filipiniana', etc. if they have a role, only show their specific role and what their role
is."*

A guest with a role now reads one line on the invitation — **You are Ninang · Filipiniana ·
[their colour]** — instead of the whole palette and everybody else's instructions. A guest with no
role sees the general dress code exactly as before.

Where each fact comes from, none of it invented:
- **the role** — `guests.role`, labelled by the shipped `roleLabel()`;
- **the colour** — the couple's mood board, through `resolveAttirePaletteColor()`, the same
  resolver the 3D seat plan uses, so one role cannot be shown two colours by two surfaces;
- **the outfit** — `dress_code_config.roles`, which the couple sets in the dress-code editor.

🔑 **NOTHING IS GUESSED.** There is no default style. A ninong may be asked for a barong, a suit
or black tie, and this product telling a sponsor to buy the wrong thing is worse than telling them
nothing. An unset role shows its role and colour with "the couple hasn't said what to wear for this
role yet".

Editor: a per-role picker listing **only the roles on this event's guest list**, counted, with
"Not set" as the default and an optional note ("ivory, not white"). Vocabulary: long gown ·
cocktail dress · Filipiniana · Barong Tagalog · suit · formal · smart casual.

Two guards were right to fire and were answered, not silenced:
- the editor reads guest rows, so it now carries the same `isDelegateWithoutArea(…, 'guest_list')`
  gate every other guest-reading dashboard page has;
- the protected 0.66rem gild eyebrow count moves 19 → 20, deliberately and with the reason
  written at the assertion: the new "You are <role>" eyebrow is the same treatment doing the same
  job.

Guarded by `apps/web/lib/each-role-wears-its-own.test.ts` (8 tests). Two sabotages each turn one
red: showing the whole palette to a role-holder, and defaulting an unset role to a suit.

Not verified in prod: needs a couple to set a style, and a guest with a role to read it.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-20 row — per-role attire, and that no style is ever guessed.
