/**
 * MB23 · THE DEFECT WAS A SELECT THAT DID NOT ASK.
 *
 * "In your colors" showed every attire figure at its artist-chosen colours for
 * months. The code said why: the figures were "on a no-CORS host, so they can't
 * be canvas-recolored". That comment was false — the R2 host echoes the origins
 * we run on, and all 75 live figures already carried tagged colour ranges.
 *
 * The real cause was one line of query shape. `page.tsx` selected
 * `asset_subtype, label, storage_path` and never `moodboard_asset_color_ranges`,
 * so `attireCards` had no `regions` to pass and `BoardCardView.recolorable` was
 * false for every attire card, forever, silently.
 *
 * 🪤 NOTHING WOULD HAVE CAUGHT THAT. No type error: `regions` is optional. No
 * test: the cards still rendered. No visual alarm: a drawing at stock colours
 * looks like a drawing. A missing column in a SELECT is invisible to everything
 * except someone looking at the screen and knowing what they should be seeing.
 * This file is the thing that would have caught it.
 *
 * Source-level by necessity — `page.tsx` is an async server component over a
 * Supabase client, so importing it here would drag in the whole request graph.
 * Every window below ends at a SYMBOL, never at "the next export", so a mention
 * in a neighbouring comment cannot satisfy an assertion (see
 * [[a-source-guards-window-must-end-at-the-brace]]).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { stripComments } from '@/lib/strip-comments';

const PAGE = new URL('./page.tsx', import.meta.url);
const source = readFileSync(PAGE, 'utf8');

/** The slice from `open` up to (not including) the next occurrence of `close`. */
function windowBetween(open: string, close: string): string {
  const start = source.indexOf(open);
  assert.notEqual(start, -1, `\`${open}\` is gone — this guard now watches nothing`);
  const end = source.indexOf(close, start + open.length);
  assert.notEqual(end, -1, `\`${close}\` no longer follows \`${open}\``);
  return source.slice(start, end);
}

test('the attire query asks for the colour ranges', () => {
  // Window: the attire select, ending at the venue/florals query that follows it.
  const attireQuery = windowBetween(
    ".eq('asset_type', 'figure_attire')",
    ".in('asset_type', ['venue_scene', 'florals'])",
  );
  // The select sits ABOVE the .eq, so widen backwards to the .from() that opens it.
  const fromIdx = source.lastIndexOf(
    ".from('moodboard_library_assets')",
    source.indexOf(".eq('asset_type', 'figure_attire')"),
  );
  const select = source.slice(fromIdx, source.indexOf(".eq('asset_type', 'figure_attire')"));

  assert.match(
    select,
    /moodboard_asset_color_ranges\s*\(\s*slot_id,\s*sampled_hex,\s*tolerance_de,\s*region_label\s*\)/,
    'The attire query has stopped selecting moodboard_asset_color_ranges. Every attire ' +
      'card in "In your colors" will silently render at the artist\'s colours instead of ' +
      "the couple's — which is exactly the bug MB23 fixed, and it is invisible to types, " +
      'to rendering tests, and to the eye of anyone who does not already know what the ' +
      'card should look like.',
  );
  assert.ok(attireQuery.length > 0);
});

test('attireCards passes those ranges through as regions', () => {
  // Window: the attireCards builder, ending at the next top-level const.
  const builder = windowBetween('const attireCards: BoardCard[]', '\n  const ceremonyCards');
  assert.match(
    builder,
    /regions:\s*figureBySubtype\[d\.subtype\]!\.regions/,
    'attireCards no longer passes `regions`. Selecting the colour ranges and then not ' +
      'handing them to the card is the same defect one step later: BoardCardView falls ' +
      'back to a plain reference drawing and nothing anywhere reports it.',
  );
});

test('the representative figure prefers a variant that can actually recolour', () => {
  // Window: the figureBySubtype loop, ending at the venue/florals block.
  const picker = windowBetween('const figureBySubtype: Record<', '// ── representative venue');
  assert.match(
    picker,
    /held\.regions\.length > 0/,
    'The representative-figure pick is back to "whatever row Postgres returned first". ' +
      'That decides, at random, whether a couple sees a recolourable figure or a fixed ' +
      'one — and for the bride it decides whether she sees modern-minimalist/bride, whose ' +
      'gown is the same colour as its own background (ΔE 0.0) and therefore carries no ' +
      'colour range at all. Restore the first-with-ranges-wins preference.',
  );
});

