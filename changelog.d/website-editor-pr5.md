# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-25 · refactor(website): retire the absorbed sub-pages into the editor (PR-5)

PR-5 of 5 — the close-out for the Unified Website Editor.

- **`/website/special-message`, `/website/what-to-bring`, `/website/colors` → redirects** to `editor?open=<row>`. These three settings are now edited **inline** in the editor's rail, so their standalone pages are pure duplication; the redirect lands the couple on the editor with the right row already open. Their **server actions are unchanged and remain the single write path** — the editor's panels call them directly. `colors/color-field.tsx` deleted (no importers left).

⚠ **Scope correction (the plan was unsafe as written).** The build plan called for thinning *all twelve* `/website/*` sub-pages to `editor#anchor` redirects. That would have **broken editing for nine of them**: the editor's rail still deep-links to the sub-pages for every setting that does NOT yet have an inline panel (hero photo, gallery, music, widgets, dress code, photo moments, our story, editorial, privacy), so redirecting them would create an editor → sub-page → editor **loop**. Only settings fully absorbed as inline panels can be retired, so this PR retires exactly those three. The remaining nine keep their own focused editors, reachable from the rail; absorbing them as panels — and only then retiring their routes — is the honest follow-on.

**Program state:** the editor is the single doorway (sidebar "Launch"), the legacy `/site-editor` and `/website/launch` are gone, and the guest site is untouched. Free settings + the Website Pro set are presented in one rail beside a live preview of the couple's real page, with two-way sync. No migration.

SPEC IMPACT: Applied — closes the `DECISION_LOG.md` 2026-07-25 Unified Website Editor rows, with the sub-page-retirement scope corrected as above.
