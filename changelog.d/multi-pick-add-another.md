## 2026-07-27 · feat(vendors): multi-pick categories invite a 2nd lock — "add more" after the first (owner 2026-07-27)

- **Explore/Build "lock at least 1, add more if you want" (owner ruling, except the hard-single set).**
  Multi-lock was already the shipped model (`HARD_SINGLE_PICK_GROUPS` limits one-lock-at-a-time to
  ceremony venue · reception venue · officiant · coordinator · host/MC · LED background; everything
  else — catering, photo booth, booths, music, etc. — allows co-locks). This change makes the option
  visible and stops the app from fighting it:
  1. **Shortlist survives the first lock in multi-pick categories.** The finalize auto-archive sweep
     (owner 2026-05-22 "remove the other recommended vendors") is now gated to hard-single groups
     only — a couple who locks caterer #1 keeps their caterer shortlist to pick #2 from
     (`finalizeVendor` in `vendors/actions.ts`).
  2. **"Add another" doorway.** The end-of-rail add card on a finalized multi-pick group now reads
     "＋ Add another {category}" instead of the cold-start "Find {category}" (`plan-budget-accordion.tsx`).
  3. **Chip copy.** The Setnayan-AI deadline chip on a locked multi-pick group reads
     "✓ N locked · add more" instead of a terminal "✓ Locked".
- Hard-single groups keep today's behavior end-to-end (conflict modal → Switch flow → losers archived).
- Verified: `tsc` clean · `next lint` no new warnings · 4240/4240 unit tests pass.

SPEC IMPACT: DECISION_LOG.md row 2026-07-27 (owner: at-least-1 is the floor — couples may lock
multiple vendors per category except the hard-single set; e.g. 2 photo booths, 2 caterers).
