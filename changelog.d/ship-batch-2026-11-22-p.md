## 2026-11-22 · ship(batch-p): #8113 (tool pages D — Manpower gigs) · #8109 (tool pages C — My lines · Moodboard library) · #8084 (shop page About type · Back from View shop) · #8041 (search and AI text from one source)

Merged with merge commits off `origin/main` (after batch O). #8109 × #8113 met in three files: `a-failed-tool-read-is-never-clean.test.ts` keeps both new blocks (Manpower and My lines); `design-rules.baseline.json` and `ugat/screens.generated.json` are generated and were regenerated. Generated files regenerated once (ugat screens, port control, admin jobs, design rules). Server actions unchanged (no PR adds one). No migration.

SPEC IMPACT: None. The rulings are already in the corpus ("11 SUPPLIER TOOL PAGES REDRAW — APPROVED (v3)"; owner 21 Nov on the shop page).

Ship-controller fixes on the branch: a refused upload, save or delete in the Moodboard library is said inside the phone sheets (review of #8109); llms.txt's "Against the market" row says the booking fee in the one fee source's words (review of #8041).
