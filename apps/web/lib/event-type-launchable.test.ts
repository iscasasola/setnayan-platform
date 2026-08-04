/**
 * AN EVENT TYPE WITH A DAY-OF PAGE MUST BE ABLE TO LAUNCH IT.
 *
 * Owner, 2026-08-02: *"the host of the event cannot launch his on the day
 * website."* `simple_event` enabled `day_of` and `gallery` but not `website`.
 *
 * Those are not independent switches. `day_of` and `gallery` RENDER ON the
 * public event site; `website` is what makes that site editable and carries the
 * ONLY "go live" control. There are exactly two launch buttons in the product
 * and both sit behind a surface check:
 *
 *   /dashboard/[id]/studio/save-the-date  → requires 'save_the_date'
 *   /dashboard/[id]/website/editor        → requires 'website'
 *
 * A simple-event host had neither, so both redirected them away and their site
 * stayed private FOREVER — taking the guest camera, the personal QR and the
 * gallery with it, since all three live on that site.
 *
 * 🪤 THE SHAPE OF THE BUG: every individual gate was correct. The redirect was
 * right, the surface list was a deliberate scope choice, and each read
 * defensibly on its own. What nothing checked was whether the combination left
 * a way IN. Same family as the circular buy gate — correct logic, and nothing
 * beside it asking whether the door could ever be opened.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  WEDDING_PROFILE,
  GENERIC_PROFILE,
  SIMPLE_PROFILE,
  TRAVEL_PROFILE,
  type EventTypeProfile,
} from './event-type-profile';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const ALL_PROFILES: readonly EventTypeProfile[] = [
  WEDDING_PROFILE,
  GENERIC_PROFILE,
  SIMPLE_PROFILE,
  TRAVEL_PROFILE,
];

test('🚨 day_of or gallery ⇒ website, for EVERY profile', () => {
  for (const p of ALL_PROFILES) {
    const s = p.enabledSurfaces as readonly string[];
    const needsSite = s.includes('day_of') || s.includes('gallery');
    if (!needsSite) continue;
    assert.ok(
      s.includes('website'),
      `${p.eventType} renders a day-of page or gallery on the public event site ` +
        `but has no 'website' surface — so its host is redirected out of the only ` +
        `"go live" control and the site can never be opened by a guest.`,
    );
  }
});

test('simple_event specifically — the type the owner was blocked on', () => {
  assert.ok(SIMPLE_PROFILE.enabledSurfaces.includes('website'));
  assert.ok(SIMPLE_PROFILE.enabledSurfaces.includes('day_of'));
});

test('but a simple event still gets NO Save-the-Date or RSVP', () => {
  // The original scope choice was right about these — a dinner does not send a
  // save-the-date. Only the website half was the dead end, so fixing it must
  // not quietly hand simple events the whole wedding stack.
  for (const notForSimple of ['save_the_date', 'rsvp', 'budget']) {
    assert.ok(
      !SIMPLE_PROFILE.enabledSurfaces.includes(notForSimple as never),
      `simple_event must not gain '${notForSimple}'`,
    );
  }
});

test('the DB row is repaired too, not just the code fallback', () => {
  // resolveProfile PREFERS event_type_profiles.enabled_surfaces and only falls
  // back to the hardcoded profile when no row exists. Fixing TypeScript alone
  // leaves the seeded row broken — and the seeded row is what prod reads.
  const sql = readFileSync(
    join(
      WEB,
      '../../supabase/migrations/20271102084500_event_types_with_day_of_need_the_website_surface.sql',
    ),
    'utf8',
  );
  assert.match(sql, /array_append\(enabled_surfaces, 'website'\)/);
  assert.match(
    sql,
    /'day_of' = ANY\(enabled_surfaces\) OR 'gallery' = ANY\(enabled_surfaces\)/,
    'the repair must be DERIVED from the combination, not a hardcoded event ' +
      'type — a type added later with the same shape should be covered by the ' +
      'rule rather than reintroducing the dead end',
  );
  assert.match(
    sql,
    /NOT \('website' = ANY\(enabled_surfaces\)\)/,
    'and idempotent — re-running must change nothing',
  );
});

test('🪤 the launch control still exists in exactly the two known places', () => {
  // If a third appears with its own surface gate, this bug can return through
  // it. If one is DELETED, a type that relies on it loses its only door.
  const editor = read('app/dashboard/[eventId]/website/editor/page.tsx');
  const std = read('app/dashboard/[eventId]/studio/save-the-date/page.tsx');
  assert.match(editor, /<LaunchStdButton/, 'the website editor must keep its launch control');
  assert.match(std, /<LaunchStdButton/);
  // …and the editor's gate must be the surface simple_event now has.
  assert.match(editor, /surfaceEnabled\(profile, 'website'\)/);
});
