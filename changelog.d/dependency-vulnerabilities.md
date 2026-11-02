## 2026-08-06 · fix(deps): close 18 of 22 Dependabot alerts, incl. the libvips CVEs on the photo path

Dependabot had **22 open alerts (15 high)**. This clears **18**, and documents the
four that are deliberately left — each with the evidence that forcing them would
break something.

**Bumped**

- `sharp` **0.34.5 → 0.35.3** (`apps/web/package.json`, direct runtime dep) — closes
  GHSA-f88m-g3jw-g9cj (4 libvips CVEs: CVE-2026-33327/33328/35590/35591). The caret
  `^0.34.5` could never reach the fix, which only lands in 0.35.0. Every uploaded
  Papic photo goes through this, so the 0.35.0 breaking list was checked against the
  24 real call sites: `failOnError`, `paletteBitDepth`, deprecated `sharpen` props and
  `format.jp2k` (the four removals) have **zero** hits, and the repo's Node floor
  (`>=22`) already clears sharp's new `>=20.9`. Behaviour was measured, not assumed:
  across six real photos, output dimensions are identical, JPEG output is
  **byte-identical**, and AVIF shifts ±15% in size with an RMSE delta under 0.5/255
  (the 0.35 SSIMULACRA2 retune) — invisible.
- Pinned `next@15.5.21`'s own second copy of sharp (declared `^0.34.3`, so it stayed
  on the vulnerable 0.34.5) onto the same 0.35.3. It is reachable — `next/image`
  optimizes R2-hosted user uploads through it. Verified by calling Next's real
  `optimizeImage()` for webp/avif/jpeg/png before and after: same sizes, same formats.
- `brace-expansion` → **1.1.18 / 2.1.4 / 5.0.9** (patch bump inside each major) —
  closes 6 high alerts (GHSA-3jxr-9vmj-r5cp, GHSA-mh99-v99m-4gvg, GHSA-rgw5-rvv9-x895).
- `protobufjs` → **7.6.5** (GHSA-j3f2-48v5-ccww), `dompurify` → **3.4.13**
  (GHSA-c2j3-45gr-mqc4) — both existing overrides had gone stale behind newer advisories.
- `uuid@9.0.1` → **11.1.1** (GHSA-w5hq-g745-h8pq). The one cross-major override: there
  is no patched 9.x, the sole consumer is `@sentry/webpack-plugin` (build-time,
  `import { v4 } from 'uuid'`), and uuid 11's exports are a strict superset of uuid 9's
  — verified by diffing `Object.keys()`, not by reading release notes.
- `apps/mobile` (dev-only Capacitor asset tooling, own npm lockfile): `tar` → 7.5.22
  and `brace-expansion` → 1.1.18 / 2.1.4 / 5.0.9. The `tar` override was scoped under
  `@capacitor/assets` and had left a second vulnerable copy at the tree root; hoisted.

**Deliberately NOT bumped** (reasons recorded in the `comments` block next to each
override, so the next reader does not re-litigate them)

- `@opentelemetry/core@1.30.1` — the advisory's only fix is 2.8.0, and 2.8.0 **removes
  20 exports**, two of which `@sentry/node@8.55.2` imports by name (`VERSION`,
  `isWrapped`). Forcing it would break Sentry server-side instrumentation at import
  time. Verified by diffing both packages' exports. The real fix is a `@sentry/nextjs`
  major upgrade — its own PR.
- `sharp@0.32.6` and `uuid@7.0.3` inside `apps/mobile` — dev-only icon/splash tooling
  that `@capacitor/assets@3.0.5` was never built against, run by hand on the
  maintainer's machine over the repo's own files. Not reachable.
- `glib` (`src-tauri/Cargo.lock`, GHSA-wrw7-89jp-8q8g) — Rust/Cargo, desktop shell.
  Out of this PR's scope.

**New test — `apps/web/lib/sharp-photo-pipeline.test.ts`**

The photo pipeline had **no test at all**, so a sharp bump could have changed what a
couple sees or what a guest receives with the suite green. Six tests now pin the two
things the product actually promises: a derivative honours its long-edge cap and never
upscales, and an outbound copy carries **no EXIF** (that block is where GPS lives —
the RA 10173 guarantee). The EXIF test ships a **negative control**: the same chain
with `keepMetadata()` must retain the tags, otherwise "no EXIF found" could just mean
the fixture never had any. Two source-derived guards assert `papic-derivatives.ts`
still rotates before it resizes and never asks sharp to keep metadata. All four guards
were mutation-tested — each was watched go red against a deliberate break, then green.

SPEC IMPACT: None. No schema, no pricing, no user-visible copy. Image output is
unchanged in dimensions and in the metadata-stripping guarantee; AVIF byte sizes move
by up to ~15% either way with no visible difference.
