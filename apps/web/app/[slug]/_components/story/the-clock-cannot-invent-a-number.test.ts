/**
 * the-clock-cannot-invent-a-number.test.ts — the story spine's source guards.
 *
 * The arithmetic is guarded in `lib/story-spine.test.ts`. What is guarded HERE
 * is the set of rules that have no return value to assert on — the ones a
 * future edit breaks silently, where the only symptom is an absence:
 *
 *   1. the dial's labels are HTML, never SVG text in a stretched viewBox;
 *   2. the needle moves by transform, never by rewriting geometry per frame;
 *   3. every number on the cover reaches the page through the layer gate;
 *   4. the client half has no path to a capture count of its own;
 *   5. the dial is reachable and operable by keyboard;
 *   6. every control clears 44px;
 *   7. the pure module reads Manila time and never the runtime's clock;
 *   8. a written minute never loses the instant that places it.
 *
 * ⚠ COMMENTS ARE STRIPPED FIRST. A rule EXPLAINED in prose must never satisfy a
 * check about the code — and this file uses the repo's ONE stripper
 * (`lib/strip-comments.ts`), never a hand-rolled regex, because a hand-rolled
 * one both fails the required CI check and silently blanks real code.
 *
 * Every assertion was SABOTAGE-CHECKED: the thing it protects was broken on
 * purpose, the occurrence count printed before and after, and the test
 * confirmed RED before the rule was trusted. Counts are in the PR body.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..', '..');

const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

const CLOCK = read(join(HERE, 'story-clock.tsx'));
const SPINE = read(join(HERE, 'story-spine.tsx'));
const SPINE_DATA = read(join(HERE, 'spine-data.ts'));
const PURE = read(join(WEB, 'lib', 'story-spine.ts'));
const EDITORIAL_DATA = read(join(HERE, '..', 'editorial', 'data.ts'));

// ── 1 · the labels ──────────────────────────────────────────────────────────

test('THE DIAL DRAWS NO SVG TEXT — labels are HTML, positioned in percent', () => {
  /*
    🔴 THE DEFECT. The bars live in `viewBox="0 0 1000 58"` with
    `preserveAspectRatio="none"`, so the axis is stretched non-uniformly to the
    element's width. Anything inside it is stretched with it: on a 390px phone
    that squashed every label to about 35% of its width — unreadable, and
    invisible to a desktop reviewer, because at 1000px wide it looks perfect.

    The claim is not "we prefer HTML labels". It is that no text is drawn inside
    the stretched space at all. So: search for the elements that would put it
    there, and require the count to be zero.
  */
  const svgTextTags = CLOCK.match(/<\s*(text|tspan|textPath)[\s/>]/g) ?? [];
  assert.equal(
    svgTextTags.length,
    0,
    `story-clock.tsx draws text inside the stretched viewBox: ${svgTextTags.join(', ')}`,
  );
  // And the HTML layer really is positioned in percent of the same axis.
  assert.match(CLOCK, /percentOf\(/, 'the label layer must share the bars’ axis');
});

// ── 2 · the needle ──────────────────────────────────────────────────────────

