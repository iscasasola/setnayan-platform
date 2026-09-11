/**
 * A WITHDRAWAL REACHES EVERY COPY — the guard.
 *
 * Two halves, because the claim has two halves.
 *
 *   1. **The list is right.** The surfaces a guest can appear on are enumerated
 *      once and this asserts exactly which — including that the share card is
 *      versioned rather than "revalidated", which would have been a call that
 *      looked like a fix and did nothing.
 *   2. **Every writer uses it.** Derived from the source, never from a
 *      hand-written list of files. 🔑 A HAND-WRITTEN FILE LIST IS NOT
 *      "EVERYWHERE" — it is a snapshot of the day somebody wrote it, and the
 *      next consent write is added by a person who has not read this file. So
 *      the population is FOUND: every top-level function in `app/` whose body
 *      mutates a consent fact. Adding a new one and not calling the helper fails
 *      here, with the function named.
 *
 * ⚠ THE INDIRECTION IS RESOLVED RATHER THAN ASSUMED. `takeMyPhotoOffTheWall`
 * reaches the helper through two hops of same-file functions, and a guard that
 * demanded the literal call in every body would have forced the call to be
 * duplicated — which is the drift this whole module exists to end. The closure
 * below follows same-file calls, so "it reaches the helper" is what is checked,
 * not "it types the helper's name".
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import {
  storySurfacesFor,
  ogCardUrlFor,
  recapCardUrlFor,
  ogCardVersionToken,
  printedStampLine,
  PRINTED_STAMP_LEAD,
} from './a-withdrawal-reaches-every-copy';

const WEB = join(__dirname, '..');
const HELPER = 'everyCopyIsNowStale';

/* ─── 1 · the list ────────────────────────────────────────────────────────── */

test('the list names every cached public surface a guest appears on', () => {
  const surfaces = storySurfacesFor('movie-night');
  assert.deepEqual(surfaces, ['/movie-night', '/movie-night/recap', '/movie-night/print']);
});

test('the canonical account URL joins the list the day the cutover is flipped', () => {
  // The bare form is what production serves today (verified by the live page's
  // own canonical link), so the nested path is absent unless it is asked for.
  const off = storySurfacesFor('movie-night', 'ice');
  assert.ok(!off.some((p) => p.startsWith('/u/')), `nested path leaked while the flag is off: ${off.join(', ')}`);

  const previous = process.env.NEXT_PUBLIC_U_NESTING_CUTOVER;
  process.env.NEXT_PUBLIC_U_NESTING_CUTOVER = 'true';
  try {
    const on = storySurfacesFor('movie-night', 'ice');
    assert.ok(
      on.includes('/u/ice/movie-night'),
      `the canonical surface is missing once the cutover is on: ${on.join(', ')}`,
    );
    // The bare root still resolves for a printed QR, so it stays in the list.
    assert.ok(on.includes('/movie-night'));
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_U_NESTING_CUTOVER;
    else process.env.NEXT_PUBLIC_U_NESTING_CUTOVER = previous;
  }
});

test('an empty slug produces no surfaces at all', () => {
  assert.deepEqual(storySurfacesFor('   '), []);
});

/* ─── 2 · the share card's address moves ──────────────────────────────────── */

test('a new version gives the share card an address nobody has cached', () => {
  const site = 'https://www.setnayan.com';
  const before = ogCardUrlFor(site, 'movie-night', '2026-09-09T10:00:00.000Z');
  const after = ogCardUrlFor(site, 'movie-night', '2026-09-09T10:00:01.000Z');
  assert.notEqual(before, after, 'the card URL did not move, so an hour-long cache keeps the old one');
  assert.ok(before.startsWith(`${site}/api/og/realstory-slug/movie-night?v=`));
});

test('no version degrades to the unversioned address rather than inventing one', () => {
  const site = 'https://www.setnayan.com';
  assert.equal(
    ogCardUrlFor(site, 'movie-night', null),
    `${site}/api/og/realstory-slug/movie-night`,
  );
  assert.equal(ogCardVersionToken('not a date'), null);
  assert.equal(ogCardVersionToken(null), null);
});

