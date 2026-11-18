## 2026-11-18 · fix(settings): the Settings help answer promises "More settings" doors only to suppliers

Opus review of #7760. The new help answer `how-settings-open-and-save` is shown to couples too, and said "A short settings screen ends with links to your other settings" — only the supplier's Today and Hub ⚙ end with those doors. It now says "A short supplier settings screen …". Guard: `lib/settings-v2-one-shell.test.ts` (6). Also corrected three stale comments that still said the picked client keeps the sheet / a ⚙ rises through `MenuSettingsButton rise` (`inLayer` has no caller since main bf8998a1).

SPEC IMPACT: None
