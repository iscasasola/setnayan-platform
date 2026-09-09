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
    out.push({ name: m[1], body: src.slice(start, end + 1) });
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
