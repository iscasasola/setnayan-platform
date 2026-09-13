/**
 * the-un-post-reaches-the-tile.test.ts — the guest's wall control is WIRED,
 * scoped to her session, and says which refusal it just made.
 *
 * ── WHAT THIS EXISTS TO CATCH ──────────────────────────────────────────────
 * The scope decision itself is proved behaviourally next door
 * (lib/guest-wall-unpost.test.ts, 24 cases against a stub client). What that
 * file cannot see is the wiring, and on this feature the wiring carries the one
 * catastrophic failure mode: **`/[slug]` is a PUBLIC page.** Anybody with the
 * link reaches these server actions. If the guest id ever arrives as an
 * ARGUMENT instead of out of the signed cookie, every check in the library
 * below it is still green and still correct — and a stranger can hand it
 * somebody else's id and pull their wedding photograph off the wall.
 *
 * The sibling half is the older lesson in the same room: a control can render
 * perfectly and act on nothing (`removeMyTag` shipped filtering a tag source
 * that has never existed in production). So this also asserts the control is
 * MOUNTED, on the tile and in the lightbox, rather than merely defined.
 *
 * Every assertion runs over `stripComments` output and is anchored to the ACT —
 * this feature is named in a dozen comments across the files it touches. Each
 * was mutation-checked with the occurrence count printed before → after:
 *
 *   session gate deleted from wallPull            1 → 0   RED
 *   guestId taken from an argument                1 → 0   RED
 *   the three refusals collapsed to one sentence  3 → 1   RED
 *   <WallControl> unmounted from the lightbox     1 → 0   RED
 *   <WallBadge> unmounted from the tile           1 → 0   RED
 *   'unknown' stops counting as on-the-wall       2 → 0   RED
 *   wall state dropped from the gallery read      1 → 0   RED
 *   provenance column dropped from one table      2 → 1   RED
 *   wall_unhide stops clearing the provenance     2 → 1   RED
 *   hidden_at written by the un-post              0 → 1   RED
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..');
const MIGRATIONS = resolve(WEB, '..', '..', 'supabase', 'migrations');

const read = (p: string) => stripComments(readFileSync(p, 'utf8'));
const count = (h: string, n: string) => h.split(n).length - 1;

/** Find a migration by content, never by a remembered filename. */
function migrationNaming(marker: string): string {
  const hit = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => join(MIGRATIONS, f))
    .find((f) => readFileSync(f, 'utf8').includes(marker));
  assert.ok(hit, `No migration mentions ${marker}.`);
  return readFileSync(hit as string, 'utf8');
}

const actions = () => read(join(HERE, 'actions.ts'));
const gallery = () => read(join(HERE, '_components', 'photos-of-you-gallery.tsx'));
const lib = () => read(join(WEB, 'lib', 'guest-wall-unpost.ts'));

/**
 * Slice to the NEXT top-level declaration, never a fixed character count.
 * `stripComments` replaces a comment with SPACES so byte offsets survive — and
 * the docblocks here run to thousands of them, so a fixed window would end
 * before the code it was meant to read and fail for the wrong reason.
 */
function fn(src: string, name: string): string {
  const start = src.indexOf(name);
  assert.ok(start >= 0, `${name} must still exist.`);
  const rest = src.slice(start + name.length);
  const end = rest.search(/\n(export |async function |function |type )/);
  return rest.slice(0, end === -1 ? undefined : end);
}

