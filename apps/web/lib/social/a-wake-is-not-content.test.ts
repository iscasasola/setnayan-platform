/**
 * a-wake-is-not-content.test.ts — the recap auto-post must ask the solemn
 * register, and must SELECT the column it asks about.
 *
 * ── The defect ─────────────────────────────────────────────────────────────
 * `/[slug]/recap` already refuses a solemn event in BOTH arms — the metadata
 * arm so it is not indexed, the render arm so it is not served (`notFound()`).
 * `isRecapSocialShareAllowed` did not ask at all. It checked the couple's
 * opt-out and the landing page's visibility, and nothing else.
 *
 * So the same recap the PAGE refuses to show could be composed for Setnayan's
 * OWN Facebook Page and Instagram — a bereaved family's farewell, marketing the
 * platform. Nothing upstream would have stopped it:
 *   · `recap_autopost_enabled` defaults ON (`val !== false`), and is TRUE in
 *     production — measured 2026-09-15;
 *   · the couple's per-event opt-out defaults to ALLOWED (NULL);
 *   · `publishRecap` does not consult the register either.
 *
 * ⚠ Nothing was ever posted: production holds **0 solemn events** and **0**
 * `event_recap` social posts. This is a gate closed before the first wake, not
 * a leak cleaned up after one. That is the only reason it is a quiet fix.
 *
 * ── Two properties, and the second is the one a reviewer would miss ────────
 * 1. the gate CONSULTS the register (`eventWordsFor(...).solemn`);
 * 2. the read SELECTS `event_type`.
 *
 * 🔑 Without (2), (1) is theatre: the column would arrive `undefined`, the
 * register would resolve the default profile, `solemn` would be false, and
 * every wake would pass a gate that appears to ask. **A check on a field the
 * query never fetched fails open and reads as a check.**
 *
 * ⚠ A SOURCE-TEXT GUARD IS THE WEAK KIND, used here knowingly and for the same
 * reason `a-sample-says-what-it-is.test.ts` uses one on the recap route: the
 * gate takes a live admin client and `eventWordsFor` resolves a profile from the
 * database, so there is no pure seam to call. It would pass a gate that reads
 * `.solemn` and ignores it. **It exists to stop the gate being deleted — which
 * is how the page's own refusal came to be doubted — not to prove it works.**
 * The behaviour is proven by the refusal in the gate itself.
 *
 * 🛡 Mutation-checked: removing the `.solemn` line goes RED; dropping
 * `event_type` from the select goes RED on the second property while the first
 * still passes — which is precisely the failure that would otherwise ship.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE = stripComments(readFileSync(join(HERE, 'recap-post.ts'), 'utf8'));

test('the recap share gate asks the solemn register', () => {
  assert.match(
    GATE,
    /eventWordsFor\([^)]*\)\s*\)\s*\.solemn/,
    'isRecapSocialShareAllowed must ask eventWordsFor(...).solemn. The recap PAGE refuses a ' +
      'wake in both arms; a gate that posts it to Setnayan\'s own Facebook and Instagram ' +
      'instead is the same recap by another door.',
  );
});

test('and it SELECTS the column it asks about', () => {
  const selects = GATE.match(/\.select\(\s*[`'"][^`'"]*[`'"]/g) ?? [];
  const eventsSelect = selects.find((s) => s.includes('recap_social_optout_at'));
  assert.ok(eventsSelect, 'the events read in the share gate was not found — has it been renamed?');
  assert.match(
    eventsSelect,
    /event_type/,
    'the share gate asks the register about event_type but never SELECTS it. The column would ' +
      'arrive undefined, the register would resolve the default profile, solemn would be false, ' +
      'and every wake would pass a gate that appears to ask. A check on a field the query never ' +
      'fetched fails open and reads as a check.',
  );
});