test('BOTH share cards move — the story’s and the recap’s', () => {
  /*
    🔑 `04` §3 says "the OG card" and there are TWO. The recap's card renders a
    hero that comes through `loadEditorialData`, so it can be a guest's
    photograph, and it carries the same hour-long Cache-Control. A fix applied
    to one of them is not a fix.
  */
  const site = 'https://www.setnayan.com';
  const v = '2026-09-09T10:00:05.214Z';
  assert.ok(ogCardUrlFor(site, 'movie-night', v).includes('?v='));
  assert.ok(recapCardUrlFor(site, 'movie-night', v).includes('?v='));
  assert.notEqual(
    recapCardUrlFor(site, 'movie-night', v),
    recapCardUrlFor(site, 'movie-night', '2026-09-09T10:00:06.214Z'),
  );
  assert.equal(
    recapCardUrlFor(site, 'movie-night', null),
    `${site}/api/og/recap/movie-night`,
  );
});

test('the 9:16 recap asset stays a URL once the card is versioned', () => {
  /*
    🔴 THE OBVIOUS WRITING OF THIS BREAKS THE FILE-ASSET. The recap page builds
    its story-sized card as `${shareImage}?format=story`; a versioned base
    already carries a query, so a second `?` yields `…?v=123?format=story`,
    which is not a URL — the 9:16 asset would have silently come back as the
    1200×630 unfurl card, and nobody would have seen an error.
  */
  const site = 'https://www.setnayan.com';
  for (const version of ['2026-09-09T10:00:05.214Z', null]) {
    const base = recapCardUrlFor(site, 'movie-night', version);
    const asset = `${base}${base.includes('?') ? '&' : '?'}format=story`;
    const parsed = new URL(asset);
    assert.equal(parsed.searchParams.get('format'), 'story', `format lost in: ${asset}`);
    assert.ok(!asset.includes('?v=') || parsed.searchParams.get('v'), `version lost in: ${asset}`);
    assert.equal((asset.match(/\?/g) ?? []).length, 1, `two question marks in: ${asset}`);
  }
});

/* ─── 3 · what a printed copy says ────────────────────────────────────────── */

test('an unstamped story prints no date, never today’s', () => {
  assert.equal(printedStampLine(null, 'Asia/Manila'), null);
  assert.equal(printedStampLine('not a date', 'Asia/Manila'), null);
});

test('the stamp is read in the celebration’s own zone, not the server’s', () => {
  // 2026-09-09T18:32Z is the 10th in Manila and still the 9th in New York. A
  // keepsake stamped in the deploy region's day would be wrong on the artefact
  // a person keeps.
  const manila = printedStampLine('2026-09-09T18:32:00.000Z', 'Asia/Manila');
  const newYork = printedStampLine('2026-09-09T18:32:00.000Z', 'America/New_York');
  assert.ok(manila?.startsWith(PRINTED_STAMP_LEAD));
  assert.ok(manila?.includes('September 10, 2026'), `Manila stamp read: ${manila}`);
  assert.ok(newYork?.includes('September 9, 2026'), `New York stamp read: ${newYork}`);
  assert.notEqual(manila, newYork);
});

test('an unknown zone falls back to Manila instead of throwing away the stamp', () => {
  const line = printedStampLine('2026-09-09T18:32:00.000Z', 'Not/AZone');
  assert.ok(line?.includes('September 10, 2026'), `fallback stamp read: ${line}`);
});

/* ─── 4 · every writer reaches the helper ─────────────────────────────────── */

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(p);
  }
  return out;
}

/**
 * A top-level function, its name and its body, brace-matched.
 *
 * Deliberately crude and deliberately NOT a regex over the whole file: the
 * question is "does THIS function both write a consent fact and reach the
 * helper", and a file-level answer is exactly the cheaper proxy that would pass
 * a file where one function does each.
 */
type Fn = { name: string; body: string };

