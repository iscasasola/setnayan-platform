/**
 * the-couple-side-keeps-its-close.test.ts — ✕ STAYS ✕ FOR THE COUPLE; CLIENTS ON A COMPUTER SAYS "‹ Calendar".
 *
 * Owner rule "never lose the back button" (DECISION_LOG 17 Nov, via the controller): the shared `PickedShell` takes ONE
 * optional `closeAs` (a word + icon for the SAME close), defaulting to today's ✕. The supplier's picked client passes
 * "‹ Calendar"; CSS shows it only over the Clients month from 1280, where the event spans columns 2 + 3, and hides ✕
 * there. The couple's picked supplier never passes it, so its ✕ is unchanged.
 *
 * SABOTAGE (each run once, each went red): pass `closeAs` from the couple's shell → 1; wrap the ✕ in `closeAs ? … :` → 1;
 * show `[data-picked-close-as]` outside the 1280 block → 1; label it "Back" → 1.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const R = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const SHELL = R('app/_components/picked/picked-shell.tsx');
const COUPLE = R('app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/picked-supplier-shell.tsx');
const SUPPLIER = R('app/vendor-dashboard/clients/[eventId]/_components/picked-client-shell.tsx');
const FRAME = R('app/vendor-dashboard/_components/supplier-frame.css');

test('the shell always draws ✕; the named close is optional and defaults to none', () => {
  assert.match(SHELL, /closeAs = null,/, 'closeAs no longer defaults to none');
  const x = SHELL.indexOf('icon={X} label="Close" onClick={close} data-testid="picked-close"');
  assert.ok(x > 0, 'the ✕ is gone');
  // The ✕ is its own statement, after the optional one closes — never inside its ternary.
  const before = SHELL.slice(0, x);
  assert.match(before, /\) : null\}\s*<ActionButton tone="neutral" iconOnly $/, 'the ✕ now depends on closeAs');
});

test('the couple side never passes closeAs, so it renders ✕ only', () => {
  assert.match(COUPLE, /<PickedShell/);
  assert.doesNotMatch(COUPLE, /closeAs/, 'the couple side changed its close');
});

test('Clients passes "‹ Calendar", shown only over the Clients month from 1280, where it replaces ✕', () => {
  assert.match(SUPPLIER, /closeAs=\{CLOSE_TO_CALENDAR\}/);
  assert.match(SUPPLIER, /CLOSE_TO_CALENDAR = \{ label: 'Calendar', icon: ChevronLeft \}/);
  assert.match(FRAME, /\[data-picked-client\] \[data-picked-close-as\] \{\s*display: none;/, 'the named close is not hidden by default');
  const m = /@media \(min-width: 1280px\) \{\s*html:has\(\[data-dates-month='clients'\]\) \[data-picked-client\] \[data-picked-close-as\] \{\s*display: inline-flex;[^}]*\}\s*html:has\(\[data-dates-month='clients'\]\) \[data-picked-client\] \[data-testid='picked-close'\] \{\s*display: none;/.exec(FRAME);
  assert.ok(m, 'on a computer over Clients, "‹ Calendar" does not replace ✕');
  const shown = FRAME.match(/\[data-picked-close-as\] \{\s*display: inline-flex/g) ?? [];
  assert.equal(shown.length, 1, 'the named close is shown somewhere else too');
});
