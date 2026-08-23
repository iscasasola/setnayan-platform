import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * THE RAIL CARRIES WHAT YOU RUN — and it is sized like the page it copies.
 *
 * Owner 2026-08-13: "we get to keep that sidebar as agreed and user home and
 * shop and admin will be on that sidebar", and separately "look at the text size
 * difference of youtube and setnayan".
 *
 * The shop row already shipped. THE ADMIN ROW DID NOT EXIST AT ALL — and could
 * not have: `FrontDoorAccount` carried `shopName` and no admin signal, so the
 * data never reached the component. That is why the owner, an admin, saw no HQ
 * anywhere in the rail.
 *
 * Both rows are CAPABILITY-GATED: absent for someone who does not hold that
 * access, never a greyed row. Four honest targets beat five with a dead one.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SHELL = join(HERE, 'front-door-shell.tsx');
/**
 * ⚠ RE-ANCHORED 2026-08-13 (One Shell slice 0), NOT relaxed.
 *
 * The account resolver moved out of `front-door.tsx` into `rail-data.ts` so
 * the public page and the signed-in surfaces resolve "which consoles does this
 * person hold" from ONE place. This guard follows the code; the assertion
 * below is unchanged, and it FAILED first (the shop-row check went red on the
 * move and is what caught it), which is how we know it still reads something.
 */
const DATA = join(HERE, 'rail-data.ts');
const CSS = join(HERE, 'front-door.css');
const ROLES = join(HERE, '..', '..', '..', 'lib', 'roles.ts');

function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
    .join('\n');
}

test('the files are non-trivial — the guard cannot silently read nothing', () => {
  for (const p of [SHELL, DATA, CSS, ROLES]) {
    assert.ok(readFileSync(p, 'utf8').length > 1000, `${p} is missing or a stub.`);
  }
});

test('the rail offers a row into HQ, and into the shop', () => {
  const src = code(readFileSync(SHELL, 'utf8'));
  assert.match(
    src,
    /href="\/admin"/,
    'The rail has no row into Setnayan HQ. The owner asked for home, shop AND ' +
      'admin to live in this sidebar; the admin half never existed.',
  );
  assert.match(
    src,
    /href="\/vendor-dashboard"/,
    'The rail lost its row into the shop.',
  );
});

test('both rows are capability-gated — never a greyed door', () => {
  const src = code(readFileSync(SHELL, 'utf8'));
  assert.match(
    src,
    /account\.isAdmin\s*\?/,
    'The HQ row is not gated on account.isAdmin. An ungated row shows every ' +
      'couple a console they cannot open.',
  );
  assert.match(src, /account\.shopName\s*\?/, 'The shop row lost its gate.');
});

