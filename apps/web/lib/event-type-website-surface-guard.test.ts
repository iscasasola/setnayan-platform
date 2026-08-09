/**
 * AN EVENT TYPE CANNOT BE SAVED WITH A DEAD PUBLIC PAGE. (Item 81.)
 *
 * `day_of` and `gallery` are not independent switches — both are pages OF the
 * couple's public event website, and `website` is the surface that makes that
 * site editable and carries the ONLY "go live" control. Ticking either while
 * Website is off builds a page no guest can ever open.
 *
 * This already happened once: `simple_event` shipped with day_of + gallery and
 * no website, and the owner reported it (2026-08-02, "the host of the event
 * cannot launch his on the day website"). Migration 20271102084500 repaired the
 * ROWS THAT EXISTED. Nothing stopped the next save from reintroducing it — the
 * admin editor's own default prefill for a fresh type omitted `website`.
 *
 * The sibling `event-type-launchable.test.ts` pins the hardcoded fallback
 * profiles. This file pins the SAVE PATH, and
 * `tests/db/event-type-website-surface.db.test.ts` pins every event type the
 * migrations actually produce.
 *
 * 🪤 The source assertions below are scoped to the FUNCTION BODY with comments
 * stripped — a whole-file grep would happily match this docblock and pass
 * forever on its own justification.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  SURFACES_THAT_RENDER_ON_THE_WEBSITE,
  surfacesStrandedWithoutWebsite,
  profileSurfacesStrandedWithoutWebsite,
  strandedWithoutWebsiteMessage,
  WEDDING_PROFILE,
  GENERIC_PROFILE,
  SIMPLE_PROFILE,
  TRAVEL_PROFILE,
  type EventTypeProfile,
} from './event-type-profile';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** Strip line + block comments so a source assertion can only match code. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
}

/** The body of a top-level `export async function <name>(` … up to the next
 *  top-level `export`/`function`/`const` declaration. */
function functionBody(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} not found — was it renamed?`);
  const after = src.slice(start + 1);
  const endRel = after.search(/\n(?:\/\*\*|export |const |function )/);
  const body = endRel >= 0 ? after.slice(0, endRel) : after;
  assert.ok(body.length > 200, `extracted ${name} body looks truncated`);
  return body;
}

/* ────────────────── the rule itself ────────────────── */

test('day_of or gallery with no website is refused; every other combination is fine', () => {
  assert.deepEqual(surfacesStrandedWithoutWebsite(['day_of']), ['day_of']);
  assert.deepEqual(surfacesStrandedWithoutWebsite(['gallery']), ['gallery']);
  assert.deepEqual(surfacesStrandedWithoutWebsite(['day_of', 'gallery']), [
    'day_of',
    'gallery',
  ]);
  // …the exact shape the owner hit: simple_event's original surface list.
  assert.deepEqual(
    surfacesStrandedWithoutWebsite(['seating', 'schedule', 'day_of', 'gallery']),
    ['day_of', 'gallery'],
  );

  // Website present ⇒ launchable.
  assert.deepEqual(surfacesStrandedWithoutWebsite(['website', 'day_of', 'gallery']), []);
  // Neither dependent surface ⇒ nothing to strand (a type with no public page).
  assert.deepEqual(surfacesStrandedWithoutWebsite(['seating', 'budget', 'schedule']), []);
  assert.deepEqual(surfacesStrandedWithoutWebsite([]), []);
  // The rule must not over-reach onto surfaces that do NOT render on the site.
  assert.deepEqual(surfacesStrandedWithoutWebsite(['rsvp', 'save_the_date', 'monogram']), []);
});

test('the dependent set is exactly day_of + gallery — widening it needs a decision', () => {
  // Pinned deliberately. Adding a surface here silently forbids combinations
  // admins can save today, which is a product call, not a refactor.
  assert.deepEqual([...SURFACES_THAT_RENDER_ON_THE_WEBSITE], ['day_of', 'gallery']);
});

test('the refusal message names the surfaces and both ways out', () => {
  const msg = strandedWithoutWebsiteMessage(['day_of', 'gallery']);
  assert.match(msg, /Day-of page and Gallery/);
  assert.match(msg, /Tick Website/, 'must offer the fix');
  assert.match(msg, /untick/, 'must offer the other fix — refusal, not correction');
  assert.doesNotMatch(
    msg,
    /enabled_surfaces|day_of|profileRedirect|event_type_profiles/,
    'admin-facing copy must not leak column or flag names',
  );
});

/* ────────────── every event type declared in CODE ────────────── */

const ALL_PROFILES: readonly EventTypeProfile[] = [
  WEDDING_PROFILE,
  GENERIC_PROFILE,
  SIMPLE_PROFILE,
  TRAVEL_PROFILE,
];

test('🚨 EVERY hardcoded fallback profile satisfies the invariant', () => {
  assert.ok(ALL_PROFILES.length >= 4, 'profile roster shrank — an empty loop passes');
  for (const p of ALL_PROFILES) {
    assert.deepEqual(
      profileSurfacesStrandedWithoutWebsite(p),
      [],
      `${p.eventType} enables a page that renders on the public event site but ` +
        `has no 'website' surface, so its host can never make that site live.`,
    );
  }
});

/* ────────────── the SAVE PATH refuses, before it writes ────────────── */

test('🚨 the admin save path refuses a violating combination BEFORE the upsert', () => {
  const body = stripComments(
    functionBody(read('app/admin/event-types/actions.ts'), 'upsertEventTypeProfile'),
  );

  const checkAt = body.indexOf('surfacesStrandedWithoutWebsite(');
  assert.ok(
    checkAt >= 0,
    'upsertEventTypeProfile no longer validates the surface combination — a ' +
      'day-of page with no website can be saved again.',
  );

  // It must actually REFUSE, not log and continue.
  assert.match(
    body.slice(checkAt),
    /profileRedirect\([^)]*'error'[^)]*strandedWithoutWebsiteMessage\(/,
    'the check must redirect with an error; computing it and carrying on is a ' +
      'guard that refuses in silence.',
  );

  // …and refuse BEFORE the row reaches the database. Validating after the write
  // would show the message while the dead combination is already stored.
  const upsertAt = body.indexOf('.upsert(');
  assert.ok(upsertAt >= 0, "upsertEventTypeProfile no longer calls .upsert() — recheck this guard");
  assert.ok(
    checkAt < upsertAt,
    'the surface check runs AFTER the upsert — the violating row is written ' +
      'first and the error message arrives too late to prevent it.',
  );
});

test('🪤 the editor prefill for a NEW event type is itself saveable', () => {
  // The default handed to a type with no profile row yet must pass the very
  // rule the save path enforces — otherwise the first save of every new event
  // type is refused and the feature reads as broken.
  const page = read('app/admin/event-types/[eventType]/profile/page.tsx');
  const decl = stripComments(page).match(/const GENERIC_SURFACES = new Set\(\[([\s\S]*?)\]\)/);
  assert.ok(decl?.[1], 'GENERIC_SURFACES prefill not found — was it renamed?');
  const prefill = [...decl[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1] as string);
  assert.ok(prefill.length >= 5, `prefill parsed as ${prefill.length} surfaces — parser drifted`);
  assert.deepEqual(
    surfacesStrandedWithoutWebsite(prefill),
    [],
    `the new-event-type default (${prefill.join(', ')}) is a combination the ` +
      `save path refuses.`,
  );
});
