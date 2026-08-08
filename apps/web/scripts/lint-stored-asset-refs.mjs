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
  // ✅ CLEARED 2026-08-08 — ALL SIXTEEN ARE PAID.
  //
  // The list opened at 16. `app/v/[slug]/page.tsx` sat here labelled "the
  // highest-value one still owed" until the owner approved his own shop, opened
  // the public address, and the first thing on the page was a broken-image glyph
  // where his logo goes. The note named the risk exactly and nobody was reading
  // the note. The remaining 15 were swept the same day.
  //
  // 🔑 A BASELINE IS A BILL, NOT A DECISION. Every line that lives here is a
  // surface showing no logo to a real person right now. If you add one, you are
  // deciding somebody sees a broken picture until further notice — so add the
  // date and who it hurts, and expect to be asked why it is still here.
]);

/**
 * Files the SHAPE-based scan matches but where nothing is actually broken.
 *
 * ⚠ THIS IS NOT A SECOND BASELINE AND MUST NEVER BE USED AS ONE. A file belongs
 * here only when the raw `r2://` value is genuinely NOT being rendered — it is a
 * FORM VALUE, and the display URL travels separately, already resolved. If the
 * picture is missing, it is debt, not a false positive.
 *
 * Counting these as debt is its own kind of dishonesty: it inflates the number a
 * person is trying to drive to zero, and a count that cries wolf teaches you to
 * skim past the one entry that is real.
 */
const FALSE_POSITIVES = new Map([
  [
    'app/open-shop/page.tsx',
    'The `logoUrl: row?.logo_url` here is the WIZARD FORM DEFAULT — the stored ' +
      'reference the vendor saves back, seeded into useState and used for the ' +
      'required-field check. The picture comes from `logoDisplayMap`, built ' +
      'right above it with displayUrlForStoredAsset and passed to FileUpload as ' +
      '`initialDisplayUrls`. Verified 2026-08-08 by reading both sides. Nothing ' +
      'is broken on this screen.',
  ],
]);

const failures = [];
const stillOwed = new Set();
const excused = new Set();

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
    if (FALSE_POSITIVES.has(rel)) {
      excused.add(rel);
      continue;
    }
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

// Same honesty rule, other direction: an excuse whose match is gone is an
// excuse nobody re-read. Left in place it would silently cover a REAL match
// that lands in that file later — which is exactly how an exemption becomes a
// blind spot.
const staleExcuses = [...FALSE_POSITIVES.keys()].filter((f) => !excused.has(f));
if (staleExcuses.length > 0) {
  console.error('\n✖ lint-stored-asset-refs — these FALSE_POSITIVES no longer match anything:\n');
  for (const f of staleExcuses) console.error(`  · ${f}`);
  console.error(
    '\n  Remove them. An exemption that covers nothing today will quietly cover\n' +
      '  the next REAL raw reference written into that file.\n',
  );
  process.exit(1);
}

console.log(
  `lint-stored-asset-refs: OK — no new raw stored-asset refs. ` +
    (stillOwed.size === 0
      ? `DEBT IS ZERO — every surface resolves its logo.`
      : `${stillOwed.size} known surfaces still show no vendor logo (see BASELINE).`) +
    (excused.size > 0 ? ` ${excused.size} verified false positive(s) excused.` : ''),
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
