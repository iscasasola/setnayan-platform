# HANDOVER — Builder AS · admin supplier slice · STOPPED 2026-10-29 (controller: Mac out of memory)

PR **#7006** — draft · `do-not-auto-merge` · auto-merge off · branch `claude/admin-supplier-slice`.
2 migrations (NOT applied; the pipeline applies on merge): `20271292839996_notification_type_supplier_request_answered.sql`,
`20271293237246_admin_supplier_slice.sql`. Write-up: `changelog.d/admin-supplier-slice.md`. PR body = the summary.

## Built (all in Work, Categories › Hub tools, /admin/help)
Documents · Name/address requests (+ `decline_reason`) · Flagged cards (repost match · unverified shop; no price reason) ·
Event-type requests (against #7001's `event_type_requests`; absent table is said) · Hub tools as records
(`hub_tools` 8 templates, `category_hub_tool_switches` = SUGGESTED never a gate, `category_hub_settings` scan default) ·
Messages = Help inbox drawn with C1's `ChatBox` + `ChatThreadHead`. Row detail: in place on a phone, right-side panel
at ≥768. House dropdown (`FormPick`/`PickMenu`) everywhere, no raw hex/select, one frame per row.

## Walked (lab `/dev/admin-supplier-lab`, run 3, 29 Oct 03:17 — cut short by the controller's kill)
1,421 ✅ · 2 ⚠ of 1,423 (Chromium+WebKit × 375/390/768/1280 × light/dark; WebKit 768-light stopped at 63/89 when the
server was killed). Both ⚠ = dev-server timing, not the app. Shots + 8 side-by-sides in `shots-2026-10-28/admin/`.
Walk kit (gitignored, durable): `shots-2026-10-28/admin/_walk/` — `adm-run.sh` (walk lane, lab env, own 54321 stub,
dev → warm → walk → side-by-sides → stop by PID → release), `adm-walk.mjs`, `adm-sbs.py`, `results.json`.

## Checks
CI was green (26 ✅) on cf228398f9 before main moved. Since then: merged origin/main again (generated files taken from
main and REGENERATED: admin jobs/map, Ugat screens, port baseline, exposure baseline; FK map re-checked), all
`scripts/lint-*.mjs` ✅, root map current, action budget 1224/1225. Local typecheck on THIS head was NOT finished
(stopped on the controller's order) — CI's typecheck is the gate.

## Next (on a quiet Mac / next account)
1. `gh pr checks 7006` — if CONFLICTING again: merge origin/main, take generated files from main, regenerate
   (`pnpm -s admin:jobs admin:map ugat:screens port:baseline`; `exposure:baseline` under the heavy lock), push.
2. Fix any red job from its logs.
3. Re-run the WebKit 768-light combo only: `ENGINES=webkit WIDTHS=768 SCHEMES=light NO_SBS=1 shots-2026-10-28/admin/_walk/adm-run.sh`
   (walk lane; it copies nothing over the full results — save `results.json` first).
4. Hand back: head SHA · CI · walk ✅/⚠ · side-by-sides · check card.
