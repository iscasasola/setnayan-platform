/**
 * Guard: EVERY EMPTY DASHBOARD PART SHOWS ITS GREYED-OUT EXAMPLE — and only through the one shared slot.
 *
 * Owner 2026-11-09 (DECISION_LOG 🧱👻 ×2): *"we want dashboards to look good as empty. like greyed out look of the
 * content of that page… once it has content, then the placeholder design disappears for that part"* — and *"on build
 * 5, we also fillup the empty look … of a user dashboard, event dashboard, and supplier dashboard"*. HOUSE_TEMPLATES
 * T28 recorded "NO GUARD — needs one that every dashboard part passes a preview". This is that guard.
 *
 *   1. THE SLOT — `ExamplePreview` draws the "Example" chip, and the sample `aria-hidden` + `inert` + `.sn-example`.
 *      `<EmptyState preview>` and `<QuietStart preview>` mount it; omitted, both render exactly as shipped.
 *   2. EVERY LISTED PART RENDERS ITS EXAMPLE — each part's Example component is rendered here and must come out
 *      wearing the slot and the shared sample (`lib/empty-look-samples.ts`).
 *   3. EVERY LISTED PART IS WIRED, AND GATED — the part's file mounts its Example, and the mount sits behind the
 *      condition that means "the read answered AND this part is empty", never a bare render.
 *   4. ONE TREATMENT — no file but `empty-state.tsx` writes `sn-example` markup, and no file but `globals.css` styles it.
 *
 * A part may leave the PARTS list only by being deleted. Supplier-dashboard parts belong to their own lanes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { SAMPLE_COUPLE } from '@/lib/empty-look-samples';
import { createRequire } from 'node:module';

/* 🪤 `globalThis.React` before the dynamic imports (the repo's tsconfig is `"jsx": "preserve"` — see
   `planning-is-the-collection-template.test.ts`), a CSS-module stub (a part's real component may import its
   `*.module.css`, which node cannot parse — each class name resolves to itself, so the markup is what the page draws),
   and a `server-only` stub. */
