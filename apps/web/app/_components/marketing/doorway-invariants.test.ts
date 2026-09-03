/**
 * doorway-invariants.test.ts — the three things a public doorway must never lose.
 *
 * ─── WHY THIS EXISTS, AND WHY IT EXISTS *FIRST* ──────────────────────────
 * The public doorway pages are near-identical by construction — `/pa3d`
 * and `/pawebsite` render byte-identical JSX, differing only in copy strings.
 * The design port collapses them into a shared section kit, which is the right
 * move and also the dangerous one, because all three invariants below are
 * currently held by **hand-typed values at each call site**:
 *
 *   1 · THE h1. `LineRevealHeading` defaults to `as = 'h2'`
 *       (`_pa-motion.tsx:41-44`). Seven of the eight routes get their ONLY h1
 *       from a prop passed at the call site. Move the hero into a kit and a
 *       variant that forgets that prop ships a page with **no h1 at all** —
 *       and NOTHING in this repo would say a word: not the masthead lint, not
 *       Lighthouse (which does not audit these routes and has no h1 audit in
 *       any category), not any existing test.
 *
 *   2 · THE CANONICAL. Every route hand-types its own. Porting two
 *       byte-identical pages together is the precise condition under which a
 *       copy-pasted `canonical: '/pa3d'` lands on `/pawebsite`. Both pages
 *       still render perfectly. One silently leaves the search index.
 *
 *   3 · THE STRUCTURED DATA. Each doorway ships SoftwareApplication + FAQPage
 *       JSON-LD. A restructure that drops the block costs rich results on a
 *       page whose entire job is to be found, and the loss is invisible on
 *       screen.
 *
 * All three fail SILENTLY and none is covered elsewhere. So this lands BEFORE
 * the extraction, not after — a safety net built after the fall is decoration.
 *
 * ⚠ THIS TEST IS NOT THE DESIGN. It pins what must survive a port, and says
 * nothing about layout, spacing or type. It should keep passing unchanged
 * while the pages are rebuilt around it. If a port needs this file edited to
 * go green, that is the signal to stop and look, not to edit it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..', '..'); // apps/web/app
/*
  🔑 THE SHELLED PUBLIC ROUTES LIVE IN A ROUTE GROUP. `app/(shell)/` mounts the
  shared shell once, in a layout, so it survives navigation. A route group is
  INVISIBLE in the URL and PRESENT in the filesystem path — `/explore` still
  serves from `app/(shell)/explore/page.tsx` — and that asymmetry is exactly
  what broke seventeen guards on 2026-08-15. Resolve route directories through
  this constant, never by joining APP directly.
*/
const SHELLED = join(APP, '(shell)');


/**
 * The shared doorway kit. A ported route holds no hero markup of its own — it
 * mounts this once and passes copy. So the invariants MOVED with the h1, and
 * this file is now where two of the three are enforced for every ported page.
 * Checking the kit is strictly stronger than checking eight call sites.
 */
const KIT_PATH = join(HERE, '_doorway.tsx');
const KIT = existsSync(KIT_PATH) ? code(readFileSync(KIT_PATH, 'utf8')) : '';
/** Does this route render the shared kit, and exactly once? */
function kitMounts(route: string): number {
  return sourcesFor(route).reduce(
    (n, raw) => n + (code(raw).match(/<DoorwayPage[\s/>]/g) ?? []).length,
    0,
  );
}

/**
 * The public doorways. `/` is deliberately absent — it is the ELN cinematic
 * reskin, owner-approved 2026-06-29 and explicitly excluded from this work.
 * `/features` is absent too: it is a different design language with a
 * bilingual twin at `/tl/features`, and it is its own job.
 */
const DOORWAYS = [
  'papic',
  'panood',
  'pawebsite',
  'pa3d',
  'palogo',
  'alaala',
  'patiktok',
  'setnayan-ai',
  // The song — public page added 2026-08-21 so it could join the Studio rail.
  'pakanta',
  // The mood board — public page added 2026-09-03 for the same reason, and it
  // is the first doorway on this list for a FREE tool (owner: *"i do not see
  // it"*, of the Studio group). The three invariants below do not care: an h1,
  // a canonical and structured data are owed by any page whose job is to be
  // found, priced or not.
  'mood-board',
] as const;

/** Every source file a doorway's markup can live in: its page, plus any
 *  private motion/companion module in the same folder. `/papic` and
 *  `/setnayan-ai` both keep their hero in a sibling file, and a shared kit
 *  will put every doorway in that shape — so read the folder, not one file. */
