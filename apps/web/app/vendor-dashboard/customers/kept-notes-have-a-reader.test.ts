/**
 * kept-notes-have-a-reader.test.ts — the kept note is reachable by the person
 * who wrote it.
 *
 * Severing `vendor_client_notes.event_id` preserves the supplier's own working
 * note (owner 2026-08-24). The ONLY other reader is
 * `/vendor-dashboard/clients/[eventId]`, which filters `.eq('event_id', …)` — so
 * preservation WITHOUT this surface would keep every note and show none of them.
 *
 * 🔑 THAT IS THE "GATE WITH NO HANDLE", WHICH THIS REPO HAS FOUND FIVE TIMES: a
 * row written by real code, granted, tested, and reachable by nobody. The db
 * test proves the note survives; this proves somebody can see it.
 *
 * Assertions run over `stripComments` output — this file argues about mechanisms
 * in its own comments, and a guard a comment can satisfy is decoration.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
/*
  RE-AIMED 2026-10-10 (supplier redesign S-PR2). This file lived beside
  `clients/surface.tsx` and read it: the "Clients" fold was where the kept notes
  were shown. That second customer list is retired — outside clients and kept
  notes are part of Customers › People now ("one list, not two") — so the reader
  is the Customers page and the renderer is the roster. The three properties are
  the same three; the file moved with the code it guards.
  SABOTAGE: `.is('event_id', null)` dropped from the page's read → RED ·
  the roster's `keptNotes.length > 0 ?` made `false ?` → RED ·
  `keptRead.error ? []` made `false ? []` → RED.
*/
const PAGE = stripComments(readFileSync(resolve(HERE, 'page.tsx'), 'utf8'));
const ROSTER = stripComments(readFileSync(resolve(HERE, '_components', 'customers-roster.tsx'), 'utf8'));

test('the clients hub actually asks for the unfiled notes', () => {
  assert.ok(PAGE.length > 5_000 && ROSTER.length > 2_000, 'a source read came back short');
  const read = /from\('vendor_client_notes'\)[\s\S]{0,240}\.is\('event_id',\s*null\)/.exec(PAGE)?.[0] ?? '';
  assert.ok(read, 'nothing reads the kept notes — they would be preserved and permanently invisible');
  assert.match(read, /\.eq\('vendor_profile_id',\s*vendorProfileId\)/, 'and it must be scoped to this supplier');
});

test('it renders them, and from a LIVE branch', () => {
  /*
    ⚠ ANCHORED FROM THE CONDITION TO THE MAP, IN ONE MATCH. A bare
    `/keptNotes\.map\(/` passes while the whole block sits behind `{false ? (`
    — measured: that sabotage left this assertion green and only the error-check
    below went red. A guard that matches markup it cannot prove is reachable is
    the "file-level count" trap this repo keeps paying for.
  */
  assert.match(
    ROSTER,
    /\{keptNotes\.length > 0 \? \([\s\S]{0,2200}keptNotes\.map\(/,
    'the list must be rendered FROM the non-empty branch, not merely present',
  );
  assert.match(ROSTER, /Kept notes/, 'and the row must be named for a person reading it');
  assert.match(PAGE, /keptNotes=\{keptNotes\}/, 'the page read the notes and never handed them to the list');
});

test('a REFUSED read is not rendered as "you wrote none"', () => {
  // Supabase resolves with an error rather than throwing, so an unchecked read
  // degrades to an empty array and the section would silently claim the supplier
  // has no history. The section is hidden on failure instead.
  assert.match(PAGE, /if \(keptRead\.error\) \{\s*logQueryError\(/, 'the error must be checked');
  assert.match(
    PAGE,
    /const keptNotes: KeptNote\[\] = keptRead\.error\s*\? \[\]/,
    'a refused read must hand the list NOTHING — an empty list draws no row at all, never "you wrote none"',
  );
});
