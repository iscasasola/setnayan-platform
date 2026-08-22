import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * the-cure-was-already-written-down.test.ts
 *
 * 🚨 A BARE `events!inner` FROM `event_vendors` IS REFUSED BY POSTGREST.
 * There is ONE direct foreign key to `events` and — measured against
 * production — NINETEEN junction tables that also join the two, so PostgREST
 * finds many ways to reach `events` and refuses the whole query with PGRST201
 * rather than guessing.
 *
 * Three sites carried it. Each failed silently, and each lost something a
 * person was supposed to see:
 *   · the ripe-review sweep — no supplier ever flipped to `delivered` after
 *     the event, so no review-request notification has ever been sent;
 *   · the same-date hold warning — the caution that another couple is holding
 *     this supplier on your date, never once shown;
 *   · the wizard's same-date exclusion — suppliers already booked that day
 *     recommended anyway.
 *
 * 🔑 AND THE CURE WAS ALREADY WRITTEN DOWN. `lib/ghosting.ts` carries the exact
 * fix plus a comment saying that query had already been killed silently TWICE.
 * It never propagated to its three siblings. That is what this guard is for.
 *
 * 🛡 Mutation-checked by occurrence count.
 */

const WEB = dirname(dirname(fileURLToPath(import.meta.url)));
const SKIP = new Set(['node_modules', '.next', '.git', 'public']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

/** Source with comments removed — every fix here quotes the string it bans. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/*
  The scan: for every `.from('event_vendors')`, look at the `.select(...)` that
  follows it and require that any `events` embed names the foreign key.

  ⚠ Bounded by STRUCTURE, not by a character window that happens to work today:
  the slice ends at the next `.from(` so one file's second query can never be
  read as part of the first.
*/
function ambiguousEventVendorEmbeds(): string[] {
  const bad: string[] = [];
  for (const file of walk(WEB)) {
    const src = code(file);
    let i = src.indexOf(".from('event_vendors')");
    while (i >= 0) {
      const nextFrom = src.indexOf('.from(', i + 10);
      const chain = src.slice(i, nextFrom === -1 ? src.length : nextFrom);
      // Any embed of `events` in this chain must carry the FK hint.
      const embeds = chain.match(/events!\w*/g) ?? [];
      for (const e of embeds) {
        if (!e.startsWith('events!event_vendors_event_id_fkey')) {
          bad.push(`${file.slice(WEB.length + 1)} → ${e}`);
        }
      }
      // A hint-less embed written as plain `events(` is equally refused.
      if (/[,\s]events\(/.test(chain)) bad.push(`${file.slice(WEB.length + 1)} → events(`);
      i = src.indexOf(".from('event_vendors')", i + 10);
    }
  }
  return bad;
}

test('no query embeds events from event_vendors without naming the foreign key', () => {
  assert.deepEqual(
    ambiguousEventVendorEmbeds(),
    [],
    'PostgREST refuses these with PGRST201 and the only symptom is an absence',
  );
});

/*
  The three sites, named. A guard that only counts is a guard that passes when
  somebody deletes the query instead of fixing it.
*/
test('the three sites that were broken now name the key, and still filter on it', () => {
  const vendors = code('app/dashboard/[eventId]/vendors/page.tsx');
  const wizard = code('lib/wizard-recommendations.ts');

  assert.match(vendors, /event:events!event_vendors_event_id_fkey!inner\(event_date\)/);
  assert.equal(
    (vendors.match(/event:events!event_vendors_event_id_fkey!inner/g) || []).length,
    2,
    'both the ripe-review sweep and the same-date hold warning',
  );
  // The filters must follow the alias, or the query is refused a different way.
  assert.match(vendors, /\.lt\('event\.event_date', cutoffIso\)/, 'the review sweep filter');
  assert.match(vendors, /\.eq\('event\.event_date', eventDate\)/, 'the same-date hold filter');

  assert.match(
    wizard,
    /event:events!event_vendors_event_id_fkey!inner\(event_date, deleted_at\)/,
  );
  assert.match(wizard, /\.eq\('event\.event_date', eventDate\)/);
  assert.match(wizard, /\.is\('event\.deleted_at', null\)/);
});

/*
  ⚠ `event_members` is NOT affected and is deliberately left alone — measured
  against production, it has one direct foreign key to `events` and ZERO
  junction tables joining the two, so a bare `events!inner` there is
  unambiguous. Asserted so nobody "fixes" it into a hint that does not exist.
*/
test('the event_members embeds are left alone', () => {
  const rail = code('app/_components/frontdoor/rail-data.ts');
  const pending = code('lib/pending-inquiries.ts');
  assert.match(rail, /events!inner\(archived\)/);
  assert.match(pending, /events!inner\(event_id, style_preferences\)/);
});
