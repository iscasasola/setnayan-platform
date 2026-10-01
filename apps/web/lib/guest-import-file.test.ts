/**
 * guest-import-file.test.ts — the guest list file (owner 2026-10-01).
 *
 * 1. TEMPLATE SERVED PER EVENT TYPE — a wedding gets the file with Side, every
 *    other role set the general one; both files exist under public/ and neither
 *    carries an email column (guests are never emailed).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { GUEST_TEMPLATES, guestTemplateFor } from './guest-import-file';
import { eventHasSides } from './guest-side-question';
import {
  GENERIC_ROLE_SET,
  MUSLIM_ROLE_SET,
  SIMPLE_ROLE_SET,
  WEDDING_ROLE_SET,
} from './role-sets';

const WEB = path.join(__dirname, '..');
const PAGE = path.join(WEB, 'app/dashboard/[eventId]/guests/import/page.tsx');

// --- 1. Template served per event type -------------------------------------

test('a wedding (either role set) gets the file WITH Side; other types the general one', () => {
  assert.equal(guestTemplateFor(eventHasSides(WEDDING_ROLE_SET)), GUEST_TEMPLATES.withSides);
  assert.equal(guestTemplateFor(eventHasSides(MUSLIM_ROLE_SET)), GUEST_TEMPLATES.withSides);
  assert.equal(guestTemplateFor(eventHasSides(GENERIC_ROLE_SET)), GUEST_TEMPLATES.withoutSides);
  assert.equal(guestTemplateFor(eventHasSides(SIMPLE_ROLE_SET)), GUEST_TEMPLATES.withoutSides);
});

test('every template file exists, Side only in the wedding one, and no email column', () => {
  for (const [kind, files] of Object.entries(GUEST_TEMPLATES)) {
    for (const href of Object.values(files)) {
      const file = path.join(WEB, 'public', href);
      assert.ok(existsSync(file), `${href} is linked but not in public/`);
    }
    const header = readFileSync(path.join(WEB, 'public', files.csv), 'utf8').split(/\r?\n/)[0]!;
    const cols = header.split(',').map((c) => c.trim().toLowerCase());
    assert.equal(cols.includes('side'), kind === 'withSides', `${files.csv}: Side column`);
    assert.ok(!cols.some((c) => c.includes('email')), `${files.csv} must not ask for an email`);
    assert.ok(cols.includes('first name') && cols.includes('last name'), `${files.csv}: name columns`);
  }
});

test('the import page picks the file from the event, not a fixed one', () => {
  const src = readFileSync(PAGE, 'utf8');
  const picks = src.match(/guestTemplateFor\(eventHasSides\(/g) ?? [];
  assert.equal(picks.length, 1, 'the page must choose the template with guestTemplateFor(eventHasSides(…))');
  assert.ok(!/\/templates\/setnayan-guest-list/.test(src), 'the page hard-codes a template path');
  assert.ok(/Download for Excel \/ Numbers/.test(src), 'the download button copy is gone');
});
