/**
 * Silid doorway guardrail tests — Whats_Next_Suite_AI_Pricing_2026-07-18 §2,
 * the 7 guardrails the 2026-07-18 doorway audit called for. Written against
 * the SHIPPED surface: /dashboard/[eventId]/silid (flag NEXT_PUBLIC_SILID,
 * name constant SILID_NAME). The Suite-vs-Silid rename is a pending OWNER
 * decision — these tests rename nothing and must follow the surface if it
 * ever moves (the source-scan below fails loudly if the page file moves).
 *
 * Statically covered here (5 of the 7):
 *   1. routes-helper   — every FREE_TOOLS href in silid/page.tsx comes from a
 *                        `routes.*` builder (no hand-typed paths) AND each
 *                        referenced builder resolves to a real app-router page.
 *   2. retired-prefix  — no doorway href starts with a retired route prefix
 *                        (/design, /vendors/compare).
 *   3. addOnHref       — addOnHref()/appStoreDetailHref() resolve to a real
 *                        app-router page for every catalog key (both seating
 *                        flag branches), and every non-opensDirect live entry
 *                        has an add-ons-detail.ts entry so /about can't 404.
 *   4. free ≠ surface  — the Silid free layer never contains a paid buy-wall
 *                        surface (the audit's Custom-QR regression), and a
 *                        free-trial chip is never presented as "Free".
 *   5. free ≠ paid     — every "Free"-labelled catalog entry's doorway lands
 *                        on a working page; the two audit-known gaps
 *                        (photo-delivery, music-creator) are pinned below in
 *                        KNOWN_GAPS so they stay visible until resolved.
 *
 * NOT covered here (need a running server — see the changelog fragment):
 *   6. auth-guard is the only legal redirect out of a tool page.
 *   7. smoke server binds localhost dual-stack + warm-compiles the routes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADD_ONS, addOnHref, appStoreDetailHref } from './add-ons-catalog';
import { addOnDetail } from './add-ons-detail';
import { routes } from './routes';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(LIB_DIR, '..', 'app');
const SILID_PAGE = path.join(APP_DIR, 'dashboard', '[eventId]', 'silid', 'page.tsx');

/** Retired route prefixes (2026-07-18 doorway audit) — nothing may link here. */
const RETIRED_PREFIXES = ['/design', '/vendors/compare'] as const;

/**
 * Audit-known gaps, pinned so they stay VISIBLE until resolved (per the task
 * brief: encode current reality, don't hide it). Each entry keeps its guardrail
 * green while asserting the gap still looks exactly the way we think it does —
 * if reality changes (owner flips a status, a real surface ships), the paired
 * assertion below fails and this allowlist must be updated consciously.
 */
const KNOWN_GAPS: Record<string, string> = {
  'photo-delivery':
    'TODO(0009): the /studio/photo-delivery page renders but the Drive backend is stubbed. ' +
    'Owner decision pending to mark it coming_soon so it stops sitting in the free layer as if it works ' +
    '(Whats_Next_Suite_AI_Pricing §2 "Free-layer honesty fixes").',
  'music-creator':
    'TODO: Music Creator has no browse surface of its own — addOnHref routes it to Pakanta. ' +
    'Delete+301 vs build a real music-browse surface is Pricing open question #7 ' +
    '(Whats_Next_Suite_AI_Pricing §3).',
};

const PAGE_FILES = ['page.tsx', 'page.ts', 'page.jsx', 'page.js', 'route.ts', 'route.tsx'];

function hasPageFile(dir: string): boolean {
  return PAGE_FILES.some((f) => fs.existsSync(path.join(dir, f)));
}

function subDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

/**
 * Resolve an app URL against the app-router tree on disk, mirroring Next.js
 * matching just enough for these guardrails: literal segments shadow dynamic
 * `[param]` siblings, `(group)` folders are URL-transparent, and a catch-all
 * `[...param]` swallows the rest.
 */
