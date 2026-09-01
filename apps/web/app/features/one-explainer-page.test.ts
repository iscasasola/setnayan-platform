/**
 * one-explainer-page.test.ts — the three-explainers-into-one merge (2026-09-01).
 *
 * `/why-setnayan`, `/how-it-works` and `/tl/how-it-works` folded into `/features`
 * and `/tl/features`. This pins the parts that fail SILENTLY:
 *
 *  - a retired URL that stops redirecting (a 404 nobody sees until a bookmark
 *    is pressed),
 *  - a Taglish reader sent to the English page,
 *  - a retired slug that stops being reserved and becomes claimable,
 *  - a sitemap that advertises a redirect,
 *  - the two locales drifting apart in a dictionary,
 *  - and the four FALSE CLAIMS this merge corrected creeping back in.
 *
 * Every assertion was mutation-checked: the rule was broken on purpose and the
 * test confirmed RED before being trusted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RESERVED_SLUGS } from '@/lib/reserved-slugs';
import { WHY_FAQ } from './_sections/_WhySetnayan';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..');
const WEB = resolve(APP, '..');

const NEXT_CONFIG = readFileSync(join(WEB, 'next.config.ts'), 'utf8');
const SITEMAP = readFileSync(join(APP, 'sitemap-static.xml', 'route.ts'), 'utf8');
const HOW = readFileSync(join(HERE, '_sections', '_HowItWorks.tsx'), 'utf8');
const WHY = readFileSync(join(HERE, '_sections', '_WhySetnayan.tsx'), 'utf8');
const BODY = readFileSync(join(HERE, '_PageBody.tsx'), 'utf8');
const NAV = readFileSync(join(HERE, '_sections', '_AnchorNav.tsx'), 'utf8');

/** Strip comments — a rule EXPLAINED in prose must never satisfy a check. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
}

const HOW_CODE = code(HOW);
const NEXT_CODE = code(NEXT_CONFIG);
const SITEMAP_CODE = code(SITEMAP);

// ─────────────────────────────────────────────────────────────────────────────
// 1 · The retired routes are gone, and still answer
// ─────────────────────────────────────────────────────────────────────────────

test('the three retired route folders are actually deleted', () => {
  for (const dir of ['how-it-works', 'why-setnayan', join('tl', 'how-it-works')]) {
    assert.ok(
      !existsSync(join(APP, dir, 'page.tsx')),
      `app/${dir}/page.tsx still exists — the merge did not retire it`,
    );
  }
});

test('every retired URL still resolves, permanently', () => {
  // MUTATION: delete any one redirect → this fails.
  // A retired page with no redirect is a 404 that nobody notices until an
  // indexed link or a bookmark is pressed.
  for (const source of ['/how-it-works', '/tl/how-it-works', '/why-setnayan']) {
    const re = new RegExp(
      `source:\\s*'${source.replace(/\//g, '\\/')}'[^}]*permanent:\\s*true`,
    );
    assert.match(
      NEXT_CODE,
      re,
      `${source} must 308 — a retired URL that stops redirecting loses its ranking and 404s`,
    );
  }
});

test('the TAGLISH twin lands on the TAGLISH page', () => {
  /*
    MUTATION: point /tl/how-it-works at '/features' → this fails.

    THE BUG THIS PREVENTS: sending a Taglish reader to the English page is a
    locale regression that reads as a bug, and it breaks the EN↔TL hreflang
    reciprocity the pair depends on. It is also the single easiest mistake to
    make here, because '/features' is the right answer for the other two.
  */
  assert.match(
    NEXT_CODE,
    /source:\s*'\/tl\/how-it-works',\s*destination:\s*'\/tl\/features'/,
    '/tl/how-it-works must go to /tl/features, never to the English /features',
  );
});

test('a retired slug stays reserved, so nobody can shadow the redirect', () => {
  /*
    MUTATION: remove either word from DB_MIRRORED_RESERVED_SLUGS → this fails.

    `lib/reserved-slugs.ts`'s route half is GENERATED FROM THE FOLDERS ON DISK,
    so deleting these routes removed them automatically. A shop that then minted
    setnayan.com/how-it-works would SHADOW the 308, and every indexed link to
    the old explainer would land on a stranger's shop. A shop address is
    immutable once minted — not recoverable.
  */
  for (const slug of ['how-it-works', 'why-setnayan']) {
    assert.ok(
      RESERVED_SLUGS.has(slug),
      `'${slug}' must stay reserved — its route is gone but the URL still resolves`,
    );
  }
});

