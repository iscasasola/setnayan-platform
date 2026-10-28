# HANDOVER — Builder AS · admin supplier slice · PAUSED 2026-10-28

PR **#7006** (draft · `do-not-auto-merge` · autoMergeRequest null) · branch `claude/admin-supplier-slice`.
Contains 2 migrations (NOT applied): `20271292839996_notification_type_supplier_request_answered.sql`,
`20271293237246_admin_supplier_slice.sql`. Write-up: `changelog.d/admin-supplier-slice.md`. Corpus DECISION_LOG row
"ADMIN SUPPLIER SLICE — BUILT (PR #7006…)" pushed (incl. the two coordinator amendments).

## Built
- Work › From suppliers (`app/admin/work/_components/supplier-inbox.tsx`, data `lib/admin/supplier-work(.server).ts`):
  Documents · Name & address · Flagged cards · Event types (against #7001's `event_type_requests`; absent-table is said;
  coverage per group opens in the LINKED row via shipped `setFolderEventTypeOffered`) · Messages (in-row reply).
- Categories › Hub tools: tools are RECORDS (`hub_tools` key·name·one of 8 templates·is_active) + per-category
  `category_hub_tool_switches` (= SUGGESTED, never a gate — owner amendment) + `category_hub_settings` (scan default).
- /admin/help redrawn Messenger-style (`app/admin/help/_components/help-messenger.tsx`); nav "Help" → "Messages".
- Lab `/dev/admin-supplier-lab` (fixtures; `LabSubmitCatcher` says every press). Walk script ready at
  `/private/tmp/claude-501/as-walk/walk.mjs` (+ `serve.sh`, `sbs.py` for side-by-sides) — scratch, may be gone.

## Checks so far
- Local: slice tests 18+ pass; all 32 `scripts/lint-*.mjs` pass; check-ugat-screens current; migration timestamps OK;
  action budget 1225/1225 (net +0). 5 sabotages each went red then green.
- CI round 1 failures were fixed in `a75b478495` + `9257cd6b9c` (prepared-jobs, menu registry slot, masthead list,
  FK map, badge bill, Rule-3 lab exemption, number formatting, audit-insert annotation). CI round 2 was RUNNING at pause.
- Full local typecheck NOT run (heavy queue) — CI's typecheck is the gate.

## Next step (on resume)
1. `gh pr checks 7006` — fix any red job from its logs, push.
2. Walk: acquire `walk:as`, run `serve.sh` (port 3100, lab env, 54321 stub), then `node walk.mjs` (Chromium+WebKit ×
   390/1280 × light/dark, taps every control → `results.json`), then `python3 sbs.py` → `shots-2026-10-28/admin/`.
   STOP file + release + `rm -rf apps/web/.next` after.
3. Fill the PR body (walk ✅/⚠, sabotages, counts, shots, house-rule ✓/✗) and report.