test('the guest id comes out of the SIGNED COOKIE — never off the wire', () => {
  const src = actions();
  const body = fn(src, 'async function wallPull(');

  assert.equal(
    count(body, 'readGuestSession()'),
    1,
    'wallPull must resolve the guest from the session cookie. This page is public: ' +
      'without it, a stranger with the link is an authenticated guest.',
  );
  assert.equal(
    count(body, 'session.event_id !== eventId'),
    1,
    'the session must be pinned to the celebration in the arguments too — one ' +
      'cookie must not reach another wedding’s photographs.',
  );
  assert.equal(
    count(body, 'guestId: session.guest_id'),
    1,
    'the guest id passed down to the scope check is the cookie’s, and only ever the cookie’s.',
  );

  // And neither exported entry point accepts one, so there is nothing to spoof.
  for (const name of ['takeMyPhotoOffTheWall', 'putMyPhotoBackOnTheWall']) {
    const signature = src.slice(
      src.indexOf(`export async function ${name}(`),
      src.indexOf(`export async function ${name}(`) + 260,
    );
    const params = signature.slice(signature.indexOf('('), signature.indexOf('):'));
    // A PARAMETER named for a guest — not the word, which rides along inside
    // the table name 'papic_guest_captures' and would make this vacuously red.
    assert.ok(
      !/(^|[\s,(])guest\w*\s*[:?]/i.test(params),
      `${name} must not take a guest id as an argument — the cookie is the identity. Params were: ${params}`,
    );
  }
});

test('each refusal gets its own sentence — "no" and "we could not tell" are different answers', () => {
  const body = fn(actions(), 'async function wallPull(');
  for (const reason of ['not_yours', 'not_your_pull']) {
    assert.ok(body.includes(reason), `wallPull must handle the ${reason} refusal by name.`);
  }
  const sentences = [...body.matchAll(/'([^']*(?:take down|put back|reach the wall)[^']*)'/gi)].map(
    (m) => m[1],
  );
  assert.equal(
    new Set(sentences).size,
    3,
    'three refusals, three sentences: whose photo it is, whose pull it was, and ' +
      'a failure worth pressing again. Collapsing them tells the one person who ' +
      'needs to know the least useful thing.',
  );
});

test('the control is MOUNTED — on the tile as a state, in the lightbox as a button', () => {
  const src = gallery();
  assert.equal(count(src, '<WallBadge'), 1, 'the tile must say whether it is on the wall right now.');
  assert.equal(
    count(src, '<WallControl'),
    1,
    'the lightbox must carry the button itself — a tile cannot hold a third 44px pill.',
  );
  assert.equal(
    count(src, 'takeMyPhotoOffTheWall('),
    1,
    'and the button must actually call the action.',
  );
  assert.equal(count(src, 'putMyPhotoBackOnTheWall('), 1);
});

test('a FAILED wall read still offers the control', () => {
  const src = gallery();
  assert.equal(
    count(src, "state === 'posted' || state === 'unknown'"),
    2,
    'both the badge and the button must treat an unreadable wall as ON. A privacy ' +
      'control that disappears when a secondary read breaks is the ' +
      'failure-renders-as-emptiness defect this codebase keeps paying for.',
  );
});

test('the gallery read carries the wall state to the render', () => {
  const src = read(join(WEB, 'lib', 'guest-live-gallery.ts'));
  assert.equal(
    count(src, 'readGuestWallStates('),
    1,
    'the tiles being rendered must be asked about the wall…',
  );
  assert.equal(
    count(src, 'wall: wallStates.get('),
    1,
    '…and the answer must reach the photo object, or nothing on screen changes.',
  );
});

test('the un-post touches the WALL switch and never the durable gallery hide', () => {
  const src = lib();
  const written = [...src.matchAll(/(\w*hidden_at)\s*:/g)].map((m) => m[1]);
  assert.ok(written.length > 0, 'it must write the wall kill switch at all.');
  for (const column of written) {
    assert.equal(
      column,
      'wall_hidden_at',
      'Only the wall-only switch. `hidden_at` is the durable gallery/recap ' +
        'suppression — a different decision, with a different door ' +
        '(askToTakeMyPhotoDown), because deleting a photograph that may hold ' +
        'four other people is not one guest’s call.',
    );
  }
});

test('the provenance column lands on BOTH capture tables, and the hosts’ RPC clears it', () => {
  const sql = migrationNaming('wall_hidden_by_guest_id');
  assert.equal(
    count(sql, 'ADD COLUMN IF NOT EXISTS wall_hidden_by_guest_id'),
    2,
    'papic_photos AND papic_guest_captures — a guest’s pull must be recordable ' +
      'on either kind of capture, or the put-back silently refuses on one of them.',
  );
  // Per FUNCTION, not per file: a file-level count cannot say WHICH function
  // still clears it, and this repo has watched a 2→1 sabotage stay green for
  // exactly that reason. Each RPC hides/restores on two capture tables, so each
  // must carry the clear twice.
  for (const rpc of ['FUNCTION public.wall_retract', 'FUNCTION public.wall_unhide']) {
    const start = sql.indexOf(rpc);
    assert.ok(start > 0, `${rpc} must still be replaced by this migration.`);
    const body = sql.slice(start, sql.indexOf('$$;', start));
    assert.equal(
      count(body, 'wall_hidden_by_guest_id = NULL'),
      2,
      `${rpc} must clear the provenance on BOTH capture tables: a row that says a ` +
        'guest is holding down a photograph she no longer is would hand her a ' +
        'control over somebody else’s decision.',
    );
  }
});