/**
 * The comment blocks of a file, with their offsets: each `/* … *\/` and each run
 * of consecutive `//` lines, as one block. A blank line ends a run.
 *
 * 🪤 THE WINDOW IS THE BLOCK, NOT A CHARACTER COUNT. The first version of the
 * guard below took ±600 characters around each hit — and a sabotage pass walked
 * straight through it: inserting a fresh, unrefuted "no-CORS host" claim above
 * the attire query left the test GREEN, because the window reached into the
 * NEIGHBOURING docblock and borrowed the word FALSE out of the correction. Same
 * failure as [[a-source-guards-window-must-end-at-the-brace]], one file over: a
 * window that does not end where the thing it describes ends will eventually
 * read someone else's prose and report it as yours.
 *
 * 🪤 AND THE BLOCKS COME FROM `stripComments`, NOT FROM A REGEX OF MY OWN. The
 * second version hand-rolled `/\/\*[\s\S]*?\*\//g` + a `//`-line scanner, and
 * `lint-one-comment-stripper.mjs` refused it — correctly. That regex treats the
 * `/*` inside a string like `accept="image/*"` as a comment opener and blanks
 * everything to the next real `*\/`; a guard whose subject lands in one of those
 * windows asserts against a blank and passes. `stripComments` is a lexer, and it
 * replaces comment characters with SPACES, so offsets stay true and the blocks
 * can be recovered by diffing it against the source.
 */
function commentBlocks(text: string): { text: string; index: number }[] {
  const stripped = stripComments(text);
  const inComment = (i: number) => text[i] !== stripped[i];
  const out: { text: string; index: number }[] = [];
  let start = -1;
  let lastHit = -1;
  const flush = () => {
    if (start === -1) return;
    out.push({ text: text.slice(start, lastHit + 1), index: start });
    start = -1;
  };
  for (let i = 0; i < text.length; i++) {
    if (!inComment(i)) continue;
    if (start !== -1) {
      // A gap of pure whitespace with at most one newline keeps the run going
      // (consecutive `//` lines); a blank line starts a new block.
      const gap = text.slice(lastHit + 1, i);
      if (!/^\s*$/.test(gap) || (gap.match(/\n/g)?.length ?? 0) > 1) flush();
    }
    if (start === -1) start = i;
    lastHit = i;
  }
  flush();
  return out;
}

test('the false "no-CORS host" claim may only appear where it is refuted', () => {
  const board = readFileSync(
    new URL('./_components/moodboard-board.tsx', import.meta.url),
    'utf8',
  );
  // 🪤 NOT "the phrase must not appear". Both files QUOTE the old claim on
  // purpose, so the next reader learns what was believed and why it was wrong —
  // a guard that banned the words outright would fire on the correction itself
  // and be deleted within a week. The rule is: every occurrence must sit in a
  // comment block that ALSO refutes it.
  const CLAIM = /can'?t be canvas-recolou?red|can ?not be canvas-recolou?red|no-CORS host/gi;
  const REFUTED = /\bFALSE\b|\bthey are not\b|⛔/i;

  for (const [name, text] of [
    ['page.tsx', source],
    ['moodboard-board.tsx', board],
  ] as const) {
    const blocks = commentBlocks(text);
    const hits = [...text.matchAll(CLAIM)];
    assert.ok(
      hits.length > 0,
      `${name} no longer mentions the old "no-CORS host" claim at all. Keep the ` +
        'correction: this belief survived for months precisely because nothing in the ' +
        'code contradicted it, and a session that has never heard of it will re-derive ' +
        'it from the same evidence.',
    );
    for (const hit of hits) {
      const block = blocks.find(
        (b) => hit.index! >= b.index && hit.index! < b.index + b.text.length,
      );
      assert.ok(
        block,
        `${name} carries the "no-CORS host" claim OUTSIDE any comment — as code or as a ` +
          `string, at character ${hit.index}. That is not a quotation being refuted.`,
      );
      assert.match(
        block!.text,
        REFUTED,
        `${name} states, at character ${hit.index}, that attire figures cannot be ` +
          'canvas-recoloured because of their host — in a comment block that does not ' +
          'refute it. That claim is FALSE, and it was the only evidence anyone had for ' +
          'leaving this broken for months. Measure before you write it:\n' +
          '  curl -sI -H "Origin: https://www.setnayan.com" \\\n' +
          '    https://pub-37d64fe618584c2981a88610a55dd439.r2.dev/moodboard-library/figure_attire/elegant-simple-classic/bride.svg\n' +
          '  → 200 · Access-Control-Allow-Origin: https://www.setnayan.com\n\n' +
          `The offending block:\n${block!.text.slice(0, 400)}`,
      );
    }
    assert.match(
      text,
      /curl -sI -H "Origin:/,
      `${name} should carry the one-line re-measurement, so the next reader can check ` +
        'the claim instead of trusting a comment.',
    );
  }
});

