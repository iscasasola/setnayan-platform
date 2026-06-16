#!/usr/bin/env node
/**
 * lint-entitlement-gates.mjs
 *
 * Two static guardrails on the couple-SKU ownership layer, added after the
 * PR4 / PR4b "bundle buyer wrongly denied a paid SKU" bugs. Either violation
 * fails CI. Both are about the SAME failure mode: a couple buys a bundle
 * (GUIDED_PACK = Essentials / MEDIA_PACK = Complete), which lands as ONE orders
 * row keyed by the bundle code — never decomposed into per-child orders — so a
 * gate that ignores bundle ownership silently denies a SKU the couple paid for.
 *
 * ── GUARD 1 · bundle-aware gate discipline ──────────────────────────────────
 *   A couple-SKU ownership check must use the bundle-AWARE eventOwnsSku()
 *   reader, never the bare checkOrderOwnership() (which matches an EXACT
 *   service_key only → blind to GUIDED_PACK/MEDIA_PACK ownership).
 *   checkOrderOwnership() may be CALLED only from:
 *     • lib/entitlements.ts        — where eventOwnsSku() delegates to it;
 *     • *.test.ts / *.test.tsx     — tests exercise the bare reader directly;
 *     • a line explicitly annotated `entitlement-gate-lint: bare-ok <reason>`
 *       — for a SKU that is in NO bundle (e.g. INDOOR_BLUEPRINT), where the
 *       bare reader is correct and bundle-awareness would be misleading.
 *   This is exactly the check that would have caught PR4b's 3 bugs and blocks
 *   the whole class going forward: a NEW couple-SKU gate added with the bare
 *   reader fails CI unless its author justifies it.
 *
 * ── GUARD 2 · bundle-membership single source of truth ──────────────────────
 *   "Which child SKUs each bundle grants" is mirrored in THREE places that MUST
 *   agree exactly (each file's own header says "keep in sync" — this enforces
 *   it):
 *     • BUNDLE_MEMBERS         — app/onboarding/wedding/_components/onboarding-pricing.ts
 *                                (canonical: the "what's included" buy surface)
 *     • BUNDLE_CHILD_SKUS      — lib/entitlements.ts  (the read-side gate map)
 *     • bundles_granting_sku() — supabase/migrations/*_papic_ownership_bundle_aware.sql
 *                                (the DB provisioning RPC)
 *   Drift = silent breakage: a child in the buy list but missing from the gate
 *   map → bundle buyer denied; the inverse → over-grant. essentials↔GUIDED_PACK,
 *   complete↔MEDIA_PACK.
 *
 * Pure node, no deps — matches lint-retired-strings / lint-bottom-nav /
 * lint-email-links. Run: `node apps/web/scripts/lint-entitlement-gates.mjs`.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(WEB_ROOT, '..', '..');

const RED = '\x1b[31m';
const YEL = '\x1b[33m';
const RST = '\x1b[0m';

// ===========================================================================
// File walk — collect every .ts/.tsx under apps/web/{app,lib}. That is where
// every ownership gate lives (verified: all checkOrderOwnership callers are in
// app/ or lib/). Skips node_modules / .next defensively.
// ===========================================================================

function collectSources(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const abs = join(dir, entry);
    const s = statSync(abs);
    if (s.isDirectory()) collectSources(abs, out);
    else if (s.isFile() && (entry.endsWith('.ts') || entry.endsWith('.tsx'))) out.push(abs);
  }
  return out;
}

const SOURCE_FILES = [
  ...collectSources(join(WEB_ROOT, 'app')),
  ...collectSources(join(WEB_ROOT, 'lib')),
];

// ===========================================================================
// GUARD 1 — bare checkOrderOwnership() only where allowed.
// ===========================================================================

const ENTITLEMENTS_REL = join('lib', 'entitlements.ts');
const ALLOW_ANNOTATION = 'entitlement-gate-lint: bare-ok';
// matches a CALL: the identifier immediately followed by `(`.
const CALL_RE = /\bcheckOrderOwnership\s*\(/;

const guard1Violations = [];

for (const file of SOURCE_FILES) {
  const rel = relative(WEB_ROOT, file);
  // entitlements.ts is the one legit home (eventOwnsSku delegates here);
  // test files exercise the bare reader on purpose.
  if (rel === ENTITLEMENTS_REL) continue;
  if (/\.test\.tsx?$/.test(rel)) continue;

  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!CALL_RE.test(line)) continue;
    const trimmed = line.trimStart();
    // Skip comment lines and import statements — only real call sites count.
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
    if (/\bimport\b/.test(line) && /\bfrom\b/.test(line)) continue;
    // Explicit opt-out: the annotation may sit on the call line itself or
    // anywhere in the contiguous comment block directly above it (so it can
    // live naturally inside the gate's explaining comment). Scan upward through
    // comment / blank lines, stop at the first line of real code.
    let annotated = line.includes(ALLOW_ANNOTATION);
    for (let j = i - 1; j >= 0 && !annotated; j--) {
      const t = lines[j].trim();
      const isCommentOrBlank =
        t === '' || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.endsWith('*/');
      if (!isCommentOrBlank) break;
      if (lines[j].includes(ALLOW_ANNOTATION)) annotated = true;
    }
    if (annotated) continue;

    guard1Violations.push({ rel, line: i + 1, text: line.trim() });
  }
}

