import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { copyStrings } from '@/lib/public-copy-strings';

/**
 * THE PUBLIC PAGES SAY "SUPPLIER" AND "EVENT HUB" (sweep 2026-10-19, B8 · B9).
 *
 * Owner rules: the people who sell on Setnayan are "suppliers", never
 * "vendors"; the page a guest opens is the "Event Hub", never a "website" or a
 * "site" (2026-09-24). The sweep found a stranger reading the old words on
 * /explore ("Search verified Filipino vendors"), /about, /creators ("View
 * vendor"), /pricing, /waitlist ("Wedding website", "free vendor subdomain"),
 * /realstories, /for-suppliers ("your own website" ×4), /monogram, /features
 * ("your event site"), the blog's "Vendors" shelf and the Home overlays.
 *
 * ── WHAT IS READ — THE PROPERTY, NOT A WORD LIST OVER THE FILE ──────────────
 * "vendor" is also the repo's code word (`/vendor-dashboard`, `vendor_id`,
 * `import … from './vendor-card'`). A regex over the source convicts all of it,
 * so this reads what a PERSON reads: JSX text and every string literal that is
 * not a module path, an unread attribute (className, href, key…), an object
 * key, a type, a comparison operand or a machine token. See
 * `lib/public-copy-strings.ts`; its own behaviour is pinned below, because a
 * guard whose extractor silently drops copy is green and blind.
 *
 * ── WHAT IS NOT SCANNED, AND WHY ────────────────────────────────────────────
 *   · The legal pages (privacy · terms · refunds · cookies · acceptable-use) —
 *     legal text with its own review, the same carve-out as
 *     `app/(shell)/product-pages-say-what-ships.test.ts`. They still say
 *     "vendor" and "event website"; that change is the owner's to make.
 *   · Blog article bodies (`lib/blog-batches/*`), `/llms.txt`, the creator
 *     chapter pages (`app/u/**`) and the signed-in app — outside the sweep
 *     batch. Re-measure with the scanner before widening ROOTS.
 *
 * Every allowance below names the exact phrase and why it is true. An
 * allowance that stops matching anything fails too, so the list cannot rot
 * into a blanket exemption.
 *
 * ── WIDENED 2026-10-23 (live check of the public pages) ─────────────────────
 * Two more words, and the public pages the first cut did not read:
 *   · "celebration" — say "event" (owner 2026-10-04). "Celebration" survives
 *     only as an EVENT TYPE's name, which comes from the database vocabulary,
 *     not from these files — so it can never be a finding here.
 *   · "Animated Monogram" — retired from sale 2026-10-22 (#6781); its
 *     animation is Event Hub Pro's Logo & QR part. /palogo and the home page's
 *     structured data still sold it by name.
 *   · New roots: the sign-up doors (/open-shop, /signup, /login, the password
 *     pages), /help articles, /download, the /tour walk-through, the front
 *     page itself (`app/page.tsx`), the shared doorway components, and the two
 *     copy libraries every Studio and feature page reads (`lib/studio-apps.ts`,
 *     `lib/feature-pages`). /tour said "vendor" 24 times; /open-shop called a
 *     shop's address "Your website".
 *
 * MUTATION: write "Browse vendors" into explore-search-hero.tsx, or "your
 * website" into vendor-grow-sections.tsx → this fails.
 * MUTATION: write "the vendors" into app/tour/page.tsx, "the celebration" into
 * lib/studio-apps.ts, or "Animated Monogram" into palogo/page.tsx → this fails.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

/** The public copy modules — what a signed-out stranger reads. */
const ROOTS = [
  'app/(shell)',
  'app/for-suppliers',
  'app/creators',
  'app/waitlist',
  'app/monogram',
  'app/realstories',
  'app/blog',
  'app/our-story',
  'app/features',
  'app/tl',
  'app/_components/home',
  'app/_components/frontdoor',
  'lib/blog.ts',
  'lib/help.ts',
  // Widened 2026-10-23 — see the docblock.
  'app/page.tsx',
  'app/open-shop',
  'app/signup',
  'app/login',
  'app/forgot-password',
  'app/reset-password',
  'app/help',
  'app/download',
  'app/tour',
  'app/_components/marketing',
  'lib/studio-apps.ts',
  'lib/feature-pages',
] as const;

