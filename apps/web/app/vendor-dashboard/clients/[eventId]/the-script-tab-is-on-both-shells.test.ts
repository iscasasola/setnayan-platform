/**
 * the-script-tab-is-on-both-shells.test.ts — THE EMCEE'S SCRIPT IS REACHABLE
 * ON THE CARD PRODUCTION ACTUALLY SERVES.
 *
 * 🔴 WHAT WAS BROKEN (C3 report, SUPPLIER_SIDE_REPORT_2026-10-03.md): the
 * customer card renders two tab strips. `scriptNode` was mounted ONLY in the
 * flag-OFF card (`CardTabs … showScript`). With
 * NEXT_PUBLIC_RELATIONSHIP_WORKSPACE_ENABLED on — production — the
 * RelationshipTabShell had no Script tab at all, so the one trade the tab
 * exists for (the host / MC, `stage_script`) could not reach it.
 *
 * 🔑 One node, one gate, both shells: the ON shell declares a `script` tab that
 * renders the SAME `scriptNode` through the SAME fee gate (`gated(…)`), and is
 * `hidden` on exactly the condition the OFF card uses (`showScript`). A florist
 * still sees no Script tab on either shell.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '../../../../lib/strip-comments';
import { VENDOR_CLIENT_TABS } from '../../../../lib/vendor-client-return';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

/** The ON shell's tab array, sliced to its closing `];`. */
function shellTabs(): string {
  const at = PAGE.indexOf('const tabs: RelationshipTab[] = [');
  assert.ok(at >= 0, 'the relationship shell tab array moved — re-anchor this test');
  const end = PAGE.indexOf('\n  ];', at);
  assert.ok(end > at, 'could not find the end of the tab array');
  return PAGE.slice(at, end);
}

/** One `{ … }` tab entry by id. */
function tabEntry(id: string): string {
  const tabs = shellTabs();
  const at = tabs.indexOf(`id: '${id}',`);
  assert.ok(at >= 0, `the ON shell has no '${id}' tab`);
  const close = tabs.indexOf('\n    },', at);
  return tabs.slice(at, close);
}

test('the relationship shell (flag ON) declares a Script tab', () => {
  const script = tabEntry('script');
  assert.match(script, /label: 'Script'/);
  assert.match(script, /node: gated\(scriptNode\)/, 'same node, same fee gate as the OFF card');
  assert.match(
    script,
    /hidden: !showScript/,
    'shown on exactly the OFF card’s condition — a florist must not get a Script tab',
  );
  assert.ok(
    (VENDOR_CLIENT_TABS as readonly string[]).includes('script'),
    'a landing that names ?tab=script must be a tab the ON shell knows',
  );
});

test('the flag-OFF card still carries it, from the same gate', () => {
  assert.match(PAGE, /<CardTabs eventId=\{eventId\} active=\{tab\} showScript=\{showScript\} \/>/);
  assert.match(PAGE, /\{tab === 'script' \? gated\(scriptNode\) : null\}/);
  // ONE definition of the node and ONE of the gate — not a copy per shell.
  assert.equal((PAGE.match(/const scriptNode = /g) ?? []).length, 1);
  assert.equal((PAGE.match(/const showScript = /g) ?? []).length, 1);
});
