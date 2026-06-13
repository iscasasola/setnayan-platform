// Build-time service-worker cache-version stamp.
//
// Rewrites the `const VERSION = '…';` line in public/sw.js to the deploy's
// VERCEL_GIT_COMMIT_SHA so the service worker's cache namespace (and therefore
// the sw.js bytes) differ on every deploy. The browser re-fetches `/sw.js`
// (served `no-cache`) on its SW-update check, byte-compares, and — because the
// bytes changed — installs the new worker; sw.js's `install` skipWaiting() +
// `activate` (delete-non-KNOWN_CACHES + clients.claim) then evict the prior
// deploy's caches. Result: returning PWA users never get stranded on the
// previous build's shell/JS after a deploy.
//
// Runs from apps/web (wired into `package.json` "build" before `next build`,
// so the stamped file is the one `next build` copies into the output).
//
// DEV/LOCAL: when VERCEL_GIT_COMMIT_SHA is absent (any non-Vercel build) this
// is a no-op — the committed `'v4'` fallback stays, so local builds never
// dirty public/sw.js. On Vercel the var is always set for git deploys.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SW_PATH = fileURLToPath(new URL('../public/sw.js', import.meta.url));

const sha = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').trim();
if (!sha) {
  console.log(
    '[stamp-sw] no VERCEL_GIT_COMMIT_SHA — leaving sw.js VERSION as the committed fallback (dev/local build).',
  );
  process.exit(0);
}

// Short, stable, cache-name-safe token. The full 40-char SHA also works, but a
// 12-char prefix keeps cache names tidy and stays collision-free in practice.
const stamp = sha.slice(0, 12);

// Anchored to line-start (multiline) so it targets ONLY the real code line
// `const VERSION = '…';` at column 0 — NOT the commented examples of that same
// shape in sw.js's header (those are prefixed by `// ` / whitespace).
const VERSION_RE = /^const VERSION = '[^']*';/m;
const src = readFileSync(SW_PATH, 'utf8');

if (!VERSION_RE.test(src)) {
  console.error(
    "[stamp-sw] FATAL: could not find `const VERSION = '…';` in public/sw.js — " +
      'the sw.js format changed. Update this script (or restore the line) ' +
      'rather than shipping an un-stamped service worker.',
  );
  process.exit(1);
}

const next = src.replace(VERSION_RE, `const VERSION = '${stamp}';`);
writeFileSync(SW_PATH, next);
console.log(`[stamp-sw] public/sw.js VERSION → '${stamp}' (commit ${sha}).`);
