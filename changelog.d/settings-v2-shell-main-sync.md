## 2026-11-22 · fix(settings): every ⚙ rises as main's Stack, not the retired grow

Merged `origin/main` (22 Nov) into Settings v2 step 1. Main now ships the full-screen map
(`FULL_SCREEN_MAP`, MOTION standard 2026-11-18: "Fill in / edit → Stack") and already opens its own
settings screens with `kind="stack"` (Papic settings, the avatar settings route, Filters). This PR makes
every ⚙ rise, so `MenuSettingsButton` now passes `kind={FULL_SCREEN_MAP.edit}` — main's newer motion
wins over the PR's 13 Nov grow. Generated files were kept as main's plus this PR's own lines, not
regenerated.

SPEC IMPACT: None — follows MOTION_STANDARD_2026-11-18 / HOUSE_DESIGN_STANDARD_2026-11-20 as written.

Also: the Shop ⚙'s body drew a 32 px gutter — `ShopSettings` already pads `px-4` and this PR's
`ShopSettingsRows` added a second `px-4`. The inner one is gone, so Shop, Today and Hub all sit on
16 px. Shots (375 light · 375 dark · desktop, from the supplier lab's fixtures):
`build-sessions/shots-settings-v2-shell/{today,hub,shop}-settings-*.png`.
