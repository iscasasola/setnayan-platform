## 2026-11-19 · refactor(admin): Money's 13 screens ported to the clean template (admin clean port 1 of 6)

The owner said "ok" (19 Nov) to the drawing "Money screens: now and proposed" (artifact 6sKA8ofRh49LRdGFgJqLkk). This is a repositioning only: same features, same reads, same server actions and posted field names, same copy. Explanations moved word for word behind ⓘ tips.

- **Payouts** — each payout is ONE row (name · net, the date line, a state badge) that opens on a tap (`?open=<payout_id>`) to a record page. The record keeps the facts, the BIR / fees, and the Mark paid / Place on hold / Release hold forms. The four filters moved off the page into a Show & filter sheet, the round right of the thumb-row search (`payouts-show-sort.tsx`, the same sheet as People's). The thumb-row field stays the console's ONE search.
- **Prices** — the six pills are gone. Each tab is a view of the pinned "Money · Prices ▾" dropdown, and `Plan contents` was added there so the sixth tab stays reachable. The main Prices tab's sign-up discount, booking fee, catalogue editor and older catalogue are now template sections, rows and dropdowns (the kind chips became one Kind dropdown; Charged and Replaced by are house dropdowns). The legacy-report download sits beside "Older catalogue".
- **Gifts, launch offer, founder seats, discount codes (new · edit), payments desk + inbox matcher, money records, receipts, subscriptions, payment options** — no cards, no visible title or lede. Template sections, rows, badges, numbers frames and house form rows replace them. Raw selects became the house dropdown.
- Baselines lowered by a fresh regeneration (template-score, no-card, field-template). `admin/booking-fees` drops from a stale 36 to 2. Every Money page now scores 0.

SPEC IMPACT: DECISION_LOG.md row "2026-11-19 | 🧹 ADMIN CLEAN PORT — THE MONEY DRAWING IS APPROVED…" (already pushed to the specs repo, commit 3745f051). No other spec change.

**Review fix (controller):** while the AI prices screen cannot read every price, its warning stays a visible line ("don't save from here until it loads cleanly"), not an ⓘ, and every Save and Move on that editor is switched off. This is pinned by `app/admin/pricing/ai-prices-cannot-save-while-unreadable.test.ts`, which is sabotage-checked three ways.

## 2026-11-22 · chore(admin): Money port caught up with main for hand-off

- Merged origin/main. Four screens conflicted. Each keeps the clean template and takes main's newer copy and money
  facts: the booking fee's lock, every-Nth free fee and new-client months; Launch offer's "Special tools · Pro and
  up" date; and the gift bundle line. No price was moved or retyped.
- Generated baselines were merged key by key, not regenerated. Where both sides changed a key, the lower count wins.
- `admin/gifts/page.tsx`: each search hit's "Comp this …" button now writes `href` before `icon`. The shared comment
  stripper (`lib/strip-comments.ts`) reads `strokeWidth={1.9} />} … href={\`…\`}` as a regex literal. Every guard that
  strips comments then misread the rest of the file, and the gift-limit guard flagged a "40%" inside a comment. The
  stripper itself is unchanged; fixing it is a separate task.

SPEC IMPACT: None.