const LEGAL = new Set(['privacy', 'terms', 'refunds', 'cookies', 'acceptable-use']);

/** The words. "site" only where it names OUR page (your/our/the/event… site). */
const BANNED: ReadonlyArray<[string, RegExp]> = [
  ['vendor — say "supplier"', /\bvendors?\b/gi],
  ['website — say "Event Hub" (or "Setnayan page" for a supplier)', /\bweb ?sites?\b/gi],
  ['site — say "Event Hub"', /\b(?:your|our|their|the|event|wedding|invitation|own)\s+sites?\b/gi],
  ['celebration — say "event"', /\bcelebrations?\b/gi],
  ['Animated Monogram — retired; say Logo Maker / Event Hub Pro’s Logo & QR', /\banimated monograms?\b/gi],
];

/** Each allowance: the file, the exact phrase it permits, and why that is true. */
const ALLOWED: ReadonlyArray<{ file: string | RegExp; phrase: RegExp; why: string }> = [
  {
    file: /^app\/\(shell\)\/pawebsite\//,
    phrase: /\bweb ?sites?\b|\bwedding sites\b/i,
    why:
      '/pawebsite is the page for people searching for a "wedding website" — every use names the ' +
      'category the Event Hub replaces, never our own page (same exemption as product-pages-say-what-ships).',
  },
  {
    file: 'lib/help.ts',
    phrase: /paid wedding website builders/i,
    why: 'The question a couple types into a search engine; it names the other products, and the answer is "the Event Hub".',
  },
  {
    file: 'lib/blog.ts',
    phrase: /full liturgical celebration/i,
    why: "The Church's own word for the rite (a liturgical celebration is the Mass), in an article about a Catholic wedding — not our word for an event.",
  },
  {
    file: 'lib/help.ts',
    phrase: /local government website/i,
    why: "A city hall's own website, where a supplier renews a business permit — not ours.",
  },
  {
    file: 'app/(shell)/pricing/page.tsx',
    phrase: /other event sites/i,
    why:
      'Names OTHER companies\' event websites — the ones /pricing compares against (owner 2026-10-25: "while Other ' +
      'websites pay for these services, we give it for free"; prototype pricing_free_plus_addons revision 4) — never our page.',
  },
  {
    file: 'app/(shell)/pricing/page.tsx',
    phrase: /Event website, unlimited guests/,
    why:
      'A row of "One place, instead of several tools": the product a couple would buy ELSEWHERE, at that site\'s price ' +
      '(lib/pricing-elsewhere.ts) — not our Event Hub, which is the "₱0 here" beside it.',
  },
];

function walk(p: string): string[] {
  if (statSync(p).isDirectory()) return readdirSync(p).flatMap((n) => walk(join(p, n)));
  return /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p) ? [p] : [];
}

function publicFiles(): string[] {
  return ROOTS.flatMap((r) => walk(join(WEB, r))).filter((f) => {
    const rel = relative(join(WEB, 'app', '(shell)'), f).split(sep)[0] ?? '';
    return !LEGAL.has(rel);
  });
}

const rel = (f: string) => relative(WEB, f).split(sep).join('/');

type Hit = { where: string; word: string; context: string; allowedBy: number | null };

function scan(): Hit[] {
  const hits: Hit[] = [];
  for (const f of publicFiles()) {
    const r = rel(f);
    for (const s of copyStrings(readFileSync(f, 'utf8'), f)) {
      for (const [name, re] of BANNED) {
        for (const m of s.text.matchAll(re)) {
          const at = m.index ?? 0;
          const line = s.line + (s.text.slice(0, at).match(/\n/g)?.length ?? 0);
          const context = s.text.slice(Math.max(0, at - 50), at + 60).replace(/\s+/g, ' ').trim();
          const idx = ALLOWED.findIndex(
            (a) => (typeof a.file === 'string' ? a.file === r : a.file.test(r)) && a.phrase.test(s.text),
          );
          hits.push({ where: `${r}:${line}`, word: name, context, allowedBy: idx === -1 ? null : idx });
        }
      }
    }
  }
  return hits;
}

