## 2026-08-26 · refactor(admin): six menus that match the six jobs

Owner, after seeing the evidence: *"just keep going since this is just a rearrange
process."* Renames and re-cuts the six admin menus so every job he actually does lands
in **exactly one** of them.

| was | now | what changed |
|---|---|---|
| Overview (28) | **Today** (20) | keeps only the act-now queues |
| Accounts (6) | **People & shops** (8) | gains Verify · ID documents · Partnerships |
| Studio (14) | **Studio** (12) | Discount codes + Referrals leave for Money |
| Ugat Console (6) | **Set up** (16) | gains settings, secrets, integrations, test data |
| App Performance (9) | **Numbers** (9) | rename only |
| Money & Settings (15) | **Money** (13) | gains the five money queues; the settings tail leaves |

**Measured before:** three of the owner's six jobs were split — Shops across THREE
menus, Test data across two, and prices split from discounts. **After: none are.**

🔒 **ALL SIX GROUP KEYS ARE UNCHANGED** (`queues` · `directory` · `media` · `ugat` ·
`funnels` · `settings-group`). Keys are load-bearing for localStorage continuity, the
≤5-tab phone strip, four landing pages and `admin-rail-context` — only labels and
membership move. `/admin/money` still reads `settings-group` and now correctly gets the
money.

⚠ **This supersedes the owner's own 2026-07-04 respine** ("Overview · Accounts · Studio ·
Ugat Console · App Performance · Money"), which was itself the fifth cut of this menu. It
stays at **six**, per the standing six-menu lock — Sell folds into Money rather than
becoming a seventh.

🚨 **A MISTAKE THE SHIPPED GUARDS CAUGHT, AND THE REASON THEY EARN THEIR KEEP.** The
rewrite harvested item blocks by shape and rebuilt each group's array — which silently
**destroyed a flag-gated entry** (`live-studio-channels`, wrapped in
`...(envFlagEnabled(NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED) ? [...] : [])`). Two guards
failed within seconds: *"the admin surface does not exist, and nothing links to it"* and
the env-flag parser check. The entry is restored **verbatim** from `HEAD`.
🔑 **A round-trip check that counts is not a round-trip check.** The parser was verified
by item COUNT (78 in, 78 out) and the count was right because the conditional entry was
never counted in the first place. Diff the KEYS against `HEAD`, which is now done and
reports 79 → 79, none lost, none gained, none duplicated.

Two rail expectations MOVE with their items (Verify → People & shops, Settings → Set up),
updated with the reason in the test rather than relaxed. Phone-strip labels follow the
menus they open, or the two surfaces disagree about what a place is called.

SPEC IMPACT: `DECISION_LOG.md` row 2026-08-26 — supersedes the 2026-07-04 admin respine.
