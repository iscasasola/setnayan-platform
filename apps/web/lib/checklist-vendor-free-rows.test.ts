/**
 * checklist-vendor-free-rows.test.ts — owner 2026-09-25, verbatim: "i noticed
 * that simple event has questions for suppliers. the simple event is only for
 * our own services."
 *
 * `ensureChecklistSeeded` (checklist-actions.ts) seeds every vendor-free
 * (Simple Event) event from `GENERIC_EVENT_CHECKLIST_DEF` — "Choose your
 * venue", "Book catering / order food", "Book a photographer", "Book a host"
 * (category 'vendors') and "Set your budget" (a type whose profile never
 * turns the `budget` surface on) — a checklist for a marketplace this type
 * does not have.
 *
 * Seeding is TOP-UP-ONLY and never deletes (see that function's own
 * docblock), so filtering the template going forward does not touch an event
 * already seeded under the old one — every Simple Event created before this
 * fix keeps those rows in the database. `checklistItemAllowedForProfile`
 * (checklist.ts) is the ONE predicate both ends share:
 *   - the SEED path filters the template so a NEW event never gets the row;
 *   - the READ path (/checklist) filters the fetched rows so an OLD event's
 *     already-seeded row is hidden, not deleted — the couple's data stays
 *     intact in case the type is ever reprofiled.
 *
 * Gated on `marketplaceEnabled` / the `budget` surface — never on the type's
 * name — so any future vendor-free or budget-off type is covered too.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { checklistItemAllowedForProfile } from './checklist';
import { SIMPLE_PROFILE, WEDDING_PROFILE, GENERIC_PROFILE } from './event-type-profile';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = HERE; // this file already lives at apps/web/lib
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

// ── the pure predicate, exercised directly ──────────────────────────────────

test('checklistItemAllowedForProfile: a vendors-category task is dropped on a vendor-free profile', () => {
  assert.equal(SIMPLE_PROFILE.marketplaceEnabled, false, 'fixture sanity: Simple Event is vendor-free');
  assert.equal(
    checklistItemAllowedForProfile('vendors', 'celeb_venue', SIMPLE_PROFILE),
    false,
  );
});

test('checklistItemAllowedForProfile: a budget task is dropped when the budget surface is off', () => {
  assert.ok(
    !SIMPLE_PROFILE.enabledSurfaces.includes('budget'),
    'fixture sanity: Simple Event has no budget surface',
  );
  assert.equal(
    checklistItemAllowedForProfile('foundations', 'celeb_budget', SIMPLE_PROFILE),
    false,
  );
  // A 'foundations' task that is NOT a budget task must survive — the gate
  // matches the key, not just the category.
  assert.equal(
    checklistItemAllowedForProfile('foundations', 'celeb_purpose', SIMPLE_PROFILE),
    true,
  );
});

test('checklistItemAllowedForProfile: a marketplace-enabled, budget-on type is untouched', () => {
  for (const profile of [WEDDING_PROFILE, GENERIC_PROFILE]) {
    assert.equal(checklistItemAllowedForProfile('vendors', 'book_venue', profile), true);
    assert.equal(checklistItemAllowedForProfile('foundations', 'set_budget', profile), true);
  }
});

test('checklistItemAllowedForProfile: a non-vendors, non-budget task always survives', () => {
  assert.equal(checklistItemAllowedForProfile('guests', 'draft_guest_list', SIMPLE_PROFILE), true);
  assert.equal(checklistItemAllowedForProfile('logistics', 'celeb_program', SIMPLE_PROFILE), true);
});

// ── SEED path: checklist-actions.ts filters the template BEFORE building rows ──

test('ensureChecklistSeeded filters the per-type template through the profile gate', () => {
  const s = read('../app/dashboard/[eventId]/checklist-actions.ts');
  assert.match(
    s,
    /import\s*\{[^}]*checklistItemAllowedForProfile[^}]*\}\s*from\s*['"]@\/lib\/checklist['"]/,
    'must import the shared predicate rather than re-inventing a vendor/budget filter',
  );
  assert.match(
    s,
    /perTypeDef\.template\.filter\(\(t\) => checklistItemAllowedForProfile\(t\.category, t\.key, profile\)\)/,
    'the per-type template must be filtered through the gate before buildSeedRows sees it',
  );
  // Never keyed on the literal type name.
  assert.doesNotMatch(s, /eventType === ['"]simple_event['"]/);
});

// ── READ path: /checklist hides already-seeded rows, never deletes them ──────

test('the checklist page hides disallowed rows at READ time, after the profile is resolved', () => {
  const s = read('../app/dashboard/[eventId]/checklist/page.tsx');
  assert.match(
    s,
    /import\s*\{\s*resolveProfile\s*\}\s*from\s*['"]@\/lib\/event-type-profile['"]/,
    'the page must resolve the event-type profile to know the gate',
  );
  assert.match(
    s,
    /rawRows\.filter\(\(r\) =>\s*\n?\s*checklistItemAllowedForProfile\(r\.category, r\.template_key, checklistProfile\)/,
    'fetched rows must be filtered through the SAME predicate the seed path uses',
  );
  // The filter must not be a delete — no DELETE / .update against
  // event_checklist_items anywhere near this read.
  assert.doesNotMatch(
    s,
    /event_checklist_items['"]\)\s*\n?\s*\.delete\(/,
    'existing rows must be hidden, never deleted — a couple\'s data must survive a re-profile',
  );
});