test('the needle moves by TRANSFORM, not by rewriting SVG geometry', () => {
  // Rewriting x1/x2 on every scroll frame invalidates the geometry and forces a
  // synchronous layout; a transform is composited and leaves the DOM alone.
  assert.match(CLOCK, /style\.transform\s*=\s*`translateX/);
  const geometryWrites = CLOCK.match(/setAttribute\(\s*['"](x1|x2|y1|y2|x|y|width|height)['"]/g) ?? [];
  assert.equal(
    geometryWrites.length,
    0,
    `the dial writes SVG geometry imperatively: ${geometryWrites.join(', ')}`,
  );
});

// ── 3 · the cover's numbers ─────────────────────────────────────────────────

/**
 * The two facts on the cover that are the HOST'S OWN and are therefore NOT
 * routed through the guests'-layer gate, each with the reason it is not.
 *
 * 🔑 A LIST WITH REASONS, NOT AN EXEMPTION LIST. Adding a row here is a claim
 * that the number describes something the host did, not something the guests
 * made — and it has to be true, because the whole point of the gate is that
 * "492 captures · 26 phones" describes the guests' day to somebody who was not
 * asked.
 */
const HOST_LAYER_COVER_FACTS: Record<string, string> = {
  'facts.broadcasts.length':
    'how many times the host went on air. A stranger who watched the stream already knows it happened.',
  daysTold:
    'the span from the day the date was set to the last day of the celebration — dates the host chose.',
};

test('EVERY NUMBER ON THE COVER GOES THROUGH THE LAYER GATE, or is named here', () => {
  // Derive the cover's own facts from the source rather than listing them: a
  // fifth fact added next year is caught, and a hand-written list would not be.
  const block = SPINE.match(/const coverFacts[^=]*=\s*\[([\s\S]*?)\n\s*\];/);
  assert.ok(block, 'could not find the cover facts — has the cover been renamed?');
  const values = [...block[1]!.matchAll(/\{\s*n:\s*([^,]+),/g)].map((m) => m[1]!.trim());
  assert.ok(values.length >= 4, `expected the four facts, found ${values.length}`);

  for (const v of values) {
    if (v.startsWith('countForLayer(')) continue;
    assert.ok(
      Object.prototype.hasOwnProperty.call(HOST_LAYER_COVER_FACTS, v),
      `the cover fact \`${v}\` is neither gated by countForLayer() nor named in ` +
        'HOST_LAYER_COVER_FACTS with the reason it belongs to the host’s own layer.',
    );
  }
});

