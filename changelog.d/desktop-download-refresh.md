## 2026-06-25 · fix(download): ship the login-first desktop build to the public /download page

The `/download` page served a static `.dmg` committed at
`apps/web/public/downloads/Setnayan_0.0.1_aarch64.dmg` (the `/api/download/mac`
route 302s there), and its metadata is hardcoded in `lib/desktop-release.ts`.
Both were still the **2026-05-14** build — which predates the `SetnayanApp`
login-first marker (#2191), so every public download still booted into the
marketing homepage instead of login.

- Replaced the committed binary with the fresh `build-desktop` artifact
  (run 28166727891, sha256 `2b3aa231…`, 1,423,887 bytes). Verified the shipped
  binary carries the `SetnayanApp` UA marker before committing.
- Bumped `DESKTOP_RELEASE` in `lib/desktop-release.ts`: `publishedAt`
  2026-05-14 → 2026-06-25, `sizeBytes` 1,446,653 → 1,423,887. The page reads
  this single source of truth for the hero date, the provision card, and the
  size suffix on both CTAs.

Note: `/download` is ISR (`revalidate=3600`), so the new date propagates within
the 1-hour window after deploy. The build is still ad-hoc-signed (not Apple-
notarized) — the page's first-launch right-click→Open guidance still applies.

SPEC IMPACT: None — ships the existing 0024/0052-adjacent desktop wrapper build;
no schema/SKU/pricing/flow change.