test('the canvas image asks for CORS — a clean host is useless if the tag never does', () => {
  const studio = readFileSync(new URL('./_components/recolor-studio.tsx', import.meta.url), 'utf8');
  assert.match(
    studio,
    /img\.crossOrigin = 'anonymous'/,
    'RecolorStudio loads the image for the canvas without crossOrigin="anonymous", so ' +
      'every getImageData throws a security error and every card degrades to an ' +
      'un-recoloured paint — with no console error the couple or we would ever see.',
  );
});

/**
 * MB24 · AND THE MODERN-MINIMALIST BRIDE IS PICKABLE AGAIN.
 *
 * The preference asserted above — first-variant-with-ranges wins — is what kept
 * "In your colors" honest while this asset had no range: MB23 deleted hers
 * because her gown and a full-canvas backdrop path shared one fill (ΔE 0.0), so
 * the picker quietly passed her over and showed a bride who could recolour.
 *
 * MB24 re-cut the artwork and gave her `#ECEBE7 ± 16` in migration
 * `20271206127987`, so she is a candidate again. That is a good outcome and a
 * fragile one: the preference is silent by design. Delete her range in some
 * later migration and nothing fails — the section simply stops offering the
 * modern-minimalist bride, and no one finds out by looking at a green build.
 *
 * 🪤 SO THE ASSERTION IS ON THE NET EFFECT OF THE MIGRATIONS, NOT ON MB24 ALONE.
 * Checking only that `20271206127987` inserts a range would stay green forever
 * after a later migration deleted it again — the migration would still say what
 * it always said. What decides whether she is pickable is the LAST migration to
 * touch her range, so that is what this reads.
 */
const MIGRATIONS_DIR = new URL('../../../../../../../supabase/migrations/', import.meta.url);
const BRIDE_SUFFIX = 'figure_attire/modern-minimalist/bride.svg';

