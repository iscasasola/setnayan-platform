#!/usr/bin/env node
/**
 * Guard: a stored-asset column must be RESOLVED before it reaches an <img>.
 *
 * 🪤 THE TRAP. Columns named `*_url` do NOT always hold a URL. Several hold an
 * `r2://bucket/key` reference by design, and `displayUrlForStoredAsset()` turns
 * that into something a browser can fetch. Hand the raw value to an <img src>
 * and the browser silently fails — no exception, no console error worth
 * noticing, just a fallback glyph where the picture should be.
 *
 * WHAT IT COST (2026-08-07): the owner uploaded his shop logo, opened the app,
 * and saw a generic shop icon. He reported it as "logo did not show". The
 * account launcher was passing `logo_url` straight through — while the
 * event-hero block ~50 lines ABOVE it in the same file resolved correctly. A
 * partial application of the right pattern, invisible to every test, because
 * **a broken image is not a thrown error**.
 *
 * This scans for the narrow, high-confidence shape: a component prop or JSX
 * attribute assigned a bare `*.logo_url` / `*.*_r2_key` with no resolve in the
 * same file. It deliberately does NOT try to be clever — see the note at the
 * bottom about false positives.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const APP = join(WEB, 'app');

function sources(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) sources(p, out);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

/** Strip comments so the scan sees CODE, not the notes describing the trap. */
const strip = (t) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*/g, '');

/**
 * `src=` or `logoUrl=` fed a bare stored-asset field.
 * Matches: src={row.logo_url}  ·  logoUrl={vp.logo_url}  ·  src={r.still_r2_key}
 */
const IMG_PROPS = '(?:src|logoUrl|imageUrl|posterUrl|heroUrl)';
const ASSET_FIELD = '(?:logo_url|[a-z_]*_r2_key)';
const RAW_INTO_IMG = new RegExp(
  [
    // JSX attribute:      src={row.logo_url}
    `${IMG_PROPS}=\\{\\s*(?:await\\s+)?[A-Za-z_$][\\w$]*\\??\\.${ASSET_FIELD}\\b\\s*\\}`,
    // Object property:    logoUrl: vp.logo_url
    // 🚨 THIS FORM WAS MISSING and it is the one the reported bug used. The
    // launcher builds card objects (`spaces.push({ logoUrl: vp.logo_url })`)
    // rather than writing JSX inline, so a JSX-only pattern was blind to it —
    // reverting the real fix left the guard GREEN. Twice in one sitting this
    // guard passed while the bug was present; both times the pattern was
    // narrower than the code.
    `${IMG_PROPS}:\\s*[A-Za-z_$][\\w$]*\\??\\.${ASSET_FIELD}\\b`,
  ].join('|'),
  'g',
);

/**
 * KNOWN DEBT — 15 surfaces already doing this when the guard was written.
 * Baselined, NOT forgiven: each one means a vendor's uploaded logo never
 * appears on that screen. Failing the build on all 15 would have got this guard
 * switched off within a day, so it holds the line at "no NEW ones" and the debt
 * stays visible and countable here.
 *
 * ⚠ Severity is not uniform. Some (explore's vendor card) check the value and
 * fall back to a placeholder, so they degrade quietly. Others hand it straight
 * to an <img> and render a broken image. Both mean the logo is missing.
 *
 * DELETE A LINE WHEN YOU FIX ITS FILE. Never add one to make CI green.
 */
const BASELINE = new Set([
  'app/_components/home/HomeSpotlightStrip.tsx',
  'app/admin/accounts/_surfaces/vendors-surface.tsx',
  'app/admin/studio/_surfaces/journal-spotlights-surface.tsx',
  'app/admin/studio/_surfaces/spotlight-awards-surface.tsx',
  'app/admin/verify/page.tsx',
  'app/blog/[slug]/_components/journal-partner-credit.tsx',
  'app/dashboard/[eventId]/_components/new-manual-vendor-modal.tsx',
  'app/explore/_components/folder-vendors-section.tsx',
  'app/explore/_components/vendor-card.tsx',
  'app/explore/compare/page.tsx',
  'app/proposals/[publicId]/page.tsx',
  'app/vendor/lock/[token]/page.tsx',
  'app/vendor-invite/[slug]/page.tsx',
  'app/open-shop/page.tsx',
  'app/v/[slug]/booth/page.tsx',
  // The PUBLIC shop page itself — the highest-value one still owed.
  'app/v/[slug]/page.tsx',
]);

const failures = [];
const stillOwed = new Set();

for (const file of sources(APP)) {
  const code = strip(readFileSync(file, 'utf8'));
  // 🚨 NO WHOLE-FILE EXEMPTION. The first cut of this guard skipped any file
  // containing `displayUrlForStoredAsset` — and that made it BLIND TO THE EXACT
  // BUG IT WAS WRITTEN FOR. The launcher resolves event hero images ~50 lines
  // above the shop cards, so the file "resolves" and the raw logo sailed
  // through. Reverting the real fix left this guard GREEN.
  //
  // The tell is the SHAPE, not the file: a value that has been resolved is
  // never still `row.logo_url` — it is a new binding (`shopLogoUrls[i]`,
  // `resolvedLogo`). So a bare `*.logo_url` reaching an image prop is always
  // wrong, in every file, resolved-elsewhere or not.
  const rel = relative(WEB, file);
  for (const m of code.matchAll(RAW_INTO_IMG)) {
    if (BASELINE.has(rel)) {
      stillOwed.add(rel);
      continue;
    }
    const line = code.slice(0, m.index).split('\n').length;
    failures.push(`${rel}:${line} — ${m[0].trim()}`);
  }
}

if (failures.length > 0) {
  console.error('\n✖ lint-stored-asset-refs — a NEW raw stored-asset reference is being rendered:\n');
  for (const f of failures) console.error(`  · ${f}`);
  console.error(
    '\n  These columns can hold `r2://bucket/key`, which a browser cannot load. Resolve with\n' +
      '  displayUrlForStoredAsset() first. It fails SILENTLY — the picture just never appears,\n' +
      '  and no test catches a broken <img>.\n',
  );
  process.exit(1);
}

// A baselined file that got fixed should leave the list, or the debt count lies.
const fixed = [...BASELINE].filter((f) => !stillOwed.has(f));
if (fixed.length > 0) {
  console.error('\n✖ lint-stored-asset-refs — these are FIXED but still listed as debt:\n');
  for (const f of fixed) console.error(`  · ${f}`);
  console.error('\n  Remove them from BASELINE so the remaining count stays honest.\n');
  process.exit(1);
}

console.log(
  `lint-stored-asset-refs: OK — no new raw stored-asset refs. ` +
    `${stillOwed.size} known surfaces still show no vendor logo (see BASELINE).`,
);

/*
 * ⚠ ON SCOPE — read before widening this.
 * Matches only a bare `*.logo_url` / `*_r2_key` reaching an image prop, in JSX
 * or object-literal form. It does NOT trace variables: `const x = row.logo_url`
 * then `src={x}` slips through. That needs real dataflow analysis, and a regex
 * pretending to do it would misfire constantly — a guard that cries wolf teaches
 * you to skim past the one time it is right.
 *
 * But note what went wrong TWICE while writing this: the first cut exempted any
 * file that resolved anything (blind to the launcher), and the second matched
 * only JSX (also blind to the launcher). Narrow is right; narrower than the code
 * is useless. If you narrow it further, re-run the sabotage.
 */