test('the sitemap never advertises a redirect', () => {
  // MUTATION: re-add any retired path to the sitemap → this fails.
  // A sitemap listing a 308 asks crawlers to spend budget on a hop.
  for (const path of ['/how-it-works', '/tl/how-it-works', '/why-setnayan']) {
    assert.ok(
      !SITEMAP_CODE.includes(`'${path}'`),
      `the sitemap still lists ${path}, which is now a redirect`,
    );
  }
  // The destinations MUST still be listed, or the merge would have removed the
  // pages from the sitemap altogether.
  for (const path of ['/features', '/tl/features']) {
    assert.ok(SITEMAP_CODE.includes(`'${path}'`), `the sitemap must still list ${path}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 · The merged page actually renders both sections, in both locales
// ─────────────────────────────────────────────────────────────────────────────

test('the page body renders both folded-in sections', () => {
  const body = code(BODY);
  assert.match(body, /<WhySetnayan locale=\{locale\} \/>/);
  assert.match(body, /<HowItWorks locale=\{locale\} \/>/);
});

test('the anchor nav points at sections that exist', () => {
  // MUTATION: rename a section's `id` without the nav → this fails.
  // An anchor nav pill that scrolls nowhere is invisible until pressed.
  const ids = Array.from(code(NAV).matchAll(/\{ id: '([^']+)'/g)).map((m) => m[1]);
  assert.ok(ids.includes('why-setnayan'), 'nav must offer the Why section');
  assert.ok(ids.includes('how-it-works'), 'nav must offer the How section');
  assert.match(HOW_CODE, /id="how-it-works"/);
  assert.match(code(WHY), /id="why-setnayan"/);
});

test('the FAQ rich result is built from the copy the page actually shows', () => {
  /*
    MUTATION: hand-write a second FAQ array in _PageBody → this fails.
    A rich result quoting an answer the page no longer shows is worse than no
    rich result. One constant, rendered and emitted.
  */
  assert.match(code(BODY), /mainEntity:\s*WHY_FAQ\[locale\]/);
  assert.match(code(BODY), /'@type':\s*'FAQPage'/);
});

test('neither locale is missing content the other has', () => {
  // MUTATION: drop one item from either locale's array → this fails.
  // The whole point of the dictionary pattern is that the two cannot drift.
  assert.equal(
    WHY_FAQ.en.length,
    WHY_FAQ.tl.length,
    'the FAQ must answer the same questions in both locales',
  );
  assert.ok(WHY_FAQ.tl.length >= 5, 'the Taglish FAQ must not be a stub');
  for (const item of [...WHY_FAQ.en, ...WHY_FAQ.tl]) {
    assert.ok(item.q.trim().length > 0 && item.a.trim().length > 0);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 · The four false claims this merge corrected must not come back
// ─────────────────────────────────────────────────────────────────────────────

test('CORRECTION 1 — the event route is /[slug], and /e/ does not exist', () => {
  /*
    The retired pages printed `/e/[event-slug]` in BOTH languages. There is no
    `app/e/` directory; the guest-facing route is `app/[slug]`. A visitor could
    copy that URL and land on a 404.
  */
  assert.ok(!existsSync(join(APP, 'e')), 'app/e/ does not exist — do not advertise it');
  assert.ok(existsSync(join(APP, '[slug]')), 'app/[slug] is the real event route');
  assert.ok(
    !/\/e\/\[/.test(HOW_CODE),
    'the roles section must not advertise an /e/[...] route — it does not exist',
  );
});

test('CORRECTION 2 — an event can have several hosts', () => {
  // The retired copy said "One event, one owner today" while co-hosts shipped
  // (`lib/host-gate.ts` refuses with "only current hosts", plural).
  assert.ok(
    !/one owner/i.test(HOW_CODE),
    'co-hosts ship — the page must not claim one event has one owner',
  );
});

test('CORRECTION 3 — the platform is not wedding-only', () => {
  /*
    Seventeen celebration types are live (production, 2026-09-01:
    `select count(*) from event_type_profiles` → 17). PR #5029 already removed
    the wedding-only framing from the HOME page; these two pages still had it.

    Asserted on the HOST role's own description rather than on the whole file,
    because "wedding" legitimately appears as an EXAMPLE elsewhere — a
    file-wide ban would be wrong and would force a false fix.
  */
  const en = HOW_CODE.slice(HOW_CODE.indexOf("label: 'Host'"));
  const hostWho = en.slice(0, en.indexOf('where:'));
  assert.ok(
    /debut|christening|reunion|celebration/i.test(hostWho),
    "the Host role must name more than a wedding — 17 celebration types are live",
  );
});

test('CORRECTION 4 — hosts browse the marketplace at /explore, not /vendors', () => {
  /*
    `/vendors` is the SUPPLIER sales page ("Built to grow your business — free")
    and `/vendors/*` → `/explore` by owner directive 2026-06-14. The retired
    flow told hosts to browse `/vendors`.
  */
  assert.ok(
    HOW_CODE.includes('/explore'),
    'the flow must send a host to /explore — that is the marketplace',
  );
  assert.ok(
    !/browses\s*\/vendors|sa \/vendors/.test(HOW_CODE),
    '/vendors is the supplier sales page, not the marketplace a host browses',
  );
});