test('the admin signal is decided by THE canonical predicate, and fails closed', () => {
  // RE-ANCHORED 2026-08-13: front-door.tsx no longer reads the columns itself —
  // it asks lib/roles.ts, which is where the predicate now lives (one copy, not
  // two). Pointing this at the old file would pass forever while proving nothing.
  const src = code(readFileSync(ROLES, 'utf8'));
  assert.match(
    src,
    /isAdminProfile\s*\(/,
    'front-door.tsx decides admin some other way. Use lib/admin/admin-predicate ' +
      '— it is three clauses wide (is_internal · is_team_member · account_type), ' +
      'and a narrower copy once locked Team Pool staff out of their own queue.',
  );
  // ORDER-INDEPENDENT ON PURPOSE. The first cut of this assertion demanded the
  // three columns in one fixed order and went red against a select that named
  // the same three in a different order — a guard failing on spelling rather
  // than on the property it exists to hold. The property is "all three are
  // read", nothing more.
  for (const column of ['is_internal', 'is_team_member', 'account_type']) {
    assert.ok(
      new RegExp(`select\\([^)]*${column}`).test(src),
      `The admin read does not select \`${column}\`. All three clauses are ` +
        'load-bearing; selecting fewer silently narrows who counts as staff.',
    );
  }
});

test('Your Story is retired from the rail, and is NOT gated where it moved', () => {
  // 🔁 REVERSED 2026-08-21 (owner): *"remove … your story. we already have your
  // story on untold."* The rail row is gone; the board carries both doors.
  const src = code(readFileSync(SHELL, 'utf8'));
  assert.doesNotMatch(
    src,
    /href="\/dashboard\/creator"/,
    'The Your Story rail row is back. It was retired into the board — if it is ' +
      'genuinely wanted again, change this test deliberately.',
  );

  // 🔑 THE HALF THAT STILL MATTERS, AND IT SURVIVES THE MOVE. Writing is open to
  // every signed-in person ("creator = user", owner-locked 2026-07-16), so the
  // doors that replaced this row must not be capability-gated either. Gating
  // them would hide a desk the person is entitled to sit at — the exact defect
  // this test was written for, relocated rather than deleted.
  /*
    ⚠ RE-ANCHORED 2026-08-23 — THIS HALF WAS PASSING ON DEAD CODE.

    It read the LAUNCHER PAGE for `/dashboard/creator`, and the only such string
    in that file lived inside `BecomeStorytellerRow`: a component with ZERO call
    sites anywhere in the app. So the assertion held while nothing rendered the
    link — a string in an unmounted component is not a door, and this guard was
    the last of three making that mistake. Its sibling
    (`lib/the-controls-have-a-home.test.ts`) was corrected the same way on
    2026-08-19 and records the identical lesson; the dead components were
    deleted on 2026-08-23, which is what finally turned this red.

    The real, MOUNTED door is the account switcher in the shared top bar, on
    every signed-in surface at every width. The property being held is unchanged
    and is still the one that matters: writing is open to every signed-in person
    ("creator = user", owner-locked 2026-07-16), so the door that replaced the
    retired rail row must not be capability-gated.
  */
  const switcher = code(
    readFileSync(
      join(HERE, '../account-switcher/account-switcher.tsx'),
      'utf8',
    ),
  );
  assert.match(
    switcher,
    /href="\/dashboard\/creator"/,
    'nothing anywhere opens Your Story, and the rail row that used to be one ' +
      'was retired on the promise that something does.',
  );
  assert.doesNotMatch(
    switcher,
    /(isStoryteller|hasStory|chapterCount|hasVendor|isAdmin)\s*(\?|&&)[\s\S]{0,200}?dashboard\/creator/,
    'Your Story became capability-gated. Writing is open to every signed-in ' +
      'person; gating it hides a desk they are entitled to.',
  );
});

test('"What you run" renders only alongside a gated row', () => {
  const src = code(readFileSync(SHELL, 'utf8'));
  assert.match(
    src,
    /\{account\.shopName \|\| account\.isAdmin \?[\s\S]{0,220}?What you run/,
    'The "What you run" heading is not gated on a row following it. A heading ' +
      'over nothing is a fake door in label form.',
  );
});

test('the shop row follows what /vendor-dashboard actually admits', () => {
  const src = code(readFileSync(DATA, 'utf8'));
  assert.match(
    src,
    /hasVendorAccess/,
    'front-door.tsx decides the shop row some other way. /vendor-dashboard ' +
      'admits an OWNER **or** a vendor_team_members member; gating the rail on ' +
      'ownership alone gives a hired team member a console they can open and no ' +
      'row offering it.',
  );
});

test('the card type matches the reference — 14px/500 title, 12px byline', () => {
  const css = readFileSync(CSS, 'utf8');
  const ttl = /\.fd-ttl\s*\{[^}]*\}/.exec(css)?.[0] ?? '';
  assert.match(ttl, /font-size:\s*14px/, '.fd-ttl is not 14px. It was 15px, which ' +
    'against the reference\'s 14px read as a different product.');
  assert.match(ttl, /font-weight:\s*500/, '.fd-ttl is not weight 500. It was 600 — ' +
    'a whole weight step heavier than the page it copies.');
  const by = /\.fd-by\s*\{[^}]*\}/.exec(css)?.[0] ?? '';
  assert.match(by, /font-size:\s*12px/, '.fd-by is not 12px.');
});
