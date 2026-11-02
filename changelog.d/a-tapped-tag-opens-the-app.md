## 2026-09-20 · fix(applinks): a tapped NFC tag opens the app, not the browser

Owner, on his own iPhone with build 3 installed: his shop's NFC sticker
opened `/vendor-invite/<slug>` in **Safari**. A tag holds a plain https link,
and `apple-app-site-association` claimed only `/dashboard/*` and `/papic/*`,
so every tag-able surface fell through to the browser.

Both association files now claim the surfaces a tag (or a QR) can carry:
`/vendor-invite/*` (Shortlist), `/vendor/lock/*` (Locked), `/v/*` (the shop
page + the On-the-Day review QR), `/join/*` (guest join link), `/u/*` (guest
invitation + event landing under the nested owner path), plus the existing
`/dashboard/*` and `/papic/*`. Android's verified intent-filter gains the
matching `pathPrefix` entries (its comment said "SCOPED to /dashboard", which
is no longer what it does).

**Deliberately NOT claimed:** the bare `/<slug>` event landing at the root. It
cannot be expressed without claiming the whole domain — marketing, login,
everything — and a guest tapping that tag should get the browser anyway.

Guarded by `apps/web/lib/a-tapped-tag-opens-the-app.test.ts`: every tag-able
builder's prefix must be claimed on BOTH platforms, and the two lists must
match as sets. That set comparison exists because the first version of the
guard passed with `/v/` missing from Android — `/vendor-invite` starts with
`/v`, so a "does something similar exist?" check was satisfied by the wrong
entry. Mutation-checked three ways: a path dropped from iOS, a path dropped
from Android, and a path added to one side only.

⚠ iOS caches the association file, so the new paths reach a phone when the app
is reinstalled or updated — not from this web deploy alone. Android's part
needs a new app build, and `assetlinks.json` still holds the placeholder
fingerprint, so Android auto-verification stays inert until the owner puts the
release key's SHA-256 there.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-20 NFC row — the "tapped tag opens
Safari" correction is now fixed for every surface except the bare event slug.
No schema · no SKU · no price.
