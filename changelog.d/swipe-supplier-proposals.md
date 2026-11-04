## 2026-11-03 · feat(supplier-proposals): a proposal template deletes by swipe, with Undo

Swipe-to-delete sweep (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON
ROWS"), supplier proposals slice. Proposals → Templates: each template's visible trash form left the row; the list is
now `proposals/_components/template-list.tsx`, whose rows are the one `SwipeToDelete` (named "Delete <template>"). The
delete waits out the Undo window (`deleteWithUndo`) and is written by `deleteTemplate(templateId)` — the same
`vendor_proposal_templates` delete, now answered instead of redirected (one action, not two), and saying so when it is
refused instead of redirecting as if it worked. The quote maker's line ✕ (a reversible DROP,
"Put back") and draft-payment ✕, and the amendment builder's draft-item ×, are fields inside editor forms and stay
(`proposal-maker.tsx`, `amendment-builder.tsx` → the guard's `ALLOWED`). Dev: `/dev/swipe-rows-lab/proposals`.

SPEC IMPACT: None.