function sourcesFor(route: string): string[] {
  const dir = join(SHELLED, route);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
    .map((f) => readFileSync(join(dir, f), 'utf8'));
}

/** Strip comments — a docblock that says "the real <h1>" is not an h1. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * An h1 arrives one of two ways, and a port converts the first into the second:
 * a literal `<h1`, or `as="h1"` passed to a polymorphic heading component.
 *
 * ⚠ THE SUBTLETY THAT MADE THE FIRST DRAFT OF THIS TEST WRONG. A polymorphic
 * heading component CONTAINS `<h1>` in its own body — that is the tag it
 * renders when a caller asks for one. Counting it accuses `/papic` of having
 * two h1s when it has one: a `<h1>` in `_papic-motion.tsx` (the implementation)
 * and one `as="h1"` in `page.tsx` (the actual decision).
 *
 * So: a file that DECLARES a polymorphic `as` prop is a heading component, and
 * its literal `<h1>` is machinery, not a title. Only its call sites count.
 *
 * ⚠ THE EXAMPLES ABOVE ARE NOW HISTORY, AND THE RULE IS NOT. All eight routes
 * take their h1 from the kit as of design#6, so no doorway folder still holds a
 * hero of its own: `/papic`'s private motion fork is reduced to its tile-settle
 * and `/setnayan-ai`'s — which used to be the counter-example here, a fixed
 * `<h1>` taking no `as` — is deleted outright. The polymorphic-heading rule
 * stays because `countH1` still applies it to any file a future page adds, and
 * because deleting a rule the moment its last instance disappears is how the
 * instance comes back.
 */
function isPolymorphicHeading(src: string): boolean {
  return /as = '|as\?:/.test(src);
}

