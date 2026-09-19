## 2026-09-19 · fix(couple): three dashboard cards say "couldn't check" instead of vanishing on a refused read (S41b · couple 1)

COUPLE-FACING tier of `result-dropped-silently` (S26 baseline, #5625), batch 1 —
the couple's event dashboard. 23 sites, all option (a): join the missing end.

On screen (a refused read rendered exactly like "nothing here"):

- **Access requests doorway** — a refused pending-count hid the card, which reads
  as "no request is waiting". It now opens the list anyway and says it could not check.
- **Papic · Finding people in photos** — the couple's only OFF switch for face
  tagging vanished on a refused read. The card (and its control-centre row) now
  stays and says it could not check the setting.
- **Papic · Shared gallery** — the switch that may be holding the whole pool OPEN
  vanished on a refused read. It now stays and says it could not check.

Reason kept, behaviour unchanged (already honest, failing closed, or nothing shown):
checklist seeding ×3, story desk ×3 (fails closed), story freeze ×2, story cover
(refuses to overwrite), load-desk veto, challenges manager (already says
"couldn't load"), crew shot count (already null, never 0), mood-board template
insert, `listMoodboardSlots` (no caller), Save-the-Date template save, build-pick
apply, the launcher's four doorway counts (documented degrades).

Proof: `lib/couple-dashboard-reads-are-honest.test.ts` executes the doorway and the
face-tagging card against a client that refuses every read (5/5 green); each of
three sabotages (guard switched to `if (false)`, or the refusal folded back into
the absence branch) turns exactly one test red. The #5625 scanner reads 0 on
every file touched.

SPEC IMPACT: None