// ===========================================================================
// GUARD 2 — the three bundle-membership mirrors must agree.
// ===========================================================================

/** Pull the quoted UPPER_SNAKE tokens out of a source slice. */
function skuTokens(slice) {
  return new Set((slice.match(/'([A-Z][A-Z0-9_]+)'/g) || []).map((t) => t.slice(1, -1)));
}

/** Slice between an opener substring and the next closer char (balanced enough for flat literals). */
function sliceBlock(src, openMarker, openChar, closeChar) {
  const start = src.indexOf(openMarker);
  if (start === -1) return null;
  const from = src.indexOf(openChar, start + openMarker.length);
  if (from === -1) return null;
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    if (src[i] === openChar) depth++;
    else if (src[i] === closeChar) {
      depth--;
      if (depth === 0) return src.slice(from + 1, i);
    }
  }
  return null;
}

const guard2Errors = [];

function setEq(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}
function diff(a, b) {
  return {
    onlyA: [...a].filter((x) => !b.has(x)),
    onlyB: [...b].filter((x) => !a.has(x)),
  };
}

let guided = null;
let media = null;
let essentials = null;
let complete = null;
let sqlGuided = null;
let sqlMedia = null;

// --- source 1: BUNDLE_CHILD_SKUS in lib/entitlements.ts ---
{
  const f = join(WEB_ROOT, 'lib', 'entitlements.ts');
  const src = readFileSync(f, 'utf8');
  const g = sliceBlock(src, 'GUIDED_PACK: Object.freeze(', '[', ']');
  const m = sliceBlock(src, 'MEDIA_PACK: Object.freeze(', '[', ']');
  if (!g || !m) guard2Errors.push('Could not parse BUNDLE_CHILD_SKUS (GUIDED_PACK/MEDIA_PACK arrays) in lib/entitlements.ts — did the shape change? Update this linter.');
  else { guided = skuTokens(g); media = skuTokens(m); }
}

// --- source 2: BUNDLE_MEMBERS in onboarding-pricing.ts ---
{
  const f = join(WEB_ROOT, 'app', 'onboarding', 'wedding', '_components', 'onboarding-pricing.ts');
  const src = readFileSync(f, 'utf8');
  const objStart = src.indexOf('BUNDLE_MEMBERS');
  // Anchor on the assignment '=' so we slice the VALUE object, not the
  // `: { essentials: string[]; complete: string[] }` TYPE annotation (whose
  // brace comes first). The only '=' between the name and the value is the
  // assignment.
  const obj = objStart === -1 ? null : sliceBlock(src.slice(objStart), '=', '{', '}');
  if (!obj) guard2Errors.push('Could not parse BUNDLE_MEMBERS object in onboarding-pricing.ts — update this linter.');
  else {
    const e = sliceBlock(obj, 'essentials:', '[', ']');
    const c = sliceBlock(obj, 'complete:', '[', ']');
    if (!e || !c) guard2Errors.push('Could not parse BUNDLE_MEMBERS.essentials/.complete arrays — update this linter.');
    else { essentials = skuTokens(e); complete = skuTokens(c); }
  }
}

