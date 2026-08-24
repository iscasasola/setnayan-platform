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
const SURFACE = stripComments(readFileSync(resolve(HERE, 'surface.tsx'), 'utf8'));

test('the clients hub actually asks for the unfiled notes', () => {
  assert.match(
    SURFACE,
    /from\('vendor_client_notes'\)[\s\S]{0,240}\.is\('event_id',\s*null\)/,
    'nothing reads the kept notes — they would be preserved and permanently invisible',
  );
  assert.match(
    SURFACE,
    /\.eq\('vendor_profile_id',\s*profile\.vendor_profile_id\)/,
    'and it must be scoped to this supplier',
  );
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
    SURFACE,
    /keptNotesMeasured && keptNotes\.length > 0 \?[\s\S]{0,900}keptNotes\.map\(/,
    'the list must be rendered FROM the measured-and-non-empty branch, not merely present',
  );
  assert.match(SURFACE, /Kept notes/, 'and the section must be named for a person reading it');
});

test('a REFUSED read is not rendered as "you wrote none"', () => {
  // Supabase resolves with an error rather than throwing, so an unchecked read
  // degrades to an empty array and the section would silently claim the supplier
  // has no history. The section is hidden on failure instead.
  assert.match(SURFACE, /keptNotesError/, 'the error must be checked');
  assert.match(
    SURFACE,
    /keptNotesMeasured && keptNotes\.length > 0/,
    'and the section must require a MEASURED read, not just a non-empty array',
  );
});
