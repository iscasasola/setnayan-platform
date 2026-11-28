## 2026-11-27 · content(articles): only "Hosts pay 0% commission.", no free promises, the test story leaves

Content finalization (owner rulings 27 Nov; list `docs/content-finalization-2026-11-27.md`, rows L · A · B, P6, P33).

- **Commission.** Every 0% / "zero commission" / "no cut" / "commission-free" / "no commission, ever" line in the article sources and their Facebook hooks is now the exact sentence "Hosts pay 0% commission." or is cut. `what-zero-commission-means-for-couples` is retitled "How Setnayan pricing works for hosts" and rewritten for hosts only: the "What suppliers do pay" section, the booking-fee explainer and the For Suppliers pointer are gone (P6, A1, A3, A4, A17, B1–B4, L2–L5).
- **Free promises and plans.** No "stays free", "never have to pay" or "never required"; paid plans are named Event Plus, Event Pro and Event Ultra, or "paid plans", never Event Pro alone (A2, A8, A18, L6, L7).
- **Counts and claims.** "30 honest ways" becomes "23 honest ways" (the lists hold 6 + 8 + 9). No "100+ venues" or "more than 30 roles", no speed claims, no "trusted", no "safe" in a hook, no "Thousands" (A5–A7, A11, B5–B7, B21, B23, L8, L9).
- **CTAs land where they say.** Ten CTAs that promised a specific article now link that article; the printable-countdown CTA is the checklist line (A9, A10, B8–B17, L10, L11).
- **Words.** "celebration" → wedding / event / reception outside brand lines; "monogram" → initials; "wedding blog" → "an article online"; missing apostrophes; leftover "rough 2026 market guide" and "ranges below" framing (A12–A16, B18, B19, L13, L14). Hook wording fixed for A19, B22, B24.
- **Migration `20271365567400`** (owner merges; `do-not-auto-merge`): makes the same 106 paragraph edits on the 66 Journal rows in `creator_chapters`, each guarded so only the exact old passage is replaced, and takes down `our-batanes-wedding-told-in-full` (a member-style post by a test account) with `removed_at = now()` (P33, L1, L15). `lib/journal-edits-after-import.ts` lists every edit, and `lib/journal-move.test.ts` now proves the import file, the edits and the source agree at the rendered-text level, so link changes are carried too. `tests/db/articles-say-only-hosts-pay-0-commission.db.test.ts` replays it.
- Not in this PR: hook length (B25, A20; owner), og tags (L12; SEO session), the repeated regional paragraph (B20; style note, no rule broken).

SPEC IMPACT: None. The corpus already holds the rulings applied here (DECISION_LOG 20 Nov "Hosts pay 0% commission.", 27 Nov content finalization); no product decision changed.