// --- source 3: bundles_granting_sku() VALUES in the migration ---
{
  const migDir = join(REPO_ROOT, 'supabase', 'migrations');
  const migFile = existsSync(migDir)
    ? readdirSync(migDir).find((n) => n.endsWith('_papic_ownership_bundle_aware.sql'))
    : null;
  if (!migFile) {
    guard2Errors.push('Could not find *_papic_ownership_bundle_aware.sql migration (bundles_granting_sku) — update this linter.');
  } else {
    const src = readFileSync(join(migDir, migFile), 'utf8');
    sqlGuided = new Set();
    sqlMedia = new Set();
    const re = /\(\s*'(GUIDED_PACK|MEDIA_PACK)'\s*,\s*'([A-Z0-9_]+)'\s*\)/g;
    let mm;
    while ((mm = re.exec(src)) !== null) {
      (mm[1] === 'GUIDED_PACK' ? sqlGuided : sqlMedia).add(mm[2]);
    }
    if (sqlGuided.size === 0 || sqlMedia.size === 0) {
      guard2Errors.push('Parsed 0 pairs from bundles_granting_sku() VALUES — did the SQL shape change? Update this linter.');
      sqlGuided = sqlMedia = null;
    }
  }
}

function compare(label, a, aName, b, bName) {
  if (a == null || b == null) return; // a parse error was already recorded
  if (!setEq(a, b)) {
    const d = diff(a, b);
    guard2Errors.push(
      `${label} drift — ${aName} vs ${bName}:` +
        (d.onlyA.length ? `\n      only in ${aName}: ${d.onlyA.join(', ')}` : '') +
        (d.onlyB.length ? `\n      only in ${bName}: ${d.onlyB.join(', ')}` : ''),
    );
  }
}

compare('Essentials', guided, 'BUNDLE_CHILD_SKUS.GUIDED_PACK', essentials, 'BUNDLE_MEMBERS.essentials');
compare('Essentials', guided, 'BUNDLE_CHILD_SKUS.GUIDED_PACK', sqlGuided, 'bundles_granting_sku(GUIDED_PACK)');
compare('Complete', media, 'BUNDLE_CHILD_SKUS.MEDIA_PACK', complete, 'BUNDLE_MEMBERS.complete');
compare('Complete', media, 'BUNDLE_CHILD_SKUS.MEDIA_PACK', sqlMedia, 'bundles_granting_sku(MEDIA_PACK)');

// A bundle code must never appear as a CHILD of any bundle (the activation
// fan-out in sku-activation.ts relies on this to avoid infinite recursion).
for (const [name, set] of [['GUIDED_PACK', guided], ['MEDIA_PACK', media]]) {
  if (!set) continue;
  for (const code of ['GUIDED_PACK', 'MEDIA_PACK']) {
    if (set.has(code)) guard2Errors.push(`${name} lists the bundle code ${code} as a child — bundles must not nest (breaks activateBundleChildren recursion guarantee).`);
  }
}

// ===========================================================================
// Report
// ===========================================================================

let failed = false;

if (guard1Violations.length) {
  failed = true;
  console.error(`${RED}✗ GUARD 1 — bare checkOrderOwnership() outside lib/entitlements.ts:${RST}`);
  for (const v of guard1Violations) {
    console.error(`    ${v.rel}:${v.line}  ${YEL}${v.text}${RST}`);
  }
  console.error(
    `\n  Couple-SKU gates must use the bundle-aware ${YEL}eventOwnsSku()${RST} so a` +
      `\n  GUIDED_PACK/MEDIA_PACK buyer is not denied a SKU the bundle includes.` +
      `\n  If the SKU is in NO bundle (bare reader is correct), annotate the call` +
      `\n  line with: ${YEL}// ${ALLOW_ANNOTATION} (<why it is not bundleable>)${RST}\n`,
  );
}

if (guard2Errors.length) {
  failed = true;
  console.error(`${RED}✗ GUARD 2 — bundle-membership mirrors out of sync:${RST}`);
  for (const e of guard2Errors) console.error(`    ${e}`);
  console.error(
    `\n  Keep all three in sync: BUNDLE_MEMBERS (onboarding-pricing.ts) ↔` +
      `\n  BUNDLE_CHILD_SKUS (entitlements.ts) ↔ bundles_granting_sku() (migration).\n`,
  );
}

if (failed) process.exit(1);

console.log(
  `✓ entitlement gates clean — ${SOURCE_FILES.length} files scanned; ` +
    `bundle membership in sync across all 3 mirrors ` +
    `(Essentials ${guided ? guided.size : '?'} · Complete ${media ? media.size : '?'}).`,
);
process.exit(0);
