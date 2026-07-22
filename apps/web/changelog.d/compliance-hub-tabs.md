## 2026-07-22 · feat(admin): merge Data Privacy + NPC Filing into one tabbed hub

Collapses the two separate admin compliance surfaces — `/admin/data-privacy`
(the live control board) and `/admin/npc-readiness` (the pre-filing checklist) —
into ONE "Data Privacy & NPC Filing" hub at `/admin/data-privacy`, with four
tabs (`?tab=`): **Controls · Coverage & drift · NPC checklist · Documents**. One
nav entry, one landing tile, one entry point — no more two-cards-that-are-the-
same-thing.

- **`/admin/npc-readiness` now redirects** to `/admin/data-privacy?tab=checklist`
  (the standalone page is gone; its action stays in place — see below).
- **In-place checklist updates (no blank-jump).** The NPC task action
  (`npc-readiness/actions.ts` `setNpcFilingTask`) no longer `redirect()`s with a
  `?flash`/`?error` round-trip — it returns `{status, message}` and the new
  `_components/task-actions.tsx` renders it via `useActionState`, so flipping a
  task status updates just that card. Mirrors the control-board fix (#3516).
  All anti-false-assurance guards are preserved (counsel-gated resolve needs a
  written counsel ref; the FILE-the-DPS task t3-13 stays fenced behind the
  counsel-review task t0-1; the NOT-FILED banner still renders).
- New `_components/npc-checklist.tsx` (server) renders the banner + blocker strip
  + tiered task cards using `TaskActions`.
- `page.tsx` becomes the tab shell; the coverage panel + submission documents +
  control cards are unchanged, just tab-routed.

SPEC IMPACT: None (admin compliance-surface consolidation; no product, pricing,
or schema change).
