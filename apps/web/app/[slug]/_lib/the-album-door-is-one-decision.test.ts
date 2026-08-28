/**
 * THE ALBUM DOOR IS ONE DECISION — and every guest-facing surface must agree.
 *
 * ── THE DEFECT, MEASURED 2026-08-27 ─────────────────────────────────────────
 * THREE surfaces on the public event website offered a way into the couple's
 * recap album, and only ONE of them asked whether the album exists:
 *
 *   · the rooms footer          `resolveRoomLinks`  → asked `recapPublished` ✅
 *   · the live hub photos panel `hub/page.tsx`      → asked `isPost`         ❌
 *   · the public event-day bar  `loaders.ts`        → asked `dayOfPhase`     ❌
 *
 * Counted, not estimated: on `origin/main` at 1c88a65e4, three files under
 * `app/[slug]/` constructed the album-door href. After the fix, one does.
 *
 * The day-of phase was standing in for "the album is out" and is wrong in BOTH
 * directions — `post` is only T+36h → T+60h, so the two phase-gated doors
 * appeared during the ~24 hours when the couple has almost certainly not
 * published yet (the guest tapped through and was told "The recap isn't ready
 * yet") and then went dark forever at T+60h, hiding a genuinely published album
 * that the rooms footer beside them was still offering.
 *
 * ── WHAT THIS FILE CAN AND CANNOT PROVE ─────────────────────────────────────
 * The RULE (`albumRoomLink`) is pure, so it is imported and RUN for real, in
 * both directions, against the same fixture the rooms footer is given — that
 * half is a behavioural proof, not a source match.
 *
 * The FACT and its fail-closed read live in `album-door.server.ts`, which is
 * `server-only` and cannot be imported here; and `hub/page.tsx` / `loaders.ts`
 * are server components with the whole app behind them. So the assertion that
 * those surfaces route through the one decision is made STRUCTURALLY: no file
 * in the guest tree may build an album-door href of its own. That is the shape
 * the defect actually took, and it is what a regression would look like.
 * This file does not pretend to prove that Postgres returns any particular row.
 *
 * ── WHY THE FILE LIST IS DERIVED ────────────────────────────────────────────
 * A hand-written list is a list of the files somebody thought of. The hub was
 * the file nobody thought of, and `loaders.ts` was not in the brief that
 * commissioned this fix — it was found by scanning. So the scan walks the tree
 * and classifies what it finds, and it FAILS if it finds nothing (three
 * independent floors below), because a scan that matches nothing looks exactly
 * like a clean result.
 *
 * Comments are stripped before matching: every file touched here carries
 * paragraphs explaining the bug it fixed, and a raw-source scan reads that
 * prose as an offender.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { albumRoomLink, resolveRoomLinks, type RoomLinksInput } from './room-links';

// `new URL(...).pathname` percent-encodes the brackets in `[slug]`.
const HERE = dirname(fileURLToPath(import.meta.url));
/** The public event website — where a GUEST stands. */
const GUEST_TREE = dirname(HERE);
/** The one module allowed to construct the album door's address. */
const THE_RULE = join(HERE, 'room-links.ts');

const SLUG = 'mateo-turns-seven';

// ───────────────────────────────────────────────────────────────────────────
// A · THE THREE SURFACES AGREE — one fixture, run for real, both directions.
// ───────────────────────────────────────────────────────────────────────────

/** The rooms footer's input, with everything else open so only the album
 *  answer can move. */
function footerInput(recapPublished: boolean): RoomLinksInput {
  return {
    slug: SLUG,
    current: null,
    guestToken: null,
    seatingSurfaceEnabled: true,
    seatingPublished: true,
    pabuyaRouteEnabled: true,
    enabledEgiftCount: 2,
    pabuyaViewerAllowed: true,
    recapPublished,
    liveHubOpen: true,
  };
}

/** What the rooms footer offers for the album, or null. */
const footerAlbum = (published: boolean) =>
  resolveRoomLinks(footerInput(published)).find((r) => r.key === 'album') ?? null;

/** What the hub and the public event-day bar offer — they take `.href` off
 *  exactly this call (`resolveAlbumDoor` → `albumRoomLink`). */
const sharedAlbum = (published: boolean) => albumRoomLink(SLUG, published);

