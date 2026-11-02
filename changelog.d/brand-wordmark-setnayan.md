## 2026-06-26 · fix(brand): wordmark reads "SETNAYAN", retiring the old "SET NA 'YAN"

The `<Wordmark>` / `<WordmarkLarge>` brand components still rendered the v2.1-era
text lockup **"SET NA 'YAN"** (with the orange-apostrophe accent). The owner
flagged it as the old logo still in use (login screen). The mark itself was
already the current gold mark — only the text wordmark was stale.

Changed the wordmark text to the full canonical spelling **"SETNAYAN"** (brand lock:
"SETNAYAN, spelled in full"), bumped the tracking to 0.04em so the one-word
condensed caps read cleanly, and updated the component docs.

Single-source change: corrects every `<Wordmark>` surface at once — the auth pages
(login / signup / forgot- / reset-password), the marketing nav + homepage sections,
the doorway sidebar header, explore, for-vendors, and the vendor public page. The
gold mark and the `Logo` lockup (already "SETNAYAN") are unchanged. The brand-origin
phrase "Set na 'yan." still lives in marketing copy — it's just no longer the logo.

Ships via the web, so the desktop/Android shells (which load the site) pick it up on
the next deploy — no app rebuild.

SPEC IMPACT: None in the code corpus. (Brand note: supersedes the v2.1 "SET NA 'YAN"
wordmark per owner 2026-06-26 — flagged for sign-off in the PR.)