function walk(dir: string, segs: readonly string[]): boolean {
  if (segs.length === 0) {
    if (hasPageFile(dir)) return true;
    // A group folder can host the leaf page (e.g. dashboard/(launcher)/page.tsx).
    return subDirs(dir)
      .filter((n) => n.startsWith('(') && n.endsWith(')'))
      .some((n) => walk(path.join(dir, n), segs));
  }
  const head = segs[0]!; // segs.length > 0 guarded above
  const rest = segs.slice(1);
  const names = subDirs(dir);
  // 1 · literal match wins (Next.js: literal shadows dynamic without backtracking).
  if (names.includes(head) && walk(path.join(dir, head), rest)) return true;
  for (const name of names) {
    // 2 · catch-all swallows everything that remains.
    if (/^\[\.\.\..+\]$/.test(name) && hasPageFile(path.join(dir, name))) return true;
    // 3 · dynamic segment.
    if (/^\[[^\].]+\]$/.test(name) && walk(path.join(dir, name), rest)) return true;
    // 4 · route groups are transparent — retry the same segments inside.
    if (name.startsWith('(') && name.endsWith(')') && walk(path.join(dir, name), segs)) {
      return true;
    }
  }
  return false;
}

function routeExists(href: string): boolean {
  const clean = href.split('?')[0]!.split('#')[0]!;
  return walk(
    APP_DIR,
    clean.split('/').filter((s) => s.length > 0),
  );
}

/** Replicates the Silid page's free-layer partition (silid/page.tsx). */
function silidFreeLayerKeys(): string[] {
  return ADD_ONS.filter(
    (a) => a.studioGroup !== 'utility' && a.tier === 'free' && a.status !== 'coming_soon',
  ).map((a) => a.key);
}

const EVT = 'EVENT_ID';
const silidSource = fs.readFileSync(SILID_PAGE, 'utf8');

// ── 1 · routes-helper: FREE_TOOLS hrefs come from `routes.*` only ──────────────

test('silid FREE_TOOLS: every href is built from a routes.* helper (no hand-typed paths)', () => {
  const block = silidSource.match(/const FREE_TOOLS[\s\S]*?\n\];/);
  assert.ok(block, 'silid/page.tsx must contain the FREE_TOOLS array');
  const hrefs = block![0].match(/href:[^,]*/g) ?? [];
  assert.ok(hrefs.length >= 5, `expected the free planning tools, found ${hrefs.length} hrefs`);
  for (const h of hrefs) {
    assert.match(
      h,
      /href:\s*\([^)]*\)\s*=>\s*routes\./,
      `free-tool href must come from routes.*, got: ${h}`,
    );
  }
});

