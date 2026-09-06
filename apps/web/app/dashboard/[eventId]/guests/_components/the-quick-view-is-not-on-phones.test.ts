/**
 * the-quick-view-is-not-on-phones.test.ts — a component does not decide its own
 * reach; its MOUNT does.
 *
 * `guest-drawer.tsx` called itself "the mobile / below-xl QUICK-VIEW guest
 * SHEET" from the day it shipped. It is not reachable on a phone. The only
 * thing that opens it is `QuickViewButton`, and the only place that renders is
 * `DesktopRow` — which lives inside the roster's `hidden … sm:block` table.
 * Below 640px that table is `display:none`, so a phone has ZERO triggers and a
 * row tap goes straight to `/guests/[guestId]`.
 *
 * Measured on the shipped page: 0 visible triggers at 375px, 4 at 768px.
 *
 * ── WHY A COMMENT WAS WORTH A TEST ─────────────────────────────────────────
 * On 2026-09-06 a session added a destructive control to this sheet, then
 * reasoned about it as a PHONE hazard — "a panel a host opens casually while
 * scanning a roster" — and reported that severity to the owner. It was wrong,
 * and the source of the error was this file's own name for itself. Nothing in
 * the type system, the tests, or CI disagreed, because none of them read
 * prose. The repo already knows this failure mode: `CLAUDE.md` documents a
 * false belief that spread through six migration headers under the rule "do
 * not treat a comment as evidence."
 *
 * 🔑 So this file does NOT pin the prose as the primary thing. It pins the
 * MOUNT. If somebody makes the quick view reachable on a phone, these tests go
 * red and the docblock must be revisited in the same commit — which is the only
 * mechanism that keeps a comment honest over time.
 *
 * 🛡 Mutation-checked against the real files, failures counted, each RED:
 *  · render <QuickViewButton> in MobileListRow too  → 0 → 2 failing · RED
 *  · drop the `sm:block` from the desktop table     → 0 → 1 failing · RED
 *  · delete the reach note from guest-drawer.tsx    → 0 → 1 failing · RED
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => readFileSync(join(HERE, f), 'utf8');

/** Code only — the mount assertions must not be satisfied by prose. */
const LIST = stripComments(read('guest-list-multiselect.tsx'));
/** Raw — the reach-note assertion is ABOUT the prose, so it must not be stripped. */
const DRAWER_RAW = read('guest-drawer.tsx');

function bodyOf(src: string, name: string): string {
  const at = src.indexOf(`function ${name}(`);
  assert.notEqual(at, -1, `${name} is gone — this test is pinning a ghost`);
  const lparen = src.indexOf('(', at);
  let parens = 0;
  let afterParams = -1;
  for (let i = lparen; i < src.length; i += 1) {
    if (src[i] === '(') parens += 1;
    else if (src[i] === ')') {
      parens -= 1;
      if (parens === 0) {
        afterParams = i;
        break;
      }
    }
  }
  const open = src.indexOf('{', afterParams);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

test('the quick view has exactly ONE trigger, and it is the desktop row', () => {
  const mounts = LIST.match(/<QuickViewButton/g) ?? [];
  assert.equal(
    mounts.length,
    1,
    `expected one <QuickViewButton> mount, found ${mounts.length} — if the ` +
      'quick view gained a second entry point, its reach changed and the ' +
      'docblock in guest-drawer.tsx must be revisited',
  );
  assert.ok(
    bodyOf(LIST, 'DesktopRow').includes('<QuickViewButton'),
    'the one mount must be DesktopRow',
  );
});

test('neither phone row renders it — that is WHY it is unreachable at 375px', () => {
  for (const row of ['GuestCard', 'MobileListRow']) {
    assert.equal(
      bodyOf(LIST, row).includes('<QuickViewButton'),
      false,
      `${row} now mounts the quick view, so a phone CAN reach it — the sheet ` +
        'is no longer desktop-only and guest-drawer.tsx must stop saying so',
    );
  }
});

test('the desktop table is still hidden below sm', () => {
  // This is the other half of the reason. If the table stops being sm-gated,
  // the trigger reaches phones without anyone touching the drawer.
  assert.ok(
    /className="hidden[^"]*\bsm:block\b/.test(LIST),
    'the roster table is no longer `hidden … sm:block` — the quick view may ' +
      'now render on phones',
  );
});

test('the reach note survives in guest-drawer.tsx', () => {
  // Prose, asserted deliberately and on the RAW file: this comment is the only
  // thing standing between the next reader and the same wrong conclusion.
  assert.ok(
    /NOT REACHABLE ON A PHONE/.test(DRAWER_RAW),
    'the reach note was removed — restore it, or the file goes back to ' +
      'implying it renders on phones',
  );
  assert.ok(
    /0 visible triggers at 375px/.test(DRAWER_RAW),
    'keep the measurement with the claim; a claim without one is what this ' +
      'file exists to correct',
  );
});
