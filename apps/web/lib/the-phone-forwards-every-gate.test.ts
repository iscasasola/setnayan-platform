/**
 * the-phone-forwards-every-gate.test.ts
 *
 * ── THE BUG THIS EXISTS FOR ────────────────────────────────────────────────
 * `CustomerBottomNav` built the phone's menu with
 *
 *     buildCustomerMenuTree(eventId, { phase, dayOfOpen: false, hideKeys, seatingEnabled })
 *
 * and `websiteEnabled` was simply not in that object. The plan-phase Event Hub
 * Controller row is gated on it, so the flag arrived `undefined`, the gate read
 * that as "this event has no website surface", and **the tab never rendered on
 * a planning phone at all.** The day-of and after rosters build their `launch`
 * row ungated, so it appeared the moment the wedding arrived — which is why
 * nobody found it. The bug only existed before the day, and before the day is
 * when the Hub is the product.
 *
 * ── 🛑 AND WHY THE EXISTING TEST COULD NOT SEE IT ──────────────────────────
 * `one-menu-word-in-all-three-phases.test.ts` checks the same row in all three
 * phases and passes. Its helper reads:
 *
 *     buildCustomerMenuTree(EVENT_ID, { websiteEnabled: true, ... })
 *
 * 🔑 **IT SUPPLIES THE VERY INPUT WHOSE ABSENCE IS THE BUG.** It proves the
 * BUILDER is right and says nothing about what the phone hands it. A guard that
 * feeds itself the answer can never go red, and it will keep passing for as
 * long as the defect lives. That test is correct about its own subject; the
 * missing subject is the CALLER.
 *
 * ── SO THIS ASSERTS THE CALLERS, NOT THE BUILDER ───────────────────────────
 * Every production call site of `buildCustomerMenuTree` must forward every gate
 * the builder can read. Checked by parsing the call's own options object, with
 * comments stripped first — a gate named only in a docblock is a gate nobody
 * forwards, and a word-anywhere-in-the-file grep would happily convict the
 * comment that explains the fix.
 *
 * ⚠ THE LIST OF GATES IS DERIVED FROM THE BUILDER'S OWN OPTIONS TYPE, never
 * retyped here. A gate added tomorrow joins this assertion by existing, which
 * is the only version of this test that cannot rot into a list of yesterday's
 * fields.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(import.meta.dirname, '..');
const MENU_SRC = stripComments(readFileSync(join(WEB, 'lib/customer-menu.ts'), 'utf8'));

/**
 * The gates the builder actually READS — `ctx.<name>` inside its body, not the
 * options type's field list. `slug` is declared and read nowhere (its own
 * docblock says it stays only because callers pass it), so demanding callers
 * forward it would be demanding a ritual rather than a behaviour.
 */
const GATES = [...new Set([...MENU_SRC.matchAll(/\bctx\.([A-Za-z_]\w*)/g)].map((m) => m[1]!))]
  .filter((g) => g !== 'phase' && g !== 'eventId')
  .sort();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Each production `buildCustomerMenuTree(...)` call, as {file, optionsText}. */
