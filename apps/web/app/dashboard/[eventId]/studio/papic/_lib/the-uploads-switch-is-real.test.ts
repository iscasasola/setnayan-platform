/**
 * GUARD — the uploads switch governs something, and it governs it honestly.
 *
 * Owner 2026-08-26: *"a toggle will set if they will allow people to upload
 * photos manually as well"* and *"uploading can depend on the toggle for photo
 * upload."*
 *
 * ⛔ IT WAS DELIBERATELY NOT BUILT UNTIL THE PICKER EXISTED. A switch with
 * nothing behind it is a gate with no handle — this codebase has found five of
 * those, including a column that sat unread for seven weeks while the feature
 * it controlled was believed to be running. The order was: build the door,
 * then the lock.
 *
 * ⚖ IT DEFAULTS OPEN, and that is a stated choice rather than an accident.
 * Papic's purpose is now the event's media library; a library that refuses the
 * most obvious way to put something in it would be closed against its own
 * point, and an upload costs a credit exactly like a shot — so an open door is
 * not a free one.
 *
 * 🔑 AND THE LIMIT OF THIS GUARD IS WRITTEN DOWN. It checks that the SCREEN
 * obeys the switch, because today the only manual-upload path is the couple's
 * own picker and the only holder of the Uploads camera is the couple — a couple
 * bypassing their own preference harms nobody. **The moment somebody else can
 * upload, hiding a control is not closing a door**, and the server must read
 * this column too. That is the live-photo-wall lesson, where the only "off"
 * switch closed the venue screens while the feed carried on to a hundred
 * phones.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAPIC = dirname(dirname(fileURLToPath(import.meta.url)));
const PAGE = readFileSync(join(PAPIC, 'page.tsx'), 'utf8');
const CHOICE = readFileSync(join(PAPIC, '_components/uploads-open-choice.tsx'), 'utf8');
const ACTIONS = readFileSync(join(PAPIC, 'actions.ts'), 'utf8');

test('the switch exists on all three layers — column, action, control', () => {
  assert.match(ACTIONS, /papic_uploads_open/, 'the action no longer writes the column');
  assert.match(ACTIONS, /export async function setPapicUploadsOpen/, 'the action is gone');
  assert.match(CHOICE, /export function UploadsOpenChoice/, 'the control is gone');
  assert.match(PAGE, /<UploadsOpenChoice/, 'the control is not mounted — an unmounted control is not a control');
});

test('🚨 the switch actually GOVERNS the picker', () => {
  // The failure being guarded is a switch that saves a value nobody reads.
  assert.match(PAGE, /const uploadsOpen =/, 'the page no longer reads the column');
  assert.match(
    PAGE,
    /\{!uploadsOpen \?/,
    'the picker no longer branches on the switch — turning it off would save a value and change nothing a person can see',
  );
});

test('⚠ an absent column means OPEN, never closed', () => {
  // The column lands in 20271170068924. On a pre-migration database the read
  // must not close the library's most obvious door on everybody.
  // ⚠ MATCHED ON THE ASSIGNMENT, NOT ON ONE SPELLING OF THE CAST. The first
  // version pinned the exact expression `papic_uploads_open as boolean | null)
  // ?? true`, and went red the moment the read moved onto its own round trip —
  // a correct change failing a guard that was describing characters instead of
  // behaviour. What must hold is that the fallback in THIS assignment is open.
  const assignment = PAGE.match(/const uploadsOpen\s*=[\s\S]{0,300}?;/)?.[0] ?? '';
  assert.ok(assignment, 'the uploadsOpen assignment is gone from the page');
  assert.match(
    assignment,
    /\?\?\s*true/,
    'a missing column no longer falls back to open — every couple on a pre-migration database loses uploading with no explanation',
  );
});

test('🚨 the control posts the value it WANTS, never a flip of what it read', () => {
  // A toggle that flips "whatever it last saw" lands on the opposite of what
  // somebody pressed when the page is stale or they double-tap — and this one
  // decides whether a wedding's gallery can be added to.
  assert.match(CHOICE, /name="open" value=\{open \? '0' : '1'\}/, 'the control no longer posts an explicit target value');
  assert.match(
    ACTIONS,
    /const open = String\(formData\.get\('open'\) \?\? ''\) === '1';/,
    'the action derives the new value from something other than the posted intent',
  );
  assert.ok(!/papic_uploads_open: !/.test(ACTIONS), 'the action negates the current value — that is the flip this rule exists to prevent');
});

test('the copy says what it costs, and what OFF actually means', () => {
  assert.match(CHOICE, /uses a credit/, '"allow uploads" reads like a free door unless the cost is on the same screen');
  assert.match(CHOICE, /Only what your cameras capture/, 'the off state no longer says what it does — a switch whose off position is unexplained gets left on');
});

test('🚨 saving it is confirmed, never silent', () => {
  // Nine settings on this page once saved into the void.
  assert.match(ACTIONS, /uploads_open_set=/, 'the action no longer reports its outcome');
  assert.match(PAGE, /uploadsOpenSet \?/, 'the outcome is emitted and read by nothing — the exact defect the banners guard was written after');
});

/**
 * 🪤 RULE 7 EXISTS BECAUSE RULES 1–6 PASSED WHILE THE SWITCH GOVERNED NOTHING.
 *
 * The first cut read `ev.papic_uploads_open` off the page's main event select —
 * which never named the column. It was always `undefined`, `?? true` reported
 * OPEN, and the picker rendered for a couple who had switched it off. Every
 * other rule here was satisfied: the column existed, the control was mounted,
 * the branch was wired, the save was confirmed. **I guarded the branch and not
 * the source**, which is the same mistake as guarding a component's shape
 * instead of censusing the thing.
 *
 * ⚠ It must be its OWN round trip, not an extra name on the main select. The
 * column lands in a migration; naming an unknown column makes PostgREST refuse
 * the WHOLE query, and this page calls `notFound()` when that read comes back
 * empty — so the "safe" one-line version turns a missing migration into a
 * celebration that does not exist. `papic_style` above it is the precedent.
 */