test('MB24: the modern-minimalist bride still ends up WITH a colour range', () => {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // 14-digit prefixes sort chronologically

  // Every migration that changes her range, in order. `stripComments` keeps a
  // docblock that merely DISCUSSES the bride — this file is full of them — from
  // being read as a statement that acts on her.
  const touches: { file: string; effect: 'insert' | 'delete' }[] = [];
  for (const f of files) {
    const sql = stripComments(readFileSync(new URL(f, MIGRATIONS_DIR), 'utf8'));
    if (!sql.includes('moodboard_asset_color_ranges')) continue;
    if (!sql.includes(BRIDE_SUFFIX)) continue;
    // A DELETE naming her, versus an INSERT of a range for her.
    const deletes = /DELETE\s+FROM\s+public\.moodboard_asset_color_ranges/i.test(sql);
    const inserts = /INSERT\s+INTO\s+public\.moodboard_asset_color_ranges/i.test(sql);
    if (deletes && !inserts) touches.push({ file: f, effect: 'delete' });
    else if (inserts) touches.push({ file: f, effect: 'insert' });
  }

  assert.ok(
    touches.length > 0,
    'no migration mentions the modern-minimalist bride\'s colour range at all, so this ' +
      'guard is watching nothing. MB24 (20271206127987) should be inserting one.',
  );

  const last = touches[touches.length - 1]!;
  assert.equal(
    last.effect,
    'insert',
    `the last migration to touch the modern-minimalist bride's colour range is ${last.file}, ` +
      'and it DELETES it. She then has no range, `figureBySubtype` prefers a variant that ' +
      'does, and the modern-minimalist bride silently stops appearing in "In your colors" — ' +
      'with every test green, because the preference is a fallback and not an error.\n\n' +
      'If the range genuinely cannot survive (the artwork changed again), that is a real ' +
      'decision: re-measure, say so here, and record it in the untaggable list in ' +
      'tests/db/no-placeholder-photo-is-ever-live.db.test.ts — which MB24 emptied.\n\n' +
      `Migrations touching her range, in order: ${touches
        .map((t) => `${t.file} (${t.effect})`)
        .join(' → ')}`,
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * MB14b · TEN MORE LIVE VENUE SCENES MUST NOT TAKE THE CEREMONY CARD.
 *
 * `findVenue` is FIRST-MATCH over a query with NO `ORDER BY`
 * (`.in('asset_type', ['venue_scene','florals'])`), so which row wins is
 * whatever Postgres returns first. That was harmless while exactly one
 * `venue_scene` was ever live — MB25's Ceremony drawing. MB14b's migration
 * `20271207934361` publishes TEN more: the backdrop and ceiling decor layers,
 * which belong inside the reception room and are not a ceremony space at all.
 *
 * If any of them could satisfy `findVenue`, the Ceremony card would show a
 * couple a draped ceiling labelled "Ceremony" — and it would do so
 * intermittently, on row order, which is the worst way for a defect to arrive.
 * They cannot, because the predicate is exact equality on `church`/`ceremony`
 * and the ten carry `backdrop`/`ceiling`. That is a fact about two artefacts
 * that were written weeks apart by different sessions, so it is asserted, not
 * assumed — and asserted with the decor rows deliberately placed FIRST.
 * ════════════════════════════════════════════════════════════════════════════
 */

const DECOR_SEED = new URL(
  '20271194970382_moodboard_reception_decor_layers_pilot.sql',
  MIGRATIONS_DIR,
);

/** The subtypes `findVenue`'s predicate accepts, read out of page.tsx. */
function ceremonySubtypesFromPage(): string[] {
  const call = windowBetween('const findVenue =', 'const bouquetRow =');
  const out = [...call.matchAll(/s === '([a-z_]+)'/g)].map((m) => m[1]!);
  assert.ok(
    out.length > 0,
    'findVenue no longer compares `asset_subtype` to any literal. If it now matches every ' +
      'venue_scene, the ten MB14b decor layers can win the Ceremony card on row order.',
  );
  return out;
}

/** The subtypes MB14b publishes, read out of the pilot seed migration. */
function decorSubtypesFromSeed(): string[] {
  const sql = readFileSync(DECOR_SEED, 'utf8');
  const out = new Set<string>();
  for (const m of sql.matchAll(
    /'(https:\/\/media\.setnayan\.com\/moodboard-library\/venue_scene\/(backdrop|ceiling)\/[a-z0-9-]+\.svg)'/g,
  )) {
    out.add(m[2]!);
  }
  assert.equal(out.size, 2, 'expected the pilot to seed exactly the backdrop and ceiling zones');
  return [...out];
}

test('MB14b: the ten decor subtypes can never satisfy findVenue', () => {
  const ceremony = ceremonySubtypesFromPage();
  const decor = decorSubtypesFromSeed();
  for (const d of decor) {
    assert.ok(
      !ceremony.includes(d),
      `findVenue accepts asset_subtype "${d}", which is a MB14b decor zone, not a ceremony ` +
        'space. The Ceremony card would show a couple a reception backdrop or ceiling — ' +
        'intermittently, depending on which row Postgres returns first.',
    );
  }
  // And the predicate is EQUALITY, not a substring test: `s.includes('c')`
  // would pass the loop above by accident on this data and fail on the next
  // zone we add.
  const call = windowBetween('const findVenue =', 'const bouquetRow =');
  assert.doesNotMatch(
    call,
    /\.(includes|startsWith|endsWith|match|test)\s*\(/,
    'findVenue now matches a subtype by substring rather than by equality. Every zone name ' +
      'we ever add becomes a candidate for the Ceremony card.',
  );
});

test('MB14b: with all ten decor rows returned FIRST, findVenue still picks the church', () => {
  // The failure mode reproduced: no ORDER BY means the ten new live rows can
  // arrive ahead of the Ceremony drawing. This runs page.tsx's own predicate,
  // rebuilt from the literals parsed out of page.tsx, over exactly that order.
  const ceremony = new Set(ceremonySubtypesFromPage());
  const rows = [
    ...decorSubtypesFromSeed().flatMap((zone) =>
      ['elegant-simple-classic', 'bridgerton-regal', 'editorial-cream', 'tropical-heritage', 'modern-minimalist'].map(
        (slug) => ({
          asset_type: 'venue_scene',
          asset_subtype: zone,
          storage_path: `/moodboard-seed/venue_scene/${zone}/${slug}.svg`,
        }),
      ),
    ),
    {
      asset_type: 'venue_scene',
      asset_subtype: 'church',
      storage_path: '/moodboard-seed/venue_scene/church/ceremony-aisle.svg',
    },
    { asset_type: 'florals', asset_subtype: 'bridal_bouquet', storage_path: '/x.svg' },
  ];
  assert.equal(rows.filter((r) => r.asset_type === 'venue_scene').length, 11);

  const picked = rows.find(
    (r) => r.asset_type === 'venue_scene' && ceremony.has((r.asset_subtype || '').toLowerCase()),
  );
  assert.equal(
    picked?.storage_path,
    '/moodboard-seed/venue_scene/church/ceremony-aisle.svg',
    'the Ceremony card resolved to a decor layer instead of the church drawing. Ten decor ' +
      'rows come back ahead of it and findVenue takes the first match.',
  );
});
