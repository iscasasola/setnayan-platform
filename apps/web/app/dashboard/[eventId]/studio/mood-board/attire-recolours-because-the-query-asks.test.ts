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
import {
  CEREMONY_FALLBACK_SUBTYPES,
  pickCeremonyScene,
  pickFiguresByRole,
  rankFigure,
} from '@/lib/moodboard-board-picks';
import { CEREMONY_VENUE_SETTINGS } from '@/lib/venue-settings';

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
  //
  // MB28 moved the decision itself into `pickFiguresByRole`
  // (lib/moodboard-board-picks.ts) so this guard can RUN it instead of reading
  // it — but the page must still be the thing that calls it, or the decision is
  // correct in a module nobody uses.
  const picker = windowBetween('const figureBySubtype: Record<', '// ── representative venue');
  assert.match(
    picker,
    /pickFiguresByRole\(/,
    'page.tsx no longer delegates the representative-figure pick to ' +
      '`pickFiguresByRole`. If it has gone back to a local loop, the preference below is ' +
      'being asserted against a module the page does not use.',
  );
  assert.match(
    picker,
    /hasRange:\s*toRegions\([^)]*\)\.length > 0/,
    'the page stopped telling `pickFiguresByRole` which figures carry a colour range. ' +
      'With `hasRange` always false every figure ranks 0 and the pick collapses back to ' +
      '"whatever row Postgres returned first" — which for the bride decides whether she ' +
      'sees modern-minimalist/bride, whose gown was the same colour as its own background ' +
      '(ΔE 0.0) and therefore carried no colour range at all.',
  );

  // …and the preference itself, on the real function. A variant WITH a range
  // must win over an earlier variant without one.
  const picked = pickFiguresByRole(
    [
      { subtype: 'bride', styleTheme: 'modern minimalist', hasRange: false, id: 'no-range' },
      { subtype: 'bride', styleTheme: 'editorial cream', hasRange: true, id: 'has-range' },
    ],
    null,
  );
  assert.equal(
    picked.bride?.id,
    'has-range',
    'first-with-ranges-wins is gone: the couple gets a figure that cannot wear their ' +
      'colours while a variant that can sits unused in the same query result.',
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
 * MB28 · AND THE COUPLE'S OWN SETTING MUST TAKE IT INSTEAD.
 *
 * The ceremony pick is FIRST-MATCH over a query with NO `ORDER BY`
 * (`.in('asset_type', ['venue_scene','florals'])`), so which row wins is
 * whatever Postgres returns first. That was harmless while exactly one
 * `venue_scene` was ever live — MB25's Ceremony drawing. MB14b's migration
 * `20271207934361` publishes TEN more: the backdrop and ceiling decor layers,
 * which belong inside the reception room and are not a ceremony space at all.
 * MB28's `20271208519468` publishes EIGHT more that ARE ceremony spaces — one
 * per `events.ceremony_venue_setting` — so nineteen live `venue_scene` rows now
 * arrive in an arbitrary order and exactly one of them is this couple's.
 *
 * If a decor row could satisfy the pick, the Ceremony card would show a couple
 * a draped ceiling labelled "Ceremony" — intermittently, on row order, which is
 * the worst way for a defect to arrive. It cannot, because the match is exact
 * equality on a validated `ceremony_venue_setting` and the fallback is the
 * exact list `CEREMONY_FALLBACK_SUBTYPES`, while the ten carry
 * `backdrop`/`ceiling`. That is a fact about three artefacts written weeks
 * apart by different sessions, so it is asserted, not assumed — and asserted
 * with the decor rows deliberately placed FIRST.
 *
 * 🪤 MB28 MOVED THE DECISION INTO `lib/moodboard-board-picks.ts` SO THESE RUN
 * IT. These tests used to rebuild the predicate from literals parsed out of
 * page.tsx and assert against their own copy — which is how a guard ends up
 * guarding itself. They now import `pickCeremonyScene` and call it, and a
 * separate source-level test above holds page.tsx to actually using it.
 * ════════════════════════════════════════════════════════════════════════════
 */

const DECOR_SEED = new URL(
  '20271194970382_moodboard_reception_decor_layers_pilot.sql',
  MIGRATIONS_DIR,
);

/**
 * The nine ceremony subtypes that MUST have a live drawing, read out of the two
 * migrations that seed them — MB25's church and MB28's other eight. Never
 * retyped: a setting added to `events.ceremony_venue_setting` with no drawing
 * behind it is a silent fallback to the church, so the vocabulary and the seeds
 * are compared to each other rather than to a list in this file.
 */
const MB28_MIGRATION = new URL(
  '20271208519468_mb28_ceremony_settings_eight_venue_scenes.sql',
  MIGRATIONS_DIR,
);
const MB25_MIGRATION = new URL(
  '20271206413595_mb25_ceremony_church_aisle_drawing_app_served.sql',
  MIGRATIONS_DIR,
);

/** setting → the app-served path the migrations seed for it. */
function seededCeremonyScenes(): Map<string, string> {
  const out = new Map<string, string>();
  const mb25 = stripComments(readFileSync(MB25_MIGRATION, 'utf8'));
  const church = /'(\/moodboard-seed\/venue_scene\/(church)\/ceremony-aisle\.svg)'/.exec(mb25);
  assert.ok(church, 'migration 20271206413595 no longer seeds the church ceremony drawing');
  out.set(church[2]!, church[1]!);

  const mb28 = stripComments(readFileSync(MB28_MIGRATION, 'utf8'));
  // The asset INSERT's VALUES list: ('<setting>', '<Title>').
  const body = mb28.slice(
    mb28.indexOf("FROM (VALUES"),
    mb28.indexOf(') AS v(setting, title)'),
  );
  for (const m of body.matchAll(/\('([a-z_]+)',\s*'[^']+'\)/g)) {
    out.set(m[1]!, `/moodboard-seed/venue_scene/${m[1]}/ceremony-aisle.svg`);
  }
  return out;
}

const CEREMONY_SCENES = seededCeremonyScenes();

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

/** The ten MB14b decor rows, in the shape the page's query returns them. */
function decorRows() {
  return decorSubtypesFromSeed().flatMap((zone) =>
    [
      'elegant-simple-classic',
      'bridgerton-regal',
      'editorial-cream',
      'tropical-heritage',
      'modern-minimalist',
    ].map((slug) => ({
      asset_type: 'venue_scene',
      asset_subtype: zone,
      storage_path: `/moodboard-seed/venue_scene/${zone}/${slug}.svg`,
    })),
  );
}

/** Every live row the page's `.in('asset_type', ['venue_scene','florals'])` can
 *  return, with the ten decor rows deliberately FIRST — the query has no
 *  ORDER BY, so this is a real arrival order, not a contrived one. */
function allLiveRows(omit: readonly string[] = []) {
  return [
    ...decorRows(),
    ...[...CEREMONY_SCENES].
      filter(([setting]) => !omit.includes(setting)).
      map(([setting, path]) => ({
        asset_type: 'venue_scene',
        asset_subtype: setting,
        storage_path: path,
      })),
    { asset_type: 'florals', asset_subtype: 'bridal_bouquet', storage_path: '/x.svg' },
  ];
}

test('MB28: the page delegates the ceremony pick, and never re-implements it', () => {
  const call = windowBetween('── MB28 · THE CEREMONY CARD KNOWS', 'const bouquetRow =');
  assert.match(
    call,
    /pickCeremonyScene\(/,
    'page.tsx no longer calls `pickCeremonyScene`. Every assertion below runs that ' +
      'function, so a page that decides for itself is a page nothing here covers.',
  );
  assert.doesNotMatch(
    stripComments(call),
    /\.(includes|startsWith|endsWith|match|test)\s*\(/,
    'the ceremony pick in page.tsx now matches a subtype by substring rather than by ' +
      'equality. Every zone name we ever add becomes a candidate for the Ceremony card.',
  );
});

test('MB28: every ceremony_venue_setting the DB accepts has a drawing seeded for it', () => {
  // The vocabulary is `CEREMONY_VENUE_SETTINGS` (lib/venue-settings.ts), which
  // `two-venues-ceremony-and-reception.db.test.ts` already pins to the column's
  // own CHECK. A setting with no seeded drawing is not an error anywhere — the
  // couple simply gets the church, silently, forever.
  for (const setting of CEREMONY_VENUE_SETTINGS) {
    assert.ok(
      CEREMONY_SCENES.has(setting),
      `no migration seeds a venue_scene for ceremony setting "${setting}". A couple who ` +
        'chooses it sees the church aisle on their Ceremony card and nothing reports it.',
    );
  }
  assert.equal(
    CEREMONY_SCENES.size,
    CEREMONY_VENUE_SETTINGS.length,
    `the migrations seed ${CEREMONY_SCENES.size} ceremony drawings for ` +
      `${CEREMONY_VENUE_SETTINGS.length} settings: ${[...CEREMONY_SCENES.keys()].join(', ')}. ` +
      'A seeded subtype that is not a ceremony setting can never be selected by equality.',
  );
});

test('MB28: an event with a setting gets THAT drawing, on all nine', () => {
  // The decor rows arrive first every time, exactly as they can in production.
  for (const [setting, path] of CEREMONY_SCENES) {
    const picked = pickCeremonyScene(allLiveRows(), setting);
    assert.equal(
      picked?.storage_path,
      path,
      `a couple marrying at "${setting}" resolved to ${picked?.storage_path ?? 'NOTHING'} ` +
        `instead of their own drawing (${path}). This is the defect MB28 exists to fix: ` +
        'before it, all nine settings were shown the church.',
    );
  }
});

test('MB28: a null setting still gets the church — byte-identically to before', () => {
  // All five live events carry a null `ceremony_venue_setting` today, so this
  // IS the production path. `undefined` covers the column being absent from the
  // select, and the empty string covers the "un-decided" write the details
  // editor performs (it stores NULL, but a stale row may still hold '').
  for (const setting of [null, undefined, ''] as const) {
    const picked = pickCeremonyScene(allLiveRows(), setting);
    assert.equal(
      picked?.storage_path,
      CEREMONY_SCENES.get('church'),
      `with ceremony_venue_setting = ${JSON.stringify(setting)} the Ceremony card resolved ` +
        `to ${picked?.storage_path ?? 'NOTHING'}. Every existing event has no setting, so ` +
        'this is not an edge case — it is what every couple on the platform sees today.',
    );
  }
  // A setting this app no longer knows is the same case, NOT a free pass to
  // whatever row happens to equal it.
  for (const bogus of ['backdrop', 'ceiling', 'BEACH', 'cathedral', 'venue_scene']) {
    const picked = pickCeremonyScene(allLiveRows(), bogus);
    assert.equal(
      picked?.storage_path,
      CEREMONY_SCENES.get('church'),
      `an unrecognised ceremony_venue_setting "${bogus}" resolved to ` +
        `${picked?.storage_path ?? 'NOTHING'} rather than falling back to the church. ` +
        'The setting is compared to a live subtype, so an unvalidated value is a way to ' +
        'select a row that is not a ceremony at all.',
    );
  }
});

test('MB28: a subtype that merely CONTAINS the setting is never the ceremony', () => {
  // 🪤 THE SABOTAGE THAT SURVIVED THE FIRST DRAFT OF THIS FILE. MB14b caught
  // substring matching with a source assertion over page.tsx's own predicate;
  // MB28 moved that predicate into `pickCeremonyScene`, and the source check
  // went on scanning a call site that no longer contains it. Swapping `===` for
  // `.includes()` in the lib then left all seventeen tests GREEN — because none
  // of the nineteen subtypes live today contains another as a substring, so the
  // fixtures could not tell the two predicates apart.
  //
  // The claim was never about today's data. It is "every zone name we ever add
  // becomes a candidate for the Ceremony card", so the fixture has to contain
  // the zone we might add. `garden_backdrop` is not invented for convenience —
  // MB14b's zones are named `backdrop` and `ceiling`, and per-setting variants
  // are the obvious next ones — and it is placed FIRST, where the page's
  // ORDER BY-less query can genuinely put it.
  for (const setting of CEREMONY_SCENES.keys()) {
    const decoy = {
      asset_type: 'venue_scene',
      asset_subtype: `${setting}_backdrop`,
      storage_path: `/moodboard-seed/venue_scene/${setting}_backdrop/x.svg`,
    };
    const picked = pickCeremonyScene([decoy, ...allLiveRows()], setting);
    assert.equal(
      picked?.storage_path,
      CEREMONY_SCENES.get(setting),
      `a live venue_scene subtyped "${setting}_backdrop" took the Ceremony card from the ` +
        `real "${setting}" drawing. The match is a substring test, not equality, so every ` +
        'decor zone we ever name after a ceremony setting becomes a candidate — and which ' +
        'one wins is row order.',
    );
    // …and it must not be reachable through the fallback either.
    const pickedNull = pickCeremonyScene([decoy, ...allLiveRows()], null);
    assert.equal(
      pickedNull?.storage_path,
      CEREMONY_SCENES.get('church'),
      `with no setting chosen, "${setting}_backdrop" was selected as the ceremony. The ` +
        'fallback is matching by substring rather than against CEREMONY_FALLBACK_SUBTYPES.',
    );
  }
});

test('MB28: a setting whose row is retired falls back to the CHURCH, not to a backdrop', () => {
  // The row is gone from the query result (retired_at set, or the seed rolled
  // back). The couple must land on the church — never on MB14b's ceiling.
  for (const setting of CEREMONY_SCENES.keys()) {
    if (setting === 'church') continue;
    const picked = pickCeremonyScene(allLiveRows([setting]), setting);
    assert.equal(
      picked?.storage_path,
      CEREMONY_SCENES.get('church'),
      `with the "${setting}" drawing retired, the Ceremony card resolved to ` +
        `${picked?.storage_path ?? 'NOTHING'}. Ten decor rows arrive ahead of the church ` +
        'in this fixture, so a fallback of "the first live venue_scene" lands on a ' +
        'reception ceiling labelled "Ceremony".',
    );
  }
  // And with the CHURCH itself gone there is no ceremony scene at all — the
  // card is ABSENT, which is what `if (ceremonyRow)` in page.tsx renders. It must
  // never degrade to a decor layer.
  const noCeremony = pickCeremonyScene(allLiveRows([...CEREMONY_SCENES.keys()]), 'beach');
  assert.equal(
    noCeremony,
    undefined,
    `with every ceremony drawing retired, the pick returned ${JSON.stringify(noCeremony)} ` +
      'instead of nothing. The ten decor rows are still live and still venue_scene; the ' +
      'correct end state is no Ceremony card, exactly as MB23 left it.',
  );
});

test('MB14b: the ten decor subtypes can never satisfy the ceremony pick', () => {
  const decor = decorSubtypesFromSeed();
  for (const d of decor) {
    assert.ok(
      !CEREMONY_FALLBACK_SUBTYPES.includes(d),
      `the ceremony fallback accepts asset_subtype "${d}", which is a MB14b decor zone, ` +
        'not a ceremony space. The Ceremony card would show a couple a reception backdrop ' +
        'or ceiling — intermittently, depending on which row Postgres returns first.',
    );
    assert.ok(
      !CEREMONY_SCENES.has(d),
      `a migration seeds a ceremony drawing under subtype "${d}", which is a MB14b decor ` +
        'zone. The two vocabularies have collided and the Ceremony card can now select a ' +
        'reception decor layer by equality.',
    );
  }
});

test('MB14b: with all ten decor rows returned FIRST, the ceremony pick still picks the church', () => {
  // The failure mode reproduced, now through the REAL function rather than a
  // predicate rebuilt in this file: no ORDER BY means the ten live decor rows
  // can arrive ahead of every ceremony drawing.
  const rows = allLiveRows();
  assert.equal(rows.filter((r) => r.asset_type === 'venue_scene').length, 19);
  assert.equal(
    pickCeremonyScene(rows, null)?.storage_path,
    CEREMONY_SCENES.get('church'),
    'the Ceremony card resolved to a decor layer instead of the church drawing. Ten decor ' +
      'rows come back ahead of it and the pick takes the first match.',
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * MB28 · AND THE ATTIRE ROW KNOWS THE COUPLE'S STYLE.
 *
 * `moodboard_library_assets.style_theme` carries one of five families on all 75
 * live attire figures — one figure per (role, family) — and until MB28 which of
 * the five a couple saw was decided by row order among those that carried a
 * colour range. A `bridgerton · regal` couple got whichever bride came back
 * first.
 *
 * 🪤 THE TRAP IS PREFERRING THE FAMILY TOO HARD. Family-before-range re-opens
 * MB23: `modern-minimalist/bride` drew her gown in the same colour as her own
 * background (ΔE 0.0), her range was deleted for it, and the picker's job was
 * to pass her over. A picker that takes the family first picks her back up —
 * only for couples who chose that family, and only as "this card stopped
 * recolouring", which no type and no rendering test can see.
 * ════════════════════════════════════════════════════════════════════════════
 */

/** The five families, one figure per role — the shape of the 75 live rows. */
const FAMILIES = [
  'elegant · simple · classic',
  'bridgerton · regal',
  'editorial cream',
  'tropical heritage',
  'modern minimalist',
] as const;
const ROLES = ['bride', 'groom', 'ninang', 'ninong'] as const;

function liveFigures(noRange: readonly string[] = []) {
  return FAMILIES.flatMap((family) =>
    ROLES.map((role) => ({
      subtype: role,
      styleTheme: family,
      hasRange: !noRange.includes(`${family}/${role}`),
      id: `${family}/${role}`,
    })),
  );
}

test('MB28: a bridgerton · regal couple gets the bridgerton figures, in every role', () => {
  const picked = pickFiguresByRole(liveFigures(), 'bridgerton · regal');
  for (const role of ROLES) {
    assert.equal(
      picked[role]?.id,
      `bridgerton · regal/${role}`,
      `a couple whose board is 'bridgerton · regal' sees ${picked[role]?.id ?? 'NOTHING'} ` +
        `for the ${role}. They chose a style family and the card ignored it.`,
    );
  }
});

test("MB28: a couple with no family gets exactly today's pick", () => {
  // The regression that matters most: every couple who has never applied a
  // template has a null family, and their board must not move at all.
  const rows = liveFigures();
  for (const family of [null, undefined, '', 'a family this app never shipped'] as const) {
    const picked = pickFiguresByRole(rows, family);
    for (const role of ROLES) {
      assert.equal(
        picked[role]?.id,
        `${FAMILIES[0]}/${role}`,
        `with style family ${JSON.stringify(family)} the ${role} resolved to ` +
          `${picked[role]?.id ?? 'NOTHING'} instead of the first row with a range. A couple ` +
          'who never applied a template must see byte-identically what they saw before MB28.',
      );
    }
  }
});

test('MB28: a family whose figure lost its range falls through to one that has a range', () => {
  // The MB23 bride case, per family. Her range was DELETED because no tolerance
  // could isolate her gown from her own background; the pick must pass her over
  // even for the couples who chose her family, rather than showing them a card
  // that silently stops recolouring.
  const picked = pickFiguresByRole(
    liveFigures(['modern minimalist/bride']),
    'modern minimalist',
  );
  assert.equal(
    picked.bride?.id,
    `${FAMILIES[0]}/bride`,
    `a 'modern minimalist' couple whose own bride carries no colour range resolved to ` +
      `${picked.bride?.id ?? 'NOTHING'}. If that is the modern-minimalist bride, the family ` +
      'is being preferred over the ability to recolour and the Bride card shows the ' +
      "artist's colours while every other card shows the couple's.",
  );
  // …and every OTHER role in that family is untouched by one missing range.
  for (const role of ROLES) {
    if (role === 'bride') continue;
    assert.equal(
      picked[role]?.id,
      `modern minimalist/${role}`,
      `one untagged figure knocked the whole family out of the ${role} card as well.`,
    );
  }
});

test('MB28: the rank puts a range above a family, and both above nothing', () => {
  // The ordering stated as itself, so a future edit that swaps the top two
  // fails HERE — with the reason — rather than as a puzzling row-order change
  // three tests up.
  assert.ok(
    rankFigure({ hasRange: true, onFamily: true }) >
      rankFigure({ hasRange: true, onFamily: false }),
    'a figure in the couple’s own family no longer outranks an off-family one, so the ' +
      'family is being ignored.',
  );
  assert.ok(
    rankFigure({ hasRange: true, onFamily: false }) >
      rankFigure({ hasRange: false, onFamily: true }),
    'a figure with NO colour range now outranks one that has a range, because it is in the ' +
      "couple's family. That is MB23's bride disease coming back by another door: the card " +
      'renders at the artist’s colours and nothing reports it.',
  );
});