test('7 · the value the picker branches on is actually SELECTED from the database', () => {
  const src = PAGE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

  // ⚠ `,?` IS LOAD-BEARING. Without it this missed every multi-line select —
  // which in this file is written `.select(\n  '…',\n)` with a trailing comma —
  // so folding the column into the main event read counted as ZERO selects and
  // the rule passed on the arrangement it exists to forbid. Measured, not
  // assumed: the sabotage went 1 → 1 and stayed green.
  const selects = src.match(/\.select\(\s*'[^']*papic_uploads_open[^']*'\s*,?\s*\)/g) ?? [];
  assert.equal(
    selects.length,
    1,
    `papic_uploads_open is named in ${selects.length} select(s) on the Papic ` +
      `studio page — expected exactly 1. Zero means the switch governs nothing ` +
      `and reports OPEN forever; more than one is a second copy of the read.`,
  );

  // …and on its own, so an unknown column cannot take the main event read down.
  assert.doesNotMatch(
    selects[0]!,
    /event_id,|papic_storage_target/,
    'papic_uploads_open was folded into the main event select. On a database ' +
      'that predates its migration PostgREST refuses that whole query, and this ' +
      'page answers an unreadable event with notFound() — a live celebration ' +
      'would render as missing.',
  );

  // The branch must consume THAT read, not something shaped like it.
  assert.match(
    src,
    /const uploadsOpen\s*=[\s\S]{0,200}uploadsRow/,
    'the picker branches on a value that does not come from the select above — ' +
      'which is exactly how this shipped governing nothing the first time',
  );
});

/**
 * 🔒 RULE 8 — THE TRIPWIRE THAT MAKES THE BASELINE LINE HONEST.
 *
 * `handles-have-gates.db.test.ts` flags a switch written and read by one surface
 * and asks the question a scanner cannot: does the copy beside it promise
 * something it does not do? For this switch the answer is NO — **today**. The
 * OFF text reads *"Nothing can be added from a phone or laptop"*, which is a
 * claim about the whole gallery, and it is true only because the couple's own
 * picker is the ONLY manual-upload path that exists. That reasoning is written
 * into `tests/db/handles-have-gates.baseline.txt`.
 *
 * A baseline line that stops being true is worse than no line, because it reads
 * as "somebody checked". So this rule fails the moment a FOURTH thing records a
 * capture — a guest picker, a supplier upload, a new camera surface. At that
 * moment two things must happen together, and neither is optional:
 *
 *   1. the OFF copy stops being true unless the new path honours the switch, and
 *   2. **the SERVER must read the column, not just the screen.** Hiding a
 *      control is not closing a door — the live photo wall mirrored to every
 *      guest's phone while the only "off" switch closed the venue screens.
 *
 * ⚠ Counted at the CALL, not by importing the module: the point is how many
 * places can put a row in, and an import that is never called is not a path.
 */
test('8 · exactly three things record a capture — a fourth must gate the write, not the button', () => {
  const WEB = join(import.meta.dirname, '..', '..', '..', '..', '..', '..');
  const known = [
    'app/dashboard/[eventId]/studio/papic/_components/add-to-library.tsx',
    'app/papic/seat/[token]/_components/camera-bridge-panel.tsx',
    'app/papic/seat/[token]/_components/papic-seat-capture.tsx',
  ];

  const found = execFileSync(
    'grep',
    ['-rlE', 'recordSeatCapture\\(', 'app', 'lib', '--include=*.ts', '--include=*.tsx'],
    { cwd: WEB, encoding: 'utf8' },
  )
    .split('\n')
    .filter(Boolean)
    .filter((f) => !f.includes('.test.'))
    // app/papic/actions.ts DECLARES it; it does not call it.
    .filter((f) => f !== 'app/papic/actions.ts')
    // The offline drain and the camera-bridge sink take a `record` CALLBACK that
    // the two seat components above hand them — they are the same path, plumbed.
    .filter((f) => !f.startsWith('lib/offline/') && !f.startsWith('lib/camera-bridge/'))
    .sort();

  assert.deepEqual(
    found,
    known.slice().sort(),
    `the set of capture recorders changed:\n  expected ${known.join('\n           ')}\n  found    ${found.join('\n           ')}\n\n` +
      `If a NEW one adds photos BY HAND: it must read events.papic_uploads_open ` +
      `ON THE SERVER before writing, not merely hide its button — and the OFF ` +
      `copy on the switch ("Nothing can be added from a phone or laptop") stops ` +
      `being true until it does. Then delete the events.papic_uploads_open line ` +
      `from tests/db/handles-have-gates.baseline.txt, which says this switch's ` +
      `effect is local.`,
  );
});