function countH1(route: string): number {
  const own = sourcesFor(route).reduce((n, raw) => {
    const src = code(raw);
    // A call site is always a decision, wherever it lives.
    let count = (src.match(/as=["']h1["']/g) ?? []).length;
    // A literal <h1> counts only in a file that is not a heading component.
    if (!isPolymorphicHeading(src)) count += (src.match(/<h1[\s>]/g) ?? []).length;
    return n + count;
  }, 0);
  // A ported route holds no hero of its own; the kit supplies exactly one h1,
  // and the test below pins that. One mount ⇒ one title.
  return own + kitMounts(route);
}

test('every doorway has EXACTLY ONE h1', () => {
  const wrong: string[] = [];
  for (const route of DOORWAYS) {
    const n = countH1(route);
    if (n !== 1) wrong.push(`/${route}: ${n}`);
  }
  assert.deepEqual(
    wrong,
    [],
    `A public doorway must have exactly one h1 — it is the page's title to a ` +
      `search engine and to a screen reader.\n  ${wrong.join('\n  ')}\n\n` +
      `ZERO is the likely failure and the dangerous one: LineRevealHeading ` +
      `defaults to as='h2', so an extracted hero that forgets to pass as="h1" ` +
      `renders a page with no title at all — and nothing else in this repo ` +
      `checks. TWO means a section heading was promoted by mistake.`,
  );
});

test('every doorway declares ITS OWN canonical URL', () => {
  // The copy-paste trap: /pa3d and /pawebsite are byte-identical JSX, so a
  // canonical carried across during a port renders perfectly and quietly
  // de-indexes one of them.
  const wrong: string[] = [];
  for (const route of DOORWAYS) {
    const page = join(SHELLED, route, 'page.tsx');
    if (!existsSync(page)) {
      wrong.push(`/${route}: no page.tsx`);
      continue;
    }
    const src = code(readFileSync(page, 'utf8'));
    const found = [...src.matchAll(/canonical:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
    if (found.length === 0) wrong.push(`/${route}: declares no canonical`);
    else if (found.length > 1) wrong.push(`/${route}: declares ${found.length} canonicals`);
    else if (found[0] !== `/${route}`) wrong.push(`/${route}: points at "${found[0]}"`);
  }
  assert.deepEqual(
    wrong,
    [],
    `A doorway's canonical must be its own path:\n  ${wrong.join('\n  ')}\n\n` +
      `A canonical pointing at a sibling tells search engines this page is a ` +
      `duplicate of that one. The page still renders; it just stops being found.`,
  );
});

test('every doorway keeps its SoftwareApplication + FAQPage structured data', () => {
  // The whole job of these pages is to be found. Losing the JSON-LD costs rich
  // results and is completely invisible on screen.
  const wrong: string[] = [];
  for (const route of DOORWAYS) {
    const joined = sourcesFor(route).map(code).join('\n');
    for (const type of ['SoftwareApplication', 'FAQPage']) {
      if (!new RegExp(`['"]@type['"]\\s*:\\s*['"]${type}['"]`).test(joined)) {
        wrong.push(`/${route}: lost ${type}`);
      }
    }
    // A ported route hands its blocks to the kit, which renders them. Either
    // the route emits the script tag itself, or it mounts the kit — which the
    // test below proves emits one.
    if (!/application\/ld\+json/.test(joined) && kitMounts(route) === 0) {
      wrong.push(`/${route}: renders no JSON-LD at all`);
    }
  }
  assert.deepEqual(
    wrong,
    [],
    `Structured data was dropped from a page whose entire purpose is to be ` +
      `found:\n  ${wrong.join('\n  ')}`,
  );
});

test('the excluded routes stay excluded', () => {
  // `/` is the ELN cinematic reskin (owner-approved 2026-06-29) and `/features`
  // is a separate design language with a bilingual twin. Neither belongs to
  // this port, and adding either to DOORWAYS above would quietly widen the
  // work — so the exclusion is asserted rather than remembered.
  assert.ok(!(DOORWAYS as readonly string[]).includes(''), '/ must not be ported here');
  assert.ok(
    !(DOORWAYS as readonly string[]).includes('features'),
    '/features is its own job — a different design language with a /tl twin',
  );
});

test('the scan is not vacuous — it really read ten pages', () => {
  // Every assertion above passes trivially if `sourcesFor` returns nothing:
  // a renamed folder or a moved app root would make this file green while
  // checking absolutely nothing.
  assert.equal(DOORWAYS.length, 10);
  for (const route of DOORWAYS) {
    const srcs = sourcesFor(route);
    assert.ok(srcs.length > 0, `/${route}: no source files found — the app root is wrong`);
    assert.ok(
      srcs.join('').length > 2000,
      `/${route}: read only ${srcs.join('').length} chars — that is not a real page`,
    );
  }
});

test('THE SHARED KIT is where the ported pages get their h1 — exactly one, not a prop', () => {
  // This is the whole reason the extraction is safe. Eight chances to forget
  // `as="h1"` collapse into one place that cannot forget, and this pins it.
  assert.ok(KIT.length > 0, 'the doorway kit is missing — the ported pages have no hero');
  const h1s = (KIT.match(/as=["']h1["']/g) ?? []).length + (KIT.match(/<h1[\s>]/g) ?? []).length;
  assert.equal(
    h1s,
    1,
    `The shared doorway kit must render exactly one h1 — found ${h1s}. Every ` +
      `ported page inherits this, so a change here is a change to eight pages at once.`,
  );
  // And it must not be overridable: a caller that can pass `as` can pass 'h2',
  // which is the exact defect the extraction exists to remove.
  assert.ok(
    !/\bas\??:/.test(KIT.slice(KIT.indexOf('export type DoorwayProps'), KIT.indexOf('const MUTED'))),
    'DoorwayProps exposes an `as` prop — the h1 must not be a caller decision',
  );
});

test('THE SHARED KIT renders the structured data it is handed', () => {
  assert.match(
    KIT,
    /application\/ld\+json/,
    'the kit dropped the JSON-LD script tag — every ported doorway loses its rich results at once',
  );
  assert.match(KIT, /structuredData\.map/, 'the kit must render EVERY block it is given, not the first');
});

test('a ported route mounts the kit exactly once', () => {
  // Twice would mean two heroes and two h1s; the count above would catch it,
  // but this names the cause instead of the symptom.
  const wrong: string[] = [];
  for (const route of DOORWAYS) {
    const n = kitMounts(route);
    if (n > 1) wrong.push(`/${route}: mounts the kit ${n} times`);
  }
  assert.deepEqual(wrong, [], wrong.join('\n'));
});

test('/panood keeps its YouTube API Services disclosure', () => {
  // ⚠ THIS GUARD EXISTS BECAUSE THE PORT DROPPED IT. Moving /panood onto the
  // shared kit silently deleted this paragraph from the render; the page still
  // built, still typechecked, and every other test stayed green. A manual diff
  // caught it.
  //
  // It is not decorative copy. `20260629`'s "never name YouTube" rule was
  // REVERSED for exactly this paragraph so an OAuth reviewer can find it, and
  // Live Studio's Google access depends on that review. Losing it is a
  // compliance regression that looks like a tidier page.
  const src = sourcesFor('panood').map(code).join('\n');
  assert.match(src, /YouTube API Services/, 'the disclosure paragraph is gone from /panood');
  assert.match(src, /href="\/privacy"/, 'the disclosure no longer links the privacy policy');
});