test('one fixture, both surfaces: the footer and the shared rule never disagree', () => {
  for (const published of [true, false]) {
    assert.deepEqual(
      sharedAlbum(published),
      footerAlbum(published),
      `With recapPublished=${published} the rooms footer and the rule the hub + ` +
        'event-day bar use gave DIFFERENT answers. That drift is the whole defect ' +
        'this file exists to prevent.',
    );
  }
});

test('published ⇒ every surface offers the album, at the album’s address', () => {
  const shared = sharedAlbum(true);
  assert.ok(shared, 'A published album must be offered.');
  assert.equal(shared.href, `/${SLUG}/recap`);
  assert.equal(footerAlbum(true)?.href, `/${SLUG}/recap`);
});

test('unpublished ⇒ NO surface offers it — a dead end is worse than no link', () => {
  assert.equal(sharedAlbum(false), null, 'The hub / event-day bar rule offered an unpublished album.');
  assert.equal(footerAlbum(false), null, 'The rooms footer offered an unpublished album.');
});

test('no slug ⇒ no door, however published — there is no address to point at', () => {
  assert.equal(albumRoomLink(null, true), null);
  assert.equal(albumRoomLink('   ', true), null);
});

// ───────────────────────────────────────────────────────────────────────────
// B · NOBODY IN THE GUEST TREE BUILDS THIS DOOR THEMSELVES.
// ───────────────────────────────────────────────────────────────────────────

/** Remove comments, keeping string + template contents (that is where the
 *  hrefs live). A state machine, NOT a line-prefix filter: a prefix filter's
 *  survivors are mostly block-comment continuation lines.
 *
 *  `'` and `"` terminate at a newline, per the language — so a stray
 *  apostrophe in JSX prose can cost at most the rest of one line, never the
 *  rest of the file. */
export function stripComments(src: string): string {
  let out = '';
  let state: 'code' | 'line' | 'block' | 'str' = 'code';
  let quote = '';
  for (let i = 0; i < src.length; ) {
    const c = src[i];
    const d = src[i + 1];
    if (state === 'code') {
      if (c === '/' && d === '/') { state = 'line'; i += 2; continue; }
      if (c === '/' && d === '*') { state = 'block'; i += 2; continue; }
      if (c === "'" || c === '"' || c === '`') { state = 'str'; quote = c; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; out += c; }
      i++; continue;
    }
    if (state === 'block') {
      if (c === '*' && d === '/') { state = 'code'; i += 2; continue; }
      if (c === '\n') out += c;
      i++; continue;
    }
    // state === 'str'
    if (c === '\\') { out += c + (d ?? ''); i += 2; continue; }
    if (c === quote || (c === '\n' && quote !== '`')) { state = 'code'; out += c; i++; continue; }
    out += c; i++; continue;
  }
  return out;
}

/** A string or template literal whose path ENDS at `/recap` — i.e. an address
 *  for the public album, not `/api/og/recap/...` (mid-path) and not
 *  `/dashboard/.../studio/papic/recap` (a different destination entirely,
 *  outside this tree).
 *
 *  ⚠ DELIBERATELY NOT `/g`. A global regex carries `lastIndex` between calls,
 *  so `assert.match` / `.test()` against it silently start mid-string and go
 *  red on input they should accept. The scan below builds its own global copy.
 *  (This guard's anti-vacuous floor caught exactly that, first run.) */
const ALBUM_HREF = /[`'"][^`'"\n]*\/recap(?=[`'"?#])/;

/** An ABSOLUTE album address is the recap page naming ITSELF — its canonical
 *  tag, its OG card, its share link. Those are not doors: nothing is being
 *  offered to a visitor and nothing is conditional. Classified by the
 *  expression, never by filename, so no file is ever exempt as a whole. */
const IS_ABSOLUTE = /SITE_URL|https?:/;

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) sourceFiles(p, acc);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) acc.push(p);
  }
  return acc;
}

type Hit = { file: string; literal: string };

function scanGuestTree(): { scanned: number; doors: Hit[]; selfCanonical: Hit[] } {
  const files = sourceFiles(GUEST_TREE);
  const doors: Hit[] = [];
  const selfCanonical: Hit[] = [];
  for (const file of files) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const m of src.matchAll(new RegExp(ALBUM_HREF.source, 'g'))) {
      (IS_ABSOLUTE.test(m[0]) ? selfCanonical : doors).push({ file, literal: m[0] });
    }
  }
  return { scanned: files.length, doors, selfCanonical };
}