(globalThis as unknown as { React: unknown }).React = React;
{
  type ModT = {
    _extensions: Record<string, (m: { exports: unknown }) => void>;
    _load: (request: string, ...rest: unknown[]) => unknown;
  };
  const Mod = (createRequire(import.meta.url)('node:module') as { Module: ModT }).Module;
  Mod._extensions['.css'] = (m) => {
    m.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : k === 'default' ? m.exports : String(k)) });
  };
  // A part's component may sit beside server actions (`'server-only'` marks them) — as `the-camera-tab-is-the-camera.test.ts` does.
  const load = Mod._load;
  Mod._load = function (this: unknown, request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

async function html(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}

function assertIsExample(out: string, part: string) {
  assert.match(out, /data-example=""/, `${part}: not drawn through ExamplePreview`);
  assert.match(out, />Example</, `${part}: the "Example" chip is missing — a sample figure would read as real`);
  assert.match(out, /aria-hidden="true"[^>]*inert=""|inert=""[^>]*aria-hidden="true"/, `${part}: the sample is not aria-hidden + inert`);
  assert.match(out, /class="sn-example"/, `${part}: the sample is not faded (.sn-example)`);
}

/* ─── 1 · THE SLOT ─────────────────────────────────────────────────────────── */

test('👻 ExamplePreview: chip on top, the sample faded, hidden from readers and not pressable', async () => {
  const { ExamplePreview } = await import('./empty-state');
  const out = await html(React.createElement(ExamplePreview, null, React.createElement('a', { href: '/x' }, 'sample')));
  assertIsExample(out, 'ExamplePreview');
  assert.ok(out.indexOf('>Example<') < out.indexOf('sample'), 'the chip must come before the sample');
});

test('🧩 EmptyState and QuietStart carry the slot — and omitted, render exactly as shipped', async () => {
  const { EmptyState } = await import('./empty-state');
  const { QuietStart } = await import('./quiet-start');
  const { Users } = await import('lucide-react');
  const base = { Icon: Users, title: 'No guests yet', blurb: 'They land here.' };
  const plainE = await html(React.createElement(EmptyState, { ...base, readPermitted: true }));
  const plainQ = await html(React.createElement(QuietStart, base));
  assert.ok(!/data-example/.test(plainE) && !/data-example/.test(plainQ), 'no preview passed → no Example drawn');
  const withE = await html(React.createElement(EmptyState, { ...base, readPermitted: true, preview: React.createElement('p', null, 'row') }));
  const withQ = await html(React.createElement(QuietStart, { ...base, preview: React.createElement('p', null, 'row') }));
  assertIsExample(withE, 'EmptyState preview');
  assertIsExample(withQ, 'QuietStart preview');
  assert.ok(withE.indexOf('No guests yet') < withE.indexOf('data-example'), 'the honest line stays ON TOP of the Example');
});

/* ─── 2 + 3 · EVERY PART ───────────────────────────────────────────────────── */

type Part = {
  name: string;
  /** Renders the part's Example as the page mounts it. */
  render: () => Promise<React.ReactElement>;
  /** The file that mounts it, and the mount — which must sit behind `gate` on the same line. */
  file: string;
  mount: RegExp;
  gate: RegExp;
};

const PARTS: Part[] = [
  {
    name: 'User · Planning',
    render: async () => React.createElement((await import('@/app/dashboard/(launcher)/_components/board-examples')).PlanningExample),
    file: 'app/dashboard/(launcher)/page.tsx',
    mount: /<PlanningExample \/>/,
    gate: /boardReadAnswered \? <PlanningExample \/>/,
  },
  {
    name: 'User · Now happening',
    render: async () => React.createElement((await import('@/app/dashboard/(launcher)/_components/board-examples')).ShelfExample, { shelf: 'now' }),
    file: 'app/dashboard/(launcher)/page.tsx',
    mount: /<ShelfExample shelf="now" \/>/,
    gate: /happeningNow\.length === 0 && boardReadAnswered \? <ShelfExample shelf="now"/,
  },
  {
    name: 'User · Ended / Untold',
    render: async () => React.createElement((await import('@/app/dashboard/(launcher)/_components/board-examples')).ShelfExample, { shelf: 'ended' }),
    file: 'app/dashboard/(launcher)/page.tsx',
    mount: /<ShelfExample shelf="ended" \/>/,
    gate: /unwritten\.length === 0 && boardReadAnswered \? <ShelfExample shelf="ended"/,
  },
  {
    name: 'User · Told',
    render: async () => React.createElement((await import('@/app/dashboard/(launcher)/_components/board-examples')).ShelfExample, { shelf: 'told' }),
    file: 'app/dashboard/(launcher)/page.tsx',
    mount: /<ShelfExample shelf="told" \/>/,
    // Only when the stories were MEASURED — an unmeasured Told shelf is empty because the read never came back.
    gate: /written\.length === 0 && storiesMeasured && boardReadAnswered \? <ShelfExample shelf="told"/,
  },
  {
    name: 'User · Worth planning',
    render: async () => React.createElement((await import('@/app/dashboard/(launcher)/_components/board-examples')).WorthPlanningExample),
    file: 'app/dashboard/(launcher)/_components/year-moments-strip.tsx',
    mount: /<WorthPlanningExample \/>/,
    gate: /unsure \? null : <WorthPlanningExample \/>/,
  },
];

for (const p of PARTS) {
  test(`👻 ${p.name} — renders its Example from the shared sample`, async () => {
    const out = await html(await p.render());
    assertIsExample(out, p.name);
  });

  test(`🔒 ${p.name} — mounted, and only behind its "read answered and empty" gate`, () => {
    const src = read(p.file);
    assert.match(src, p.mount, `${p.name}: ${p.file} no longer mounts its Example — the part would draw empty again`);
    assert.match(src, p.gate, `${p.name}: the Example is mounted without its gate — it could show on a refused read or beside real content`);
  });
}

test('🧾 the sample couple lives in ONE fixture — no part types its own', () => {
  for (const file of new Set(PARTS.map((p) => p.file))) {
    assert.ok(!read(file).includes(SAMPLE_COUPLE), `${file} types the sample names itself — read lib/empty-look-samples.ts`);
  }
});

/* ─── 4 · ONE TREATMENT ────────────────────────────────────────────────────── */

test('🪞 one treatment: only ExamplePreview writes the Example markup, only globals.css styles it', () => {
  const offenders: string[] = [];
  (function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(tsx|ts|css)$/.test(name) && !name.includes('.test.')) {
        const rel = path.slice(WEB.length + 1);
        if (rel === 'app/_components/states/empty-state.tsx' || rel === 'app/globals.css') continue;
        if (/\bsn-example(-chip|-wrap)?\b/.test(stripComments(readFileSync(path, 'utf8')))) offenders.push(rel);
      }
    }
  })(join(WEB, 'app'));
  assert.deepEqual(offenders, [], `a per-page copy of the Example treatment — mount ExamplePreview instead: ${offenders.join(', ')}`);
  assert.match(readFileSync(join(WEB, 'app/globals.css'), 'utf8'), /\.sn-example \{ opacity: \.42; filter: grayscale\(1\); pointer-events: none;/);
});
