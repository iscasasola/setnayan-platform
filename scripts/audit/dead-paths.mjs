#!/usr/bin/env node
// dead-paths — READ-ONLY audit helper for MAPS-CONNECTIONS-AUDIT-2026-11-24 (pass 3).
//
// `lib/every-route-builder-reaches-a-page.test.ts` proves every builder in
// lib/routes.ts reaches a page. Its header says nobody checks the reverse: a
// hand-typed path in a component, an email, a notification or a redirect. This
// collects every internal path literal in apps/web/app and apps/web/lib
// ('/x/y', "/x/y", `/x/${id}/y`) and checks it against the page/route folders
// under app/, the way the builder test does:
//   · a literal segment must match a literal folder; only an interpolation
//     (`${…}`) may fill a [dynamic] folder — so '/venues' does not "pass" by
//     landing in the guest Event Hub `app/[slug]`;
//   · route groups `(name)` are transparent; [...x] / [[...x]] swallow the rest.
// It prints:
//   NO PAGE     — no folder answers the path (a 404 unless a redirect catches it)
//   SLUG ONLY   — only `app/[slug]` (the Event Hub) answers a literal first segment
//   STUB        — the path lands on a page the screens map marks `stub` (a redirect-only page)
//   LEGACY      — a retired address: lib/legacy-redirects.ts (the middleware) or next.config.ts forwards it
//
// Candidates only; the audit doc lists what was confirmed by reading the code.
// Touches no database, no network, no app file.
//
// USAGE  node --experimental-strip-types --no-warnings scripts/audit/dead-paths.mjs [--json]
//   SUFFIX — a short path handed to a builder that prefixes it (e.g. `ctaPath`); listed so it is not mistaken for a dead link

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { stripComments } from '../../apps/web/scripts/port-controls.mjs';
import { register } from 'node:module';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const WEB = join(ROOT, 'apps', 'web');
const APP = join(WEB, 'app');

// ── the route tree ─────────────────────────────────────────────────────────
const pages = []; // arrays of segments (group folders removed)
function walkRoutes(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name.startsWith('_') || name === 'dev') continue;
      walkRoutes(p);
    } else if (/^(page\.tsx|page\.ts|route\.ts|route\.tsx)$/.test(name)) {
      const rel = relative(APP, dir);
      const segs = rel === '' ? [] : rel.split(sep).filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('@'));
      pages.push({ segs, file: relative(WEB, p) });
    }
  }
}
walkRoutes(APP);

// Special files Next serves at the root without a folder.
const ROOT_FILES = new Set(
  readdirSync(APP)
    .filter((n) => /\.(ts|tsx|xml|txt)$/.test(n) || /^sitemap|^robots|^manifest|^icon|^apple-icon|^opengraph/.test(n))
    .map((n) => n.replace(/\.(tsx?|xml)$/, '').replace(/^/, '')),
);

// The middleware's own retired-page table (lib/legacy-redirects.ts), asked directly — never a copy.
// Needs `node --experimental-strip-types` (Node 22+); without it the LEGACY rows fall back to next.config's list only.
let legacyTarget = () => null;
try {
  register(pathToFileURL(join(ROOT, 'scripts', 'audit', 'ts-alias-hooks.mjs')).href);
  const mod = await import(pathToFileURL(join(WEB, 'lib', 'legacy-redirects.ts')).href);
  legacyTarget = mod.legacyRedirectTarget;
} catch (e) {
  console.error(`(legacy-redirects.ts not loaded: ${e.message.split('\n')[0]} — run with --experimental-strip-types)`);
}

const screens = JSON.parse(readFileSync(join(WEB, 'lib', 'ugat', 'screens.generated.json'), 'utf8'));
const stubFiles = new Set(screens.screens.filter((s) => s.status === 'stub').map((s) => s.file));
const legacy = screens.legacyRedirects.map((r) => r.source.replace(/:[\w]+\*?/g, '*'));

const DYN = '\u0000'; // a `${…}` segment