test('the scan reads the pages the sweep named — it cannot pass on an empty tree', () => {
  const files = publicFiles().map(rel);
  assert.ok(files.length >= 100, `only ${files.length} public copy files — has a root moved?`);
  for (const must of [
    'app/for-suppliers/_components/vendor-grow-sections.tsx',
    'app/(shell)/explore/_components/explore-search-hero.tsx',
    'app/waitlist/page.tsx',
    'app/creators/_components/creator-story-sections.tsx',
    'app/(shell)/pricing/page.tsx',
    'app/monogram/page.tsx',
    'app/(shell)/realstories/page.tsx',
    'lib/blog.ts',
    'app/page.tsx',
    'app/open-shop/_components/address-preview.tsx',
    'app/tour/page.tsx',
    'app/(shell)/palogo/page.tsx',
    'lib/studio-apps.ts',
  ]) {
    assert.ok(files.includes(must), `${must} was not scanned`);
  }
  assert.ok(!files.some((f) => f.startsWith('app/(shell)/privacy/')), 'the legal pages are not this guard’s to read');
});

test('the extractor reads copy and ignores code', () => {
  const src = [
    "import { VendorCard } from './vendor-card';",
    "const href = '/vendor-dashboard';",
    "const k = { vendor_id: 1, 'vendors': 2 };",
    "if (role === 'vendor') {}",
    "console.warn('[vendors] fetch failed');",
    "const ld = { '@type': 'WebSite', type: 'website' };",
    "const id = `${base}/#website`;",
    "export const LABEL = 'Vendors';",
    "export const T = { title: 'Browse vendors' };",
    'export function X() { return <a className="vendor-link" href="/vendors" aria-label="Open vendor">See every vendor</a>; }',
  ].join('\n');
  const texts = copyStrings(src, 'probe.tsx').map((s) => s.text.trim());
  // Copy — must be read.
  for (const copy of ['Vendors', 'Browse vendors', 'Open vendor', 'See every vendor']) {
    assert.ok(texts.includes(copy), `the extractor dropped copy a person reads: "${copy}" (got ${JSON.stringify(texts)})`);
  }
  // Code — must not be.
  for (const code of ['./vendor-card', '/vendor-dashboard', 'vendors', 'vendor', '[vendors] fetch failed', 'WebSite', 'website', 'vendor-link', '/vendors']) {
    assert.ok(!texts.includes(code), `the extractor read code as copy: "${code}"`);
  }
});

test('public copy says "supplier" and "Event Hub" (B8 · B9)', () => {
  const hits = scan();
  const bad = hits.filter((h) => h.allowedBy === null);
  console.log(`[house-words] ${publicFiles().length} files · ${hits.length} hit(s) · ${hits.length - bad.length} allowed · ${bad.length} banned`);
  assert.deepEqual(
    bad.map((h) => `${h.where} — ${h.word}: "…${h.context}…"`),
    [],
    'Public copy uses a retired word. Reword it; allow it only with a phrase-exact entry in ALLOWED and the reason it is true.',
  );
});

test('every allowance still matches something — none has rotted into a blanket pass', () => {
  const used = new Set(scan().flatMap((h) => (h.allowedBy === null ? [] : [h.allowedBy])));
  const stale = ALLOWED.map((a, i) => ({ a, i })).filter(({ i }) => !used.has(i)).map(({ a }) => `${String(a.file)} · ${a.phrase}`);
  assert.deepEqual(stale, [], 'An allowance no longer matches any copy — delete it:\n  ' + stale.join('\n  '));
});