test('silid page: every routes.* builder it references resolves to a real page', () => {
  const refs = new Set(
    [...silidSource.matchAll(/\broutes\.([A-Za-z0-9_$.]+)\(/g)].map((m) => m[1]!),
  );
  assert.ok(refs.size > 0, 'silid/page.tsx should reference routes.* builders');
  for (const ref of refs) {
    let node: unknown = routes;
    for (const part of ref.split('.')) {
      assert.ok(
        node !== null && typeof node === 'object' && part in (node as Record<string, unknown>),
        `routes.${ref} — segment "${part}" does not exist on the routes helper`,
      );
      node = (node as Record<string, unknown>)[part];
    }
    assert.equal(typeof node, 'function', `routes.${ref} must be a builder function`);
    const href = (node as (...args: string[]) => string)(EVT, EVT);
    assert.ok(routeExists(href), `routes.${ref} → ${href} has no page in the app router`);
  }
});

// ── 2 · retired-prefix: no doorway points into a retired route tree ────────────

test('no add-on href starts with a retired route prefix', () => {
  for (const a of ADD_ONS) {
    for (const href of [addOnHref(a.key, EVT), appStoreDetailHref(a.key, EVT)]) {
      for (const prefix of RETIRED_PREFIXES) {
        assert.ok(
          !href.startsWith(prefix),
          `${a.key}: ${href} points into the retired ${prefix} tree`,
        );
      }
    }
  }
});

test('silid page source contains no retired route prefix', () => {
  for (const prefix of RETIRED_PREFIXES) {
    assert.ok(
      !silidSource.includes(`'${prefix}`) && !silidSource.includes('`' + prefix),
      `silid/page.tsx hand-types a retired prefix: ${prefix}`,
    );
  }
});

// ── 3 · addOnHref / appStoreDetailHref resolve for every catalog key ───────────

test('addOnHref resolves to a real app-router page for every catalog key', () => {
  for (const a of ADD_ONS) {
    const href = addOnHref(a.key, EVT);
    assert.ok(routeExists(href), `${a.key}: addOnHref → ${href} has no page`);
  }
});

test('addOnHref seating kill-switch branch (NEXT_PUBLIC_SEATING_3D=false) also resolves', () => {
  const prev = process.env.NEXT_PUBLIC_SEATING_3D;
  try {
    process.env.NEXT_PUBLIC_SEATING_3D = 'false';
    const fallback = addOnHref('seating', EVT);
    assert.equal(fallback, `/dashboard/${EVT}/seating`, 'kill-switch must open the 2D editor');
    assert.ok(routeExists(fallback), `seating fallback ${fallback} has no page`);
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_SEATING_3D;
    else process.env.NEXT_PUBLIC_SEATING_3D = prev;
  }
});

test('appStoreDetailHref resolves to a real app-router page for every catalog key', () => {
  for (const a of ADD_ONS) {
    const href = appStoreDetailHref(a.key, EVT);
    assert.ok(routeExists(href), `${a.key}: appStoreDetailHref → ${href} has no page`);
  }
});

test('every non-opensDirect live entry has an add-ons-detail entry (its /about page cannot 404)', () => {
  for (const a of ADD_ONS) {
    if (a.opensDirect || a.status === 'coming_soon' || a.studioGroup === 'utility') continue;
    assert.ok(
      addOnDetail(a.key),
      `${a.key}: /studio/about/${a.key} would notFound() — add an ADD_ON_DETAILS entry`,
    );
  }
});

// ── 4 · free layer ≠ paid buy-wall surface ─────────────────────────────────────

test('the paid Custom QR buy-wall never appears in the Silid free layer', () => {
  // The audit's concrete regression: /studio/custom-qr-guest is the PAID SKU
  // surface; the FREE per-guest QR lives on the Invitation tab. Custom QR must
  // therefore never carry tier 'free' (which is what feeds the free layer).
  const customQr = ADD_ONS.find((a) => a.key === 'custom-qr-guest');
  assert.ok(customQr, 'custom-qr-guest should exist in the catalog');
  assert.notEqual(customQr!.tier, 'free', 'custom-qr-guest routes to the paid buy wall');
  assert.ok(!silidFreeLayerKeys().includes('custom-qr-guest'));
});

test('a free-trial chip is never presented as "Free" (trial ≠ free)', () => {
  for (const a of ADD_ONS) {
    if (a.freeTrial) {
      assert.notEqual(
        a.tier,
        'free',
        `${a.key}: carries both a freeTrial chip and tier 'free' — a trial is not free`,
      );
    }
  }
});

test('the Silid free layer is exactly the reviewed set (any change is a conscious diff)', () => {
  assert.deepEqual(silidFreeLayerKeys().sort(), [
    'animated-monogram',
    'editorial',
    'event',
    'landing-page',
    'mood-board',
    'music-creator',
    'panood',
    'photo-delivery',
    'playlist',
    'rsvp',
    'save-the-date',
    'seating',
  ]);
});

// ── 5 · free label ≠ paid SKU: every shipped entry's doorway works ─────────────

test('every live/web_v1 entry opens a working page (known gaps pinned in KNOWN_GAPS)', () => {
  for (const a of ADD_ONS) {
    if (a.status === 'coming_soon') continue;
    const href = addOnHref(a.key, EVT);
    assert.ok(
      routeExists(href),
      KNOWN_GAPS[a.key]
        ? `${a.key}: ${href} has no page — known gap: ${KNOWN_GAPS[a.key]}`
        : `${a.key}: status='${a.status}' but ${href} has no page`,
    );
  }
});

test('KNOWN_GAPS still describe reality (update the allowlist when they resolve)', () => {
  // photo-delivery: still presented as a shipped free tool while the Drive
  // backend is stubbed. When the owner marks it coming_soon (or the backend
  // ships), this fails → delete its KNOWN_GAPS entry.
  const photoDelivery = ADD_ONS.find((a) => a.key === 'photo-delivery');
  assert.ok(photoDelivery, 'photo-delivery should exist in the catalog');
  assert.equal(
    photoDelivery!.status,
    'web_v1',
    'photo-delivery status changed — resolve its KNOWN_GAPS entry',
  );
  assert.equal(photoDelivery!.tier, 'free');

  // music-creator: no surface of its own — routes to Pakanta. When it gets a
  // real browse surface (or is deleted+301'd), this fails → update KNOWN_GAPS.
  assert.equal(
    addOnHref('music-creator', EVT),
    `/dashboard/${EVT}/studio/pakanta`,
    'music-creator no longer routes to Pakanta — resolve its KNOWN_GAPS entry',
  );
});