function matches(segs, path) {
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (/^\[\[?\.\.\./.test(s)) return true; // catch-all
    const p = path[i];
    if (p === undefined) return false;
    if (/^\[.*\]$/.test(s)) continue; // dynamic folder: any value (literal or interpolated)
    if (p === DYN) return false; // an interpolation cannot fill a literal folder
    if (p.includes(DYN)) return false;
    if (s !== p) return false;
  }
  return segs.length === path.length;
}

function resolve(path) {
  const hits = pages.filter((pg) => matches(pg.segs, path));
  if (!hits.length) return { kind: 'NO PAGE' };
  // Prefer a literal match over the Event Hub catch-all.
  const literal = hits.filter((h) => !(h.segs[0] === '[slug]' && path[0] !== DYN));
  if (!literal.length) return { kind: 'SLUG ONLY', file: hits[0].file };
  const best = literal.sort((a, b) => b.segs.filter((s) => !s.startsWith('[')).length - a.segs.filter((s) => !s.startsWith('[')).length)[0];
  if (stubFiles.has(best.file)) return { kind: 'STUB', file: best.file };
  return { kind: 'OK', file: best.file };
}

// ── the path literals ──────────────────────────────────────────────────────
function skip(rel) {
  return /\.test\.tsx?$/.test(rel) || /\.lab\.tsx$/.test(rel) || rel.startsWith('app/dev/') || rel.includes('.generated.') || rel.endsWith('.harness.ts');
}
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) {
      const rel = relative(WEB, p);
      if (!skip(rel)) out.push(rel);
    }
  }
  return out;
}
// The repo's ONE comment stripper (lint-one-comment-stripper.mjs): never a private two-replace regex.
const strip = stripComments;

// A quoted string or template that starts with "/" + a lowercase letter and looks like a path.
const LITERAL = /(['"`])(\/[a-z][a-z0-9\-/$[\]{}().?=&_:%]*?)\1/g;
const NOT_ROUTE = /^\/(api\/|_next|static\/|images?\/|fonts?\/|onboarding\/cities\/|sounds?\/|icons?\/|og\/|.*\.(png|jpe?g|webp|svg|gif|mp4|mp3|webm|json|ico|txt|xml|css|js|woff2?|pdf|html|glb|gltf|ttf|otf|wasm)(\?|$))/;

const findings = [];
for (const rel of [...walk(APP), ...walk(join(WEB, 'lib'))]) {
  if (rel === 'lib/routes.ts') continue; // held by its own test
  const s = strip(readFileSync(join(WEB, rel), 'utf8'));
  for (const m of s.matchAll(LITERAL)) {
    let raw = m[2];
    if (m[1] !== '`' && raw.includes('${')) continue;
    if (NOT_ROUTE.test(raw)) continue;
    if (/\s/.test(raw) || raw.length < 2) continue;
    // Only things used as a destination: href=, push(, replace(, redirect(, revalidatePath(, url:, link:, path:
    const before = s.slice(Math.max(0, m.index - 60), m.index);
    // revalidatePath is a cache key, not a door: a stale one costs a refresh, never a dead press.
    if (/revalidatePath\(\s*$/.test(before)) continue;
    const ctx = /(href|to|push|replace|redirect|url|link|path|Url|Href|Path|door|cta|ctaPath|next|returnTo|destination)\s*[:=(]\s*[({[]?\s*$/.exec(before)?.[1];
    if (!ctx) continue;
    // A suffix glued onto a base (`base + '/x'`, `${base}/x`) is not a path of its own.
    if (/[+]\s*$/.test(before) || ctx === 'ctaPath' || (/^\/[a-z-]+$/.test(raw) && /Path$/.test(ctx) && !raw.startsWith('/dashboard'))) {
      findings.push({ file: rel, path: raw, kind: 'SUFFIX', lands: null, ctx });
      continue;
    }
    let path = raw.split(/[?#]/)[0].replace(/\$\{[^}]*\}/g, DYN);
    if (path.endsWith('/') && path.length > 1) path = path.slice(0, -1);
    const segs = path.split('/').slice(1).filter(Boolean);
    if (segs.length === 0) continue;
    if (segs.length === 1 && ROOT_FILES.has(segs[0])) continue;
    const r = resolve(segs);
    const concrete = path.replace(new RegExp(DYN, 'g'), 'x');
    const query = raw.includes('?') ? raw.slice(raw.indexOf('?')) : '';
    const forwards = legacyTarget(concrete, query) ??
      (legacy.some((L) => new RegExp('^' + L.replace(/[.+?^$()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]+(?:/.*)?') + '$').test(concrete)) ? '(next.config redirect)' : null);
    if (forwards) {
      findings.push({ file: rel, path: raw, kind: 'LEGACY', lands: `forwards to ${forwards}`, ctx });
      continue;
    }
    if (r.kind === 'OK') continue;
    findings.push({ file: rel, path: raw, kind: r.kind, lands: r.file ?? null, ctx });
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(findings, null, 2));
} else {
  const by = {};
  for (const f of findings) (by[f.kind] ??= []).push(f);
  for (const kind of ['NO PAGE', 'SLUG ONLY', 'LEGACY', 'STUB', 'SUFFIX']) {
    const list = by[kind] ?? [];
    console.log(`\n${kind}: ${list.length}`);
    for (const f of list) console.log(`   ${f.path}   ← ${f.file} [${f.ctx}]${f.lands ? `   (${f.lands})` : ''}`);
  }
}
