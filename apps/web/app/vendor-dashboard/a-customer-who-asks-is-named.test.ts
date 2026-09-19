/**
 * a-customer-who-asks-is-named.test.ts — the supplier surfaces OTHER than the
 * Customers roster that showed a stand-in for a couple whose event has a name.
 *
 * Owner, 2026-09-19, on a couple who had just asked to lock: "the information
 * just became customer instead of the full detail of the user. fix this." The
 * roster's own guard lives in `lib/vendor-customer-pipeline.test.ts`; this file
 * pins the two sibling surfaces found by the same sweep:
 *
 *   1. TODAY's booking-ask card (answerable AND lapsed) printed a hard-coded
 *      "A couple wants to book you" while `fetchEventMeta` had already read the
 *      couple's `display_name` for the card next to it.
 *   2. The Clients tab's "In conversation" list read `t.event?.display_name` —
 *      an RLS embed a vendor can never read — so every row said
 *      "A Setnayan event".
 *
 * "A couple" / "A Setnayan event" survive ONLY as the null-name fallback.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../../lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const code = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

const SECTIONS = code('_components/overview-sections.tsx');
const OVERVIEW = code('../../lib/vendor-overview.ts');
const CLIENTS = code('clients/surface.tsx');

test('both booking-ask cards on Today name the couple, not "A couple"', () => {
  const named = SECTIONS.match(/\{card\.coupleName\} (wants|asked) to book you/g) ?? [];
  // Print what was found so a zero cannot pass as a match.
  assert.equal(named.length, 2, `expected 2 named headlines, found ${named.length}: ${named}`);
  assert.ok(
    !/>\s*A couple (wants|asked) to book you/.test(SECTIONS),
    'a Today booking-ask card is printing a hard-coded "A couple" again',
  );
});

test('the booking-ask cards carry the admin-read name, with "A couple" only for null', () => {
  const builds = OVERVIEW.match(/kind: 'lock_request(_lapsed)?',[\s\S]{0,200}?coupleName: meta\?\.displayName \?\? 'A couple'/g) ?? [];
  assert.equal(builds.length, 2, `expected both lock_request builders to set coupleName, found ${builds.length}`);
});

test('the Clients "In conversation" list does not read the RLS-nulled event embed', () => {
  assert.ok(
    !/t\.event\?\.display_name/.test(CLIENTS),
    'the Clients list reads t.event?.display_name — a vendor holds no events RLS, so it is always null',
  );
  assert.match(
    CLIENTS,
    /\{who\.displayName \?\? 'A Setnayan event'\}/,
    'the Clients list no longer names the couple from the admin-scoped read',
  );
});
