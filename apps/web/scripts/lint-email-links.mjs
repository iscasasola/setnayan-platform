#!/usr/bin/env node
/**
 * lint-email-links.mjs
 *
 * Static guard: every `relatedUrl:` literal passed to `emitNotification(...)`
 * must resolve to a real route under `apps/web/app/**\/page.tsx`. Each
 * `emitNotification` call ultimately fires an email through Resend (see
 * `apps/web/lib/notification-emit.ts` + `apps/web/lib/email.ts`), so a stale
 * `relatedUrl` ships a 404 link to the user's inbox. Task #20 of the
 * 2026-05-22 audit cleared the existing drift; this script keeps it that way.
 *
 * What it checks
 *   - For every file under apps/web/lib + apps/web/app, find lines matching
 *     /relatedUrl:\s*[`'"]/.
 *   - Extract the URL literal (template-strings collapse `${...}` → `[seg]`
 *     so `/dashboard/${eventId}` resolves against `/dashboard/[eventId]`).
 *   - Verify the resulting path resolves to either:
 *       (a) a static page.tsx, OR
 *       (b) a dynamic page.tsx whose `[param]` shape matches `[seg]`.
 *   - Hash anchors (`#concierge`) are stripped before path resolution since
 *     they only affect in-page scroll, not route resolution.
 *
 * Why static + literal-only
 *   - Notifications are emitted from server actions, not at build time, so we
 *     can't dynamically trace every variable. The literal patterns ARE the
 *     contract — they're how the email body composes its "Open Setnayan: …"
 *     link, and they're the surface most likely to drift when routes move.
 *   - Anything more dynamic (helper that builds the URL from a config object)
 *     would need a runtime sample-render test, deferred to V1.5+.
 *
 * Background: CLAUDE.md decision log row "Task #20 — audit + fix email
 * template links" + [[feedback_setnayan_orphan_prevention]] memory.
 *
 * Usage:
 *   pnpm lint:email-links        # from apps/web
 *   node scripts/lint-email-links.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '..');
const APP_ROOT = join(WEB_ROOT, 'app');

// ---------------------------------------------------------------------------
// 1. Walk apps/web/app and collect every page.tsx — these are the universe
//    of routes that `relatedUrl` is allowed to point at.
// ---------------------------------------------------------------------------

function collectRoutes(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const s = statSync(abs);
    if (s.isDirectory()) {
      // skip route-group folders' name suffix later when normalizing
      out.push(...collectRoutes(abs));
    } else if (s.isFile() && entry === 'page.tsx') {
      const routePath = relative(APP_ROOT, dirname(abs))
        .split(sep)
        .filter((seg) => !seg.startsWith('('))
        .map((seg) => {
          // [param] → [param], (group) already stripped above
          return seg;
        })
        .join('/');
      out.push('/' + routePath);
    }
  }
  return out;
}

const ROUTES = new Set(collectRoutes(APP_ROOT));

// ---------------------------------------------------------------------------
// 2. Walk apps/web/lib + apps/web/app for files containing `relatedUrl:` and
//    extract the literal that follows.
// ---------------------------------------------------------------------------

function collectTsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const abs = join(dir, entry);
    const s = statSync(abs);
    if (s.isDirectory()) {
      out.push(...collectTsFiles(abs));
    } else if (
      s.isFile()
      && (entry.endsWith('.ts') || entry.endsWith('.tsx'))
    ) {
      out.push(abs);
    }
  }
  return out;
}

const SOURCE_FILES = [
  ...collectTsFiles(APP_ROOT),
  ...collectTsFiles(join(WEB_ROOT, 'lib')),
];

// Matches `relatedUrl: \`...\`` OR `relatedUrl: '...'` OR `relatedUrl: "..."`.
// Captures the literal contents.
const RELATED_URL_RE = /relatedUrl:\s*(?:`([^`]*)`|'([^']*)'|"([^"]*)")/g;

// ---------------------------------------------------------------------------
// 3. Normalize a captured literal into a route-comparable path.
//    - Replace `${...}` with `[seg]` (matches dynamic segments).
//    - Drop trailing `?query=...` since Next.js routes don't dispatch on it.
//    - Drop `#anchor` since hash is in-page scroll only.
// ---------------------------------------------------------------------------

function normalize(literal) {
  let p = literal;
  // Strip query + hash before any other processing.
  p = p.split('#')[0].split('?')[0];
  // Replace each `${...}` with a placeholder we'll match against `[*]` later.
  p = p.replace(/\$\{[^}]+\}/g, '[*]');
  return p;
}

function matchesAnyRoute(normalized) {
  // Direct hit (static route).
  if (ROUTES.has(normalized)) return true;
  // Dynamic match: split into segments and check each known route. We
  // require an exact segment-count match so e.g. `/foo/[*]/bar` doesn't
  // resolve to `/foo/[id]` (which has fewer segments). Concrete literal
  // segments must equal the route's static segment exactly; only `[*]`
  // (template-substituted slot) matches a route's `[param]` segment.
  const literalSegs = normalized.split('/');
  for (const route of ROUTES) {
    const routeSegs = route.split('/');
    if (routeSegs.length !== literalSegs.length) continue;
    let ok = true;
    for (let i = 0; i < routeSegs.length; i++) {
      const r = routeSegs[i];
      const l = literalSegs[i];
      if (r === l) continue;
      // Dynamic match: route's `[param]` slot lines up with a template
      // substitution `[*]` from the literal.
      if (r.startsWith('[') && r.endsWith(']') && l === '[*]') continue;
      // Concrete literal segment lining up with a `[param]` slot is ALSO
      // accepted — Next.js dispatches `[param]` on any non-empty value at
      // runtime. (Rare in V1 — most notifications template the ID — but
      // defensive.)
      if (
        r.startsWith('[')
        && r.endsWith(']')
        && l !== ''
        && l !== '[*]'
        && !l.startsWith('[')
      ) {
        continue;
      }
      ok = false;
      break;
    }
    if (ok) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 4. Scan + report.
// ---------------------------------------------------------------------------

let problemCount = 0;
const checked = [];

for (const file of SOURCE_FILES) {
  const text = readFileSync(file, 'utf8');
  RELATED_URL_RE.lastIndex = 0;
  let m;
  while ((m = RELATED_URL_RE.exec(text)) !== null) {
    const literal = m[1] ?? m[2] ?? m[3];
    if (literal === undefined || literal === '' || literal === 'null') continue;
    const normalized = normalize(literal);
    const rel = relative(WEB_ROOT, file);
    if (!matchesAnyRoute(normalized)) {
      // line number for friendlier error message
      const lineNo = text.slice(0, m.index).split('\n').length;
      console.error(
        `❌ ${rel}:${lineNo} — relatedUrl ${JSON.stringify(literal)} resolves to ${JSON.stringify(normalized)} but no matching page.tsx exists.`,
      );
      problemCount++;
    } else {
      checked.push({ file: rel, literal, normalized });
    }
  }
}

if (problemCount === 0) {
  console.log(`✅ All ${checked.length} email-template relatedUrl(s) resolve to real routes.`);
  process.exit(0);
} else {
  console.error(`\n${problemCount} broken email link(s). Fix the route path or add the missing page.tsx.`);
  process.exit(1);
}