test('the scan can actually see the defect it looks for (anti-vacuous floor)', () => {
  // The exact shape the hub and the event-day bar shipped, and the shape a
  // regression would take. If this stops matching, every result below is
  // meaningless — a scan that matches nothing looks exactly like a pass.
  const regression = 'const recapHref = isPost ? `/${event.slug}/recap` : null;';
  assert.match(regression, ALBUM_HREF, 'ALBUM_HREF no longer matches the original defect.');

  // …and the classifier must still be able to say "not a door", or everything
  // lands in one bucket and the split is decoration.
  assert.ok(IS_ABSOLUTE.test('`${SITE_URL}/${event.slug}/recap`'));
  assert.ok(!IS_ABSOLUTE.test('`/${event.slug}/recap`'));

  // Comments must be gone before matching — this file and the three it guards
  // all quote the defect in prose.
  assert.equal(stripComments('// const h = `/${e.slug}/recap`;\nconst ok = 1;').trim(), 'const ok = 1;');
  assert.equal(stripComments('/* `/${e.slug}/recap` */\nconst ok = 1;').trim(), 'const ok = 1;');
  // …but real code must survive it.
  assert.match(stripComments('const h = `/${e.slug}/recap`;'), ALBUM_HREF);
});

test('the guest tree has exactly ONE place that builds the album door', () => {
  const { scanned, doors, selfCanonical } = scanGuestTree();

  // FLOORS — three independent ways for an empty sweep to fail loudly.
  assert.ok(scanned > 50, `Only ${scanned} files scanned; the walk is not reaching the tree.`);
  assert.ok(doors.length > 0, 'No album-door construction found AT ALL — the rule module should be one.');
  assert.ok(
    selfCanonical.length > 0,
    'No absolute recap address found — the recap page names itself in its canonical tag, ' +
      'OG card and share link. Finding none means the scan or the classifier is broken.',
  );

  const strays = doors
    .filter((h) => h.file !== THE_RULE)
    .map((h) => `${relative(GUEST_TREE, h.file)} → ${h.literal}`);

  assert.deepEqual(
    strays,
    [],
    'A surface in the guest tree is building the album door itself instead of asking ' +
      '`resolveAlbumDoor` (album-door.server.ts). That is exactly how the hub and the ' +
      'public event-day bar came to offer a gallery that does not exist. Take the door ' +
      'from the one decision and use its `.href`.',
  );

  // And the one that IS allowed must still be there — otherwise "no strays"
  // is satisfied by the rule module having quietly stopped building it.
  assert.ok(
    doors.some((h) => h.file === THE_RULE),
    'room-links.ts no longer builds the album door. The one decision has moved or gone; ' +
      'point THE_RULE at its new home rather than deleting this check.',
  );
});

// ───────────────────────────────────────────────────────────────────────────
// C · THE FAIL DIRECTION, AND THE SEAM THAT CARRIES IT.
// ───────────────────────────────────────────────────────────────────────────

test('a failed read closes the door — it must never fail OPEN', () => {
  const src = stripComments(readFileSync(join(HERE, 'album-door.server.ts'), 'utf8'));
  assert.match(
    src,
    /\.catch\(\s*\(\s*\)\s*=>\s*false\s*\)/,
    'The album-door read no longer fails closed. A failed read must not invent an album ' +
      'that is not there: a link to a dead end is worse than no link.',
  );
  assert.doesNotMatch(
    src,
    /\.catch\(\s*\(\s*\)\s*=>\s*true\s*\)/,
    'The album-door read fails OPEN — on a database blip every guest is offered an album ' +
      'that may not exist.',
  );
});

test('the rooms footer takes its album answer from the shared rule', () => {
  const src = stripComments(readFileSync(THE_RULE, 'utf8'));
  const body = src.slice(src.indexOf('export function resolveRoomLinks'));
  assert.notEqual(body, '', 'resolveRoomLinks is gone or renamed — update this test.');
  assert.match(
    body,
    /albumRoomLink\(/,
    'resolveRoomLinks has stopped calling albumRoomLink and is deciding the album door ' +
      'for itself again. Two rules that agree today are two rules that drift tomorrow.',
  );
});

test('the recap read is memoised, so the doors cost one query per request', () => {
  const src = stripComments(
    readFileSync(join(HERE, '..', '..', '..', 'lib', 'auto-recap.ts'), 'utf8'),
  );
  assert.match(
    src,
    /export const getRecapStatus = cache\(/,
    'getRecapStatus is no longer React.cache`d. Three doors plus the recap page’s own two ' +
      'checks ask it per request; uncached that is five queries on a hot page.',
  );
});
