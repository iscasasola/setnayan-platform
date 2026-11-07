/**
 * the-script-tab-is-on-both-shells.test.ts — THE EMCEE'S SCRIPT IS REACHABLE
 * ON THE CARD PRODUCTION ACTUALLY SERVES.
 *
 * (Since THE ONE BUILD, 8 Nov 2026, "the ON shell" = the picked client; the Script is a fold on its Schedule page.)
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

/**
 * THE ONE BUILD (8 Nov 2026 · v113): the ON shell is no longer a tab strip — it is the picked client's nine pages,
 * and the emcee's script is a FOLD at the end of the Schedule page (`?tab=script` lands there). The rule this file
 * guards is unchanged: one node, one fee gate, shown on exactly `showScript`.
 */
function scheduleBody(): string {
  const at = PAGE.indexOf('schedule: (');
  assert.ok(at >= 0, 'the picked client\'s schedule body moved — re-anchor this test');
  const end = PAGE.indexOf('\n      ),', at);
  assert.ok(end > at, 'could not find the end of the schedule body');
  return PAGE.slice(at, end);
}

test('the picked client (flag ON) folds the Script in at the end of Schedule', () => {
  const body = scheduleBody();
  assert.match(body, /\{showScript \? \(\s*<section id=\{SCRIPT_FOLD_ID\}/, 'shown on exactly the OFF card\u2019s condition');
  assert.match(body, /\{gated\(scriptNode\)\}/, 'same node, same fee gate as the OFF card');
  assert.ok(body.indexOf('gated(scheduleNode)') < body.indexOf('SCRIPT_FOLD_ID'), 'the Script fold sits AFTER the schedule');
  assert.match(PAGE, /scrollToScript=\{wantsScriptFold\(rawTab\) && showScript\}/, '?tab=script must land on the fold');
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