test('the dial’s bar heights come from drawnBins and from nothing else', () => {
  assert.match(SPINE, /drawnBins\(/, 'the spine must route the bins through the gate');
  // The raw aggregate must never reach a component. `facts.bins` may be read
  // exactly once — on the line that hands it to `drawnBins`.
  const rawReads = SPINE.match(/facts\.bins/g) ?? [];
  assert.equal(
    rawReads.length,
    1,
    `facts.bins (the ungated ceiling) is read ${rawReads.length} times; it may only be handed to drawnBins()`,
  );
});

// ── 4 · the client half ─────────────────────────────────────────────────────

/**
 * What the dial's client component may import.
 *
 * 🔑 IT CANNOT COMPUTE A COUNT, AND THAT IS THE GUARANTEE. Every height and
 * every number it draws was decided on the server, behind `drawnBins`. If it
 * could reach the loader, a well-meaning "just fetch the real number for the
 * sheet" would walk straight past the gate — and it would look like an
 * improvement in the diff.
 */
const CLIENT_IMPORTS_ALLOWED = [
  /^react$/,
  // The pure axis module — geometry and clock arithmetic, no I/O of any kind.
  /^@\/lib\/story-spine$/,
  // The shared modal focus hook. It touches the DOM and nothing else: no
  // fetch, no client, no route. Using it is the OPPOSITE of a leak — a
  // hand-rolled copy of its job is what `modal-a11y-adoption.test.ts` caught
  // in this file's first cut.
  /^@\/lib\/use-modal-a11y$/,
  // The reader-position postbox. Module-level `Set` of callbacks and nothing
  // else — no fetch, no client, no route, and the test below PROVES it rather
  // than trusting this comment: it asserts the module imports nothing at all.
  //
  // 🔑 IT IS HERE BECAUSE THE ALTERNATIVE WAS WORSE. The light and the lens
  // need exactly what the needle needs — which entry the reader has reached and
  // how far through it. Neither can live inside this component, so without a
  // postbox they would each open a SECOND scroll loop over the same rects: two
  // answers to one question, and two layouts per frame on a 16,000px page.
  // This file's own header says it — the needle, the readout and the entry
  // being read are one fact, and splitting them is how they end up disagreeing.
  /^@\/lib\/story-reader-position$/,
];

test('THE DIAL’S CLIENT HALF HAS NO PATH TO A COUNT', () => {
  const imports = [...CLOCK.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
  assert.ok(imports.length > 0, 'no imports found — has the file moved?');
  for (const spec of imports) {
    assert.ok(
      CLIENT_IMPORTS_ALLOWED.some((rx) => rx.test(spec)),
      `story-clock.tsx imports \`${spec}\`. The client half may only reach React and the ` +
        'pure axis module — anything that can read the database can walk past drawnBins().',
    );
  }
  assert.match(CLOCK, /^'use client';/, 'it is the client half');
});

test('the reader-position postbox is as inert as the allowlist claims', () => {
  /*
    An allowlist entry is a hole unless the thing it lets through is checked. If
    `story-reader-position.ts` ever grows an import, it grows a way for the
    client half to reach whatever that import can reach — and the guard above
    would still be green, because the SPEC is allowed.

    So the exemption verifies itself: the postbox imports nothing.
  */
  const src = stripComments(
    readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../../lib/story-reader-position.ts'), 'utf8'),
  );
  const imports = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
  assert.deepEqual(
    imports,
    [],
    `story-reader-position.ts imports ${imports.join(', ')}. It is on story-clock's allowlist ` +
      'BECAUSE it reaches nothing; an import here re-opens the path the allowlist exists to close.',
  );
  assert.ok(!/fetch\(|createClient|supabase/i.test(src), 'the postbox must not reach a client');
});

// ── 5 · the keyboard ────────────────────────────────────────────────────────

test('the dial is focusable, and the arrows walk it', () => {
  assert.match(CLOCK, /tabIndex=\{0\}/, 'the dial must be reachable by keyboard');
  for (const key of ['ArrowRight', 'ArrowLeft', 'Enter']) {
    assert.match(CLOCK, new RegExp(`'${key}'`), `the dial does not answer ${key}`);
  }
  assert.match(CLOCK, /role="application"/);
  assert.match(CLOCK, /aria-label=/);
  // The sheet is a real dialog and gives focus back where it came from.
  // The sheet is a real dialog, and its focus trap, Escape key and focus
  // RESTORE are the shipped hook's — not a second hand-rolled copy of them.
  // Asserting the hook is called with the ref that carries `role="dialog"` is
  // the whole claim: everything else follows from the hook, which has its own
  // guard (`lib/modal-a11y-adoption.test.ts`).
  assert.match(CLOCK, /role="dialog"/);
  assert.match(CLOCK, /aria-modal="true"/);
  assert.match(CLOCK, /useModalA11y\(\{/, 'the sheet must use the shared focus hook');
  assert.match(CLOCK, /containerRef: sheetRef/);
  assert.match(CLOCK, /ref=\{sheetRef\}/, 'the ref must be on the element carrying role="dialog"');
});

// ── 6 · 44px ────────────────────────────────────────────────────────────────

test('every control on the spine clears 44px', () => {
  // Derive the controls from the source rather than counting them by hand —
  // a control added next year is caught, a hand-written list would not be.
  for (const [name, src] of [
    ['story-clock.tsx', CLOCK],
    ['story-spine.tsx', SPINE],
  ] as const) {
    const controls = [...src.matchAll(/<(button|a)\s([^>]*?)>/g)];
    for (const c of controls) {
      const attrs = c[2]!;
      // A <button> with no className at all is a bare control and still has to
      // clear the floor, so the check is on the element, not on whether it
      // happens to have been styled.
      assert.ok(
        /min-h-\[44px\]/.test(attrs),
        `${name}: a <${c[1]}> control does not carry min-h-[44px] — ${attrs.slice(0, 90)}`,
      );
    }
  }
});

// ── 7 · Manila ──────────────────────────────────────────────────────────────

test('the spine reads MANILA time, never the runtime’s clock', () => {
  /*
    🔴 `new Date(iso).getHours()` is correct on the owner's laptop in Manila and
    eight hours wrong on Vercel — and CI, which runs in UTC, agrees with neither.
    The whole module works on epoch values with the offset applied, so any of
    these appearing is the bug arriving back.
  */
  const banned = PURE.match(/\.(getHours|getMinutes|getDate|getDay|getMonth|getFullYear)\(/g) ?? [];
  assert.equal(
    banned.length,
    0,
    `lib/story-spine.ts reads the runtime's local clock: ${banned.join(', ')}`,
  );
  // The offset itself is imported, never typed out a second time.
  assert.match(PURE, /import \{ PAPIC_TZ_OFFSET \}/);
  const literals = PURE.match(/\+08:00/g) ?? [];
  assert.equal(
    literals.length,
    0,
    `lib/story-spine.ts hard-codes the Manila offset ${literals.length} time(s) instead of importing it`,
  );
});

/*
  🔴 A THRESHOLD IS NOT A GUARD, AND THIS FILE CAUGHT ITSELF WITH ONE. The first
  cut asserted "at least three arms flatten the dial"; a sabotage that DELETED
  one of the four left three, and the check went green over a real regression.
  What follows tests the claim instead: every arm reached BECAUSE SOMETHING
  FAILED must answer with no bars or flat bars.
*/

/** The only two answers a FAILED arm may give: no bars, or flat bars. */
const FAIL_CLOSED_RETURNS = new Set([
  'return [];',
  'return bins.map((b) => ({ at: b.at, captures: 0 }));',
]);

test('EVERY FAILURE ARM IN THE DIAL FLATTENS IT — none of them returns the raw count', () => {
  const fn = SPINE_DATA.slice(
    SPINE_DATA.indexOf('async function loadDialBins'),
    SPINE_DATA.indexOf('export function minutesForDay'),
  );
  assert.ok(fn.length > 200, 'could not find loadDialBins — has it been renamed?');

  // Derive the arms, do not list them: a `catch`, a rejected query, or an
  // unresolved veto. A rejected query is an ABSENCE, not a thrown error, so
  // `if (error)` is as much a failure arm as `catch` is.
  const failArms = [
    ...fn.matchAll(/if \(error\)\s*(return [^\n]*?;)/g),
    ...fn.matchAll(/veto\.failed\)\s*(return [^\n]*?;)/g),
    ...fn.matchAll(/catch \{\s*(?:\/\/[^\n]*\n\s*)*(return [^\n]*?;)/g),
  ].map((m) => m[1]!);
  assert.ok(failArms.length >= 5, `expected every failure arm, found ${failArms.length}`);

  for (const arm of failArms) {
    assert.ok(
      FAIL_CLOSED_RETURNS.has(arm),
      `a failure arm in loadDialBins answers with \`${arm}\`. It must return no bars ` +
        'or flat bars — handing back the raw aggregate publishes the height of a ' +
        'capture somebody withdrew from.',
    );
  }

  // And nothing else in the function may invent a third shape of answer.
  const allReturns = new Set([...fn.matchAll(/(return [^\n]*?;)/g)].map((m) => m[1]!));
  const known = new Set([
    ...FAIL_CLOSED_RETURNS,
    'return bins;', // nothing to subtract: no bars yet, or nobody opted out
    'return subtractWithheldFromBins(bins, withheld, bucketMinutes);', // the real path
  ]);
  const unexpected = [...allReturns].filter((r) => !known.has(r));
  assert.deepEqual(
    unexpected,
    [],
    `loadDialBins gained a return this guard has never reasoned about: ${unexpected.join(' | ')}`,
  );
});

/**
 * Every read of the capture table in `spine-data.ts` must be bounded, and this
 * says which bound each one is allowed to have.
 *
 * 🔴 THE READ THAT STARVED (03 §3). An unbounded `captured_at` read fills every
 * row with the prenup shoot and the day itself renders nothing. Asserting that
 * the file merely MENTIONS the window is not a guard — the first cut of this
 * test did exactly that, and a sabotage that deleted a lower bound left three
 * other mentions standing and went green.
 */
/**
 * The function body a given offset sits inside.
 *
 * ⚠ THE WHOLE POINT IS THAT IT IS NOT THE WHOLE FILE. "spine-data.ts mentions
 * the day window" is the proxy this repo has already been burned by twice — a
 * sabotage deleted ONE query's lower bound and the guard stayed green because
 * three other mentions still stood. A bound must be proved for the query that
 * needs it, in the function that builds it.
 */
function enclosingFunction(src: string, at: number): string {
  const starts = [...src.matchAll(/\n(?:async )?function \w+/g)].map((m) => m.index!);
  let start = 0;
  let end = src.length;
  for (const s of starts) {
    if (s <= at) start = s;
    else {
      end = s;
      break;
    }
  }
  return src.slice(start, end);
}

test('EVERY CAPTURE READ IS BOUNDED — checked per query, not per file', () => {
  const hits = [...SPINE_DATA.matchAll(/\.from\('papic_photos'\)/g)];
  assert.ok(hits.length >= 2, `expected the capture reads, found ${hits.length}`);
  hits.forEach((hit, i) => {
    const from = hit.index! + hit[0].length;
    const rest = SPINE_DATA.slice(from);
    const q = rest.slice(0, rest.indexOf(';'));
    if (!/captured_at/.test(q)) return; // not a time read at all

    const beforeTheDay = /\.lt\('captured_at', window\.startIso\)/.test(q);
    const insideTheDays =
      /\.gte\('captured_at', window\.startIso\)/.test(q) &&
      /\.lt\('captured_at', window\.endIso\)/.test(q);

    /*
      THE THIRD LEGITIMATE SHAPE (S10, the lens's heat): a read bounded to a net
      around each WRITTEN MINUTE rather than to the whole day — which is a
      TIGHTER bound, not a looser one, since every net is clipped to the day
      window before the clause is built.

      It is only accepted when that clipping is provable IN THE SAME FUNCTION:
      the ISO bounds parsed, and both ends of every window compared against
      them. An `.or(` on its own proves nothing — any `.or` would pass, and
      that is precisely the decoration this file exists to refuse.
    */
    const fn = enclosingFunction(SPINE_DATA, hit.index!);
    const boundedToWrittenMinutes =
      /\.or\(/.test(q) &&
      /Date\.parse\(args\.window\.startIso\)/.test(fn) &&
      /Date\.parse\(args\.window\.endIso\)/.test(fn) &&
      /w\.to >= winFrom/.test(fn) &&
      /w\.from <= winTo/.test(fn);

    assert.ok(
      beforeTheDay || insideTheDays || boundedToWrittenMinutes,
      `capture read #${i + 1} in spine-data.ts is not bounded to the event's own days ` +
        `(nor deliberately to the road before them, nor to the written minutes inside them): ` +
        `${q.replace(/\s+/g, ' ').slice(0, 160)}`,
    );
  });
});

// ── 8 · the minute keeps its instant ────────────────────────────────────────

test('A WRITTEN MINUTE NEVER LOSES THE INSTANT THAT PLACES IT', () => {
  /*
    Without `atIso` a chapter cannot be put on a day, on a bar, in a gap or in a
    broadcast — and the loss is silent: the chapter still renders, in a list, in
    the order it happened, looking entirely correct.

    So: every chapter the loader builds must carry it. Derived from the real
    construction sites (`time:` is the field that has always been there), not
    from a list of line numbers.
  */
  // Object LITERALS only — a `time:` line ending in a comma. A `time:` ending
  // in a semicolon is the type declaration, which is guarded by the compiler.
  const chapterLiterals = [...EDITORIAL_DATA.matchAll(/\n\s*time: ([^\n]+),\n/g)];
  assert.ok(chapterLiterals.length >= 3, `expected the chapter build sites, found ${chapterLiterals.length}`);
  for (const m of chapterLiterals) {
    const after = EDITORIAL_DATA.slice(m.index! + m[0]!.length, m.index! + m[0]!.length + 200);
    // `ChapterCard` (the Story Maker's own row) legitimately has no atIso — it
    // is identified by its `thumbUrl`, which no DayChapter has.
    if (/thumbUrl:/.test(after)) continue;
    assert.match(
      after,
      /atIso:/,
      `a day chapter is built without atIso near \`time: ${m[1]!.slice(0, 40)}\``,
    );
  }
});