function callSites(): { file: string; opts: string }[] {
  const found: { file: string; opts: string }[] = [];
  for (const file of [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const m of src.matchAll(/buildCustomerMenuTree\s*\(/g)) {
      // Skip the declaration itself.
      if (/export function\s*$/.test(src.slice(Math.max(0, m.index - 24), m.index))) continue;
      // Take from the opening brace of the options object to its matching close.
      const rest = src.slice(m.index);
      const brace = rest.indexOf('{');
      const close = rest.indexOf('}', brace);
      if (brace === -1 || close === -1) continue;
      found.push({ file: relative(WEB, file), opts: rest.slice(brace + 1, close) });
    }
  }
  return found;
}

/* ══ 0 · THE PREMISE — otherwise everything below is vacuously true ═══════ */

test('the premise: the builder reads gates, and production calls it', () => {
  assert.ok(
    GATES.includes('websiteEnabled'),
    `the builder no longer reads ctx.websiteEnabled — gates found: ${GATES.join(', ')}`,
  );
  assert.ok(GATES.length >= 3, `only ${GATES.length} gate(s) parsed — the regex stopped matching`);
  const sites = callSites();
  assert.ok(sites.length >= 2, `found ${sites.length} call site(s) — the parse found nothing to check`);
});

/* ══ 1 · THE ASSERTION ════════════════════════════════════════════════════ */

test('🔴 every phone/dock menu caller forwards every gate the builder reads', () => {
  for (const { file, opts } of callSites()) {
    for (const gate of GATES) {
      assert.ok(
        new RegExp(`\\b${gate}\\b`).test(opts),
        `${file} calls buildCustomerMenuTree without \`${gate}\` — the builder gates a row on ` +
          `it, so that row silently disappears from this surface and nothing renders red. ` +
          `Forward it from the layout, which already resolves it.`,
      );
    }
  }
});

/* ══ 2 · THE ROW ITSELF, THROUGH THE GATE THE CALLER NOW SENDS ════════════ */

test('🔒 the plan-phase Hub row is present when enabled and absent when not', async () => {
  const { buildCustomerMenuTree } = await import('./customer-menu');
  const keys = (websiteEnabled: boolean) =>
    buildCustomerMenuTree('EVT123', { websiteEnabled }).map((m) => m.key as string);

  assert.ok(
    keys(true).includes('launch'),
    'the plan phone roster has no Event Hub Controller row even with the surface enabled',
  );
  // And the gate is a real gate, not decoration — otherwise forwarding it would
  // be pointless and this whole file would be guarding nothing.
  assert.ok(
    !keys(false).includes('launch'),
    'the gate does not gate: an event with no website surface is still offered the Hub',
  );
});

/* ══ 3 · THE GATE HAS NO NEGATIVE CASE — measured, not assumed ═══════════ */

/**
 * 🛑 A CORRECTION TO THIS FILE'S OWN PREVIOUS SECTION, 2026-09-24.
 *
 * It used to carry a test called *"📌 OPEN: day-of and after show the Hub even
 * with no website surface"*, raised to the owner as a decision he had to make:
 * the plan phase gates the Hub row on `websiteEnabled`, the day-of and after
 * rosters do not, so an event kind with no website surface would be offered a
 * Hub it does not have.
 *
 * **It was not a question.** Owner, verbatim: *"all events has a website"* —
 * *"the only difference is the type of suppliers and the services and the
 * complexity of AI to handle that service."* Measured against production the
 * same minute, and he is right:
 *
 *     select event_type, ('website' = any(enabled_surfaces)) as has_website
 *     from event_type_profiles order by 2, 1;
 *     → 17 rows, has_website = true on every one of them
 *
 * All five code fallbacks agree. So `websiteEnabled` is `true` for every event
 * that can exist, the disagreement between the phases describes a state nothing
 * can reach, and asking the owner to rule on it spent his attention on nothing.
 *
 * 🔑 THE LESSON IS ABOUT THE SHAPE OF THE QUESTION, NOT THE ANSWER. A gate with
 * no reachable negative case cannot protect anything — it can only subtract,
 * which is exactly what it did: the row vanished from every planning phone
 * because the flag arrived `undefined`, never because it arrived `false`.
 * **Before escalating an inconsistency, measure whether either side is
 * reachable.** An unreachable branch is dead code, not a decision.
 *
 * ⚠ SO THE GATE STAYS, AND THIS IS THE TRIPWIRE THAT MAKES THE QUESTION REAL IF
 * IT EVER BECOMES REAL. The day an event type ships WITHOUT the website
 * surface, this fails, and whoever ships it has to decide then — with a live
 * case in front of them — what the phone should do on the day and after.
 * Deleting the gate now would be the opposite mistake: removing the mechanism
 * that makes an opt-out possible, on the strength of a reading taken today.
 */
test('📏 every code profile enables the website surface — so the gate has no negative case', async () => {
  const P = await import('./event-type-profile');
  const profiles = {
    GENERIC: P.GENERIC_PROFILE,
    SIMPLE: P.SIMPLE_PROFILE,
    TRAVEL: P.TRAVEL_PROFILE,
    WAKE: P.WAKE_PROFILE,
    WEDDING: P.WEDDING_PROFILE,
  };
  for (const [name, profile] of Object.entries(profiles)) {
    assert.ok(
      P.surfaceEnabled(profile, 'website'),
      `${name} no longer enables 'website'. That makes the plan/day-of/after ` +
        'disagreement REACHABLE for the first time: the plan phone hides the Event Hub ' +
        'row for this type and the day-of and after phones still show it, while the ' +
        'desktop rail hides it in all three. Decide what the phone should do, then ' +
        'update this test to say what you decided.',
    );
  }
});
