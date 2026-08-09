/**
 * GUARD — a shop's web address may never become editable after creation.
 *
 * Owner 2026-08-10, twice: *"slug cannot be renamed so they need to pick their
 * preferred slug"*, then *"they can rename it during creation so they can check
 * which is available. but whatever they choose here will be permanent."*
 *
 * 🔑 THE TRAP THIS EXISTS FOR, AND IT IS NOT THE OBVIOUS ONE.
 * `updateVendorWebsiteField` checks a field against TWO sets:
 *   • `INLINE_WEBSITE_FIELDS` — the ALLOWLIST. Not in it → refused outright.
 *   • `PRO_WEBSITE_FIELDS`    — the TIER GATE. In it → Pro or above only.
 *
 * `business_slug` was in both. Removing it from `PRO_WEBSITE_FIELDS` alone —
 * the obvious reading of "it is no longer a Pro feature" — would have left it in
 * the allowlist with no tier gate, **handing the rename to Free, Verified and
 * Solo instead of taking it away.** The exact inverse of the ruling, from a
 * one-line edit that reads correct.
 *
 * So case 1 asserts the allowlist, not the tier gate. If someone re-adds the
 * field to `PRO_WEBSITE_FIELDS` this still fails, because the allowlist is what
 * decides.
 *
 * ⚠ THIS IS THE BUTTON, NOT THE DOOR. `vendor_profiles_owner` is `FOR ALL` on
 * `user_id = auth.uid()` and the column carries the `authenticated` grant, so a
 * vendor can PATCH `business_slug` straight through PostgREST with no UI
 * involved. The real boundary is the database trigger
 * `vendor_profiles_business_slug_immutable` (migration 20271124956492); this
 * suite guards the app half so the two cannot drift apart silently.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ACTIONS = readFileSync('app/vendor-dashboard/actions.ts', 'utf8');
const EDITOR = readFileSync(
  'app/vendor-dashboard/shop/_components/website-editor.tsx',
  'utf8',
);
const MATRIX = readFileSync('app/vendors/_components/vendor-tier-matrix.tsx', 'utf8');

/** The literal entries of a named `new Set([...])`, comments stripped. */
function setEntries(src: string, name: string): string[] {
  const i = src.indexOf(`const ${name} = new Set([`);
  assert.notEqual(i, -1, `${name} not found — this suite is measuring nothing`);
  const body = src.slice(i, src.indexOf(']);', i));
  const clean = body.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  return [...clean.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
}

test('META: both sets are readable, so the assertions below mean something', () => {
  const inline = setEntries(ACTIONS, 'INLINE_WEBSITE_FIELDS');
  const pro = setEntries(ACTIONS, 'PRO_WEBSITE_FIELDS');
  assert.ok(inline.length >= 4, `INLINE_WEBSITE_FIELDS looks empty: ${inline}`);
  assert.ok(pro.length >= 2, `PRO_WEBSITE_FIELDS looks empty: ${pro}`);
  // The tier gate must be a SUBSET of the allowlist, or a "Pro field" exists
  // that the allowlist refuses anyway — a gate guarding nothing.
  for (const f of pro) assert.ok(inline.includes(f), `${f} is Pro-gated but not allowlisted`);
});

test('the address is not editable from the website editor — at the ALLOWLIST', () => {
  const inline = setEntries(ACTIONS, 'INLINE_WEBSITE_FIELDS');
  assert.ok(
    !inline.includes('business_slug'),
    'business_slug is back in INLINE_WEBSITE_FIELDS. The address is permanent ' +
      '(owner 2026-08-10) — and note that removing it from PRO_WEBSITE_FIELDS ' +
      'instead would GRANT the rename to every tier rather than remove it.',
  );
});

test('and it is not a paid upgrade either', () => {
  const pro = setEntries(ACTIONS, 'PRO_WEBSITE_FIELDS');
  assert.ok(!pro.includes('business_slug'), 'business_slug is back in PRO_WEBSITE_FIELDS');
});

test('no writer for it survives in the website editor action', () => {
  // The `case` did more than write — it ran a four-namespace conflict check. That
  // check was not lost: it now runs on the /open-shop path, the only place an
  // address is ever set.
  assert.ok(
    !/case 'business_slug'\s*:/.test(ACTIONS),
    "a case 'business_slug' writer is back in updateVendorWebsiteField",
  );
});

test('the UI offers no rename, and does not dangle one as an upsell', () => {
  // Both halves matter. The padlocked Pro list is shown to exactly the tiers who
  // just typed their own address in the wizard — advertising a rename there is
  // selling something that no longer exists, to the people most likely to want it.
  const visible = EDITOR.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/[^\n]*/g, '');
  assert.ok(!/Change your address/.test(visible), 'the rename Row is back');
  assert.ok(!/slugVal|slugDirty/.test(visible), 'rename state is back in the editor');
});

test('the public price list no longer sells it', () => {
  const visible = MATRIX.replace(/\/\/[^\n]*/g, '');
  assert.ok(
    !/Custom URL \/ slug/.test(visible),
    'the tier matrix advertises "Custom URL / slug" again — it is free, on every ' +
      'tier, and can never be changed, so the row is false three ways',
  );
});

test('the tier cap itself is NOT dead — it still gates the premium page', () => {
  // The tempting fix was to flip `customWebsiteName` to true everywhere. It gates
  // the hero photo, the pinned review, the featured editorials AND the 2-column
  // public layout — flipping it would have handed Free and Solo the whole Pro
  // website. This asserts the cap kept real work, so a later reader does not
  // "clean up" a cap that looks unused from the slug's side alone.
  const pro = setEntries(ACTIONS, 'PRO_WEBSITE_FIELDS');
  assert.ok(pro.length > 0, 'PRO_WEBSITE_FIELDS is empty — customWebsiteName now gates nothing here');
  assert.ok(/caps\.customWebsiteName/.test(ACTIONS), 'the Pro gate no longer reads the cap');
});