function topLevelFunctions(src: string): Fn[] {
  const out: Fn[] = [];
  const re = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*[(<]/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const start = src.indexOf('{', m.index);
    if (start < 0) continue;
    let depth = 0;
    let end = start;
    for (let i = start; i < src.length; i += 1) {
      const ch = src[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const name = m[1];
    if (name) out.push({ name, body: src.slice(start, end + 1) });
  }
  return out;
}


/**
 * Does a `.from('<table>')` chain in this body carry `pattern`?
 *
 * 🔴 THE FIRST CUT OF THIS GUARD ASKED THE THREE QUESTIONS OF THE WHOLE
 * FUNCTION BODY AND ACCUSED CORRECT CODE. `markResponse` in the sponsors action
 * INSERTS a guest with `photo_consent: true` and, forty lines later, UPDATES
 * `event_sponsors` — three tokens present, no consent mutation anywhere, and the
 * guard called it an offender. A cheaper proxy does not just miss things; it
 * accuses. So the window is the CHAIN: everything from `.from('<table>')` up to
 * the next `.from(` or the end of the statement, which is the span a Supabase
 * builder call actually occupies.
 */
function chainedTo(body: string, table: string, ...patterns: RegExp[]): boolean {
  const from = new RegExp(`\\.from\\(\\s*['"]${table}['"]\\s*\\)`, 'g');
  let m: RegExpExecArray | null;
  while ((m = from.exec(body))) {
    const rest = body.slice(m.index + m[0].length);
    const nextFrom = rest.search(/\.from\(/);
    const chain = nextFrom === -1 ? rest : rest.slice(0, nextFrom);
    if (patterns.every((p) => p.test(chain))) return true;
  }
  return false;
}

/**
 * The mutations that change what a public story may show of a person.
 *
 * Each entry is a real write, named, with the reason it counts. Creation is
 * NOT here and that is the one deliberate exclusion: `photo_consent: true`
 * inside an `.insert(` is a guest being added to a roster, and a guest who has
 * just been created appears in no photograph, no wish and no story — there is
 * nothing cached about them to throw away.
 */
const CONSENT_WRITES: Array<{ what: string; hits: (body: string) => boolean }> = [
  {
    what: "a guest's photo consent, blur switch or face-matching exclusion",
    /*
      🔴 AND THE SECOND CUT ACCUSED CORRECT CODE TOO, ONE STEP FURTHER IN.
      Asking "is there an update on guests" and "is a consent field mentioned on
      guests" as two questions let `submitRsvp` satisfy them with two DIFFERENT
      chains: it INSERTS a plus-one carrying `photo_consent: true` and then
      UPDATES `plus_one_name` on the primary guest. Neither is a consent
      mutation. Both patterns must hold in the SAME chain, which is the only
      version of the question that means what it says.
    */
    hits: (b) =>
      chainedTo(
        b,
        'guests',
        /\.update\(/,
        /(photo_consent|faceblock_enabled|face_recognition_excluded)/,
      ),
  },
  {
    what: 'a photo tag — the join the story’s consent veto is built from',
    hits: (b) => chainedTo(b, 'photo_tags', /\.(update|delete)\(/),
  },
  {
    what: 'an RA 10173 opt-out from a celebration’s story',
    hits: (b) => chainedTo(b, 'person_story_items', /removed_reason/),
  },
  /*
    The naming opt-in (`04` §2, DPO-ruled 2026-09-09: a photo message carries a
    name only if the guest asked). Added when S11 landed `askToBeUnnamed` on the
    story itself — it already reached the list through `revalidateEventSlug`,
    but the guard could not see that it had to, and a rule the guard cannot see
    is one the next writer is free to miss. The role rides the same consent as
    the name, so both tables count.
  */
  /*
    A capture taken down or put back (step 8 of the Story, 2026-09-11). Every
    reader of the story, the recap and both prints filters `hidden_at`, so a hide
    is the plainest consent write there is — and the host's hide of a SEAT photo
    (the story's only source) and the moderator's hide of a reported one both
    reached none of the cached copies. `hideReportedPhoto` is the lib helper the
    moderator's action writes through; naming it keeps that write visible here.
    `\bhidden_at` does not match `wall_hidden_at` (the wall's own switch).
  */
  {
    what: 'a capture taken down or put back',
    hits: (b) =>
      chainedTo(b, 'papic_photos', /\.update\(/, /\bhidden_at\b/) ||
      chainedTo(b, 'papic_guest_captures', /\.update\(/, /\bhidden_at\b/) ||
      /\bhideReportedPhoto\s*\(/.test(b),
  },
  {
    what: 'a guest’s name coming off their own words',
    hits: (b) =>
      chainedTo(b, 'photo_messages', /\.update\(/, /author_named_publicly/) ||
      chainedTo(b, 'guest_columns', /\.update\(/, /author_named_publicly/),
  },
];

test('every consent write in app/ reaches the one list', () => {
  const files = walk(join(WEB, 'app'));
  const offenders: string[] = [];
  let population = 0;

  for (const file of files) {
    const src = stripComments(readFileSync(file, 'utf8'));
    if (!CONSENT_WRITES.some((w) => w.hits(src))) continue;

    const fns = topLevelFunctions(src);
    const byName = new Map(fns.map((f) => [f.name, f.body]));

    /** Does this body reach the helper, following same-file calls? */
    const reaches = (body: string, seen = new Set<string>()): boolean => {
      if (body.includes(`${HELPER}(`)) return true;
      for (const [name, other] of byName) {
        if (seen.has(name)) continue;
        if (!new RegExp(`\\b${name}\\s*\\(`).test(body)) continue;
        seen.add(name);
        if (reaches(other, seen)) return true;
      }
      return false;
    };

    for (const fn of fns) {
      const write = CONSENT_WRITES.find((w) => w.hits(fn.body));
      if (!write) continue;
      population += 1;
      if (!reaches(fn.body)) {
        offenders.push(
          `${file.replace(`${WEB}/`, '')} · ${fn.name}() writes ${write.what} ` +
            `and never reaches ${HELPER}() — the story, the recap, the keepsake ` +
            'and the share card keep serving the old answer.',
        );
      }
    }
  }

  /*
    ⚠ A ZERO POPULATION IS A BROKEN GUARD, NOT A CLEAN REPO. If the scan finds
    nothing to check it passes vacuously, and that is how a source guard dies
    silently — a moved directory, a renamed table, a stripper that blanked the
    file. The floor is asserted so the guard has to keep FINDING the writes it
    claims to be watching.
  */
  assert.ok(
    population >= 6,
    `the scan found only ${population} consent writes — it has stopped seeing them.`,
  );
  assert.equal(offenders.length, 0, `\n${offenders.join('\n')}\n`);
});

test('exactly one place reads the story version, and it cannot take a page down', () => {
  /*
    🔴 THE DEFECT THIS PINS WAS MINE, AND IT WAS NOT THE STAMP THAT WAS AT RISK.
    The three surfaces each read `story_version_at` inline, under a comment I
    wrote saying "a rejected read is an ABSENCE, not a throw." That is true of a
    REFUSED query and silent about every other way an await fails — and one of
    those reads sits inside `generateMetadata`, where a throw fails the WHOLE
    PAGE. **A version stamp could have taken down a couple's wedding page.**

    Two halves, because the claim has two:
      1. no surface reads the column directly — there is ONE reader;
      2. that reader has the arm the inline reads lacked.
    Checking only (2) would pass a build where a fourth surface reads it inline;
    checking only (1) would pass a build where the one reader throws.
  */
  const offenders: string[] = [];
  for (const file of walk(join(WEB, 'app'))) {
    const src = stripComments(readFileSync(file, 'utf8'));
    if (/story_version_at/.test(src)) {
      offenders.push(file.replace(`${WEB}/`, ''));
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `these surfaces read the story version themselves instead of through ` +
      `readStoryVersionAt(), so a failed read costs them their page rather than ` +
      `their stamp:\n${offenders.join('\n')}`,
  );

  const reader = stripComments(
    readFileSync(join(WEB, 'lib', 'a-withdrawal-reaches-every-copy.server.ts'), 'utf8'),
  );
  const fn = reader.slice(reader.indexOf('export async function readStoryVersionAt'));
  assert.ok(fn.length > 100, 'readStoryVersionAt has gone missing.');
  assert.match(
    fn,
    /catch\s*\{[^}]*return null/,
    'readStoryVersionAt no longer falls back on a THROWN failure — the arm the ' +
      'inline reads were missing is the whole reason this function exists.',
  );
  assert.match(
    fn,
    /if\s*\(error\)\s*return null/,
    'readStoryVersionAt no longer handles a REFUSED read. A rejected query is an ' +
      'absence, not a throw, so the catch alone does not cover it.',
  );
});
