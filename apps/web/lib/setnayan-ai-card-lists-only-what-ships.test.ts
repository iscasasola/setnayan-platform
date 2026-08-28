/**
 * The Setnayan AI card sits directly above a buy button. Everything on it is a
 * promise with a price attached.
 *
 * ── WHAT THIS COST ──────────────────────────────────────────────────────────
 * A verification pass on 2026-08-12 read every claim on that card against the
 * shipped code. Of nine, FOUR should not have been there:
 *
 *   • `first_inquiry` "Sends your first inquiry to the best fit" — NO
 *     implementation existed anywhere in the repo. Three hits total: the id, the
 *     icon, and the sentence. The only inquiry fan-out that exists is the FREE
 *     one at sign-up.
 *   • `chase` "Chases the vendors who go quiet" — fires internally, but it is a
 *     "secretary" message and notifications carry GUARDS only, while the home
 *     rail is handed an empty inquiry list. Blocked twice over; it has never
 *     reached a single person.
 *   • `distance` "Sorts by distance to your venue" — FREE. Nearest-first is the
 *     default order for everyone.
 *   • `rank` "Ranks every vendor by how well they fit" — the "% match" is FREE
 *     too. `category-search.ts` says it outright: *the paid layer is the
 *     concierge, not the score*. Reworded rather than removed, because the
 *     SUGGESTED TEAM's rank mode genuinely is paid.
 *
 * 🔑 A CARD CAN LIE IN TWO DIRECTIONS. Selling something unbuilt takes money for
 * nothing; selling something already free takes money for nothing just as much.
 * Under-claiming is the third failure — dropping `rank` entirely would have
 * hidden a real paid capability. All three are wrong, so this guard pins the
 * exact id set rather than a count.
 *
 * ⚠ THE REMOVED ONES ARE COMING BACK. The owner's ruling is BUILD them, not
 * delete them. When one genuinely works, add its id here in the same commit
 * that makes it work — that is the whole point of the list being explicit.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...seg: string[]) => readFileSync(join(WEB, ...seg), 'utf8');

const CARD = read(
  'app', 'dashboard', '[eventId]', 'studio', 'setnayan-ai',
  '_components', 'setnayan-ai-value-copy.ts',
);

/** Ids that may appear on the paid card, each verified against shipped code. */
const SHIPS = new Set([
  'rank',            // suggested-team rank mode: compat vs cheapest — PAID
  'deadlines',       // per-service + statutory deadline layer — PAID
  'next_move',       // the single most urgent move on the home briefing — PAID
  'payments',        // payment-due guard + the day-before email — PAID
  'budget',          // over-budget guard — PAID
  'demand',          // someone else eyeing your date — PAID
  'price_watch',     // watched vendor raises their price — PAID
  'date_watch',      // watched vendor booked on your date, or frees up — PAID
  'schedule_clash',  // two things clash in the run-of-show — PAID
]);

/** Removed, with the reason. Re-adding one without building it is the bug. */
const NOT_YET: Record<string, string> = {
  first_inquiry:
    'no implementation exists — the only inquiry fan-out is the FREE one at sign-up',
  chase:
    'fires internally but reaches nobody: notifications are guards-only and the '
    + 'home rail gets an empty inquiry list',
  distance: 'FREE — nearest-first is the default order for everyone',
};

function idsOnCard(): string[] {
  return [...CARD.matchAll(/^\s*id: '([a-z_]+)',/gm)].map((m) => m[1]!);
}

test('the card lists exactly the capabilities that ship', () => {
  const ids = idsOnCard();
  assert.ok(
    ids.length >= 8,
    `only ${ids.length} capabilities parsed from the card — this guard has gone blind`,
  );

  const sold = new Set(ids);
  const unbuilt = [...sold].filter((id) => id in NOT_YET);
  assert.deepEqual(
    unbuilt.map((id) => `${id} — ${NOT_YET[id]}`),
    [],
    'The paid card is advertising something the product does not do, directly '
      + 'above a buy button. Build it, or take it off the card.',
  );

  const unknown = [...sold].filter((id) => !SHIPS.has(id) && !(id in NOT_YET));
  assert.deepEqual(
    unknown,
    [],
    'A new capability appeared on the paid card without being added to SHIPS. '
      + 'Adding it there is a statement that you checked it against the code — '
      + 'do not add it to silence this test.',
  );
});

test('🔴 the two FREE features stay off the paid card', () => {
  // The specific regression. Both were sold as paid benefits while every couple
  // already had them, and both are one careless copy edit from coming back.
  const ids = new Set(idsOnCard());
  assert.equal(ids.has('distance'), false, 'distance sorting is free for everyone');
  /**
   * 🪤 THIS ASSERTION WAS BRITTLE AND ONE OF ITS TWO ALTERNATIVES COULD NEVER
   * MATCH (found 2026-08-28, while shortening the card). It pinned two EXACT
   * strings:
   *   • the concierge phrase — which lives in a comment and is WRAPPED across
   *     two `//` lines, so the regex never matched it and never could;
   *   • the old body wording — so the whole guard rested on one sentence
   *     surviving verbatim. Rewording the same true claim turned it red.
   *
   * 🔑 A GUARD THAT PINS A SENTENCE IS PINNING THE PROSE, NOT THE PROMISE. What
   * must stay true is that the card SAYS the % match is free; how it says so is
   * a copy decision, so the match is on the claim, not on one sentence.
   *
   * 🪤 AND THE FIRST REPAIR WAS WORSE THAN THE BRITTLENESS. It normalised `//`
   * away so the wrapped COMMENT would count — and then deleting the disclaimer
   * from the visible body left the guard GREEN, because the comment alone
   * satisfied it. Caught by mutation, not by review. **A customer does not read
   * comments**, so the assertion now runs on comment-stripped source only.
   */
  const rendered = CARD.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(
    rendered.replace(/\s+/g, ' '),
    /“% match”[^.]{0,60}free/,
    'the rank entry must keep saying the % match itself is free, or it drifts '
      + 'back into claiming a free feature',
  );
});

test('🔴 buying Setnayan AI can be undone — the off-ramp exists and ACTS', () => {
  // Until 2026-08-12 the flip between guided and manual had ZERO callers: the
  // product could be bought and never switched off. Worse, a button reading
  // "Turn on Assisted planning" was a LINK to /dashboard, a page with no such
  // control — it spent the one moment someone was willing to act.
  const PAGE = read(
    'app', 'dashboard', '[eventId]', 'studio', 'setnayan-ai', 'page.tsx',
  );
  const forms = [...PAGE.matchAll(/<form\b[\s\S]*?<\/form>/g)].map((m) => m[0]);
  const posting = forms.filter((f) => /action=\{setPlanningMode\}/.test(f));

  assert.ok(
    posting.some((f) => /name="mode" value="guided"/.test(f)),
    'no form turns Assisted planning ON — if it is a <Link>, it is not a control',
  );
  assert.ok(
    posting.some((f) => /name="mode" value="manual"/.test(f)),
    'no form turns Assisted planning OFF — nobody should be able to buy '
      + 'something they cannot stop',
  );
  // Both need the event, or the action throws rather than flipping anything.
  for (const f of posting) {
    assert.match(f, /name="event_id"/, 'a planning-mode form must carry event_id');
  }
});
