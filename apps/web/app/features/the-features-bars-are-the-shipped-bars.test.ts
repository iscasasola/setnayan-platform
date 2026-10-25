/**
 * the-features-bars-are-the-shipped-bars.test.ts — /features names each phone bar's tabs the way the bar does.
 *
 * QA walk after the 21→22 Oct overnight batch: live /features (and /tl/features) still said the supplier works in
 * "Today · Customers · Shop · More" a day after the supplier bar became **Today · Customers · Shop · Hub** (#6748,
 * owner "Yes to all", 2026-10-21), and the host line said "Event Hub" where the couple's bar says **Hub** (the bare
 * "Event Hub" is the guest page — `lib/customer-menu.ts`). Nothing failed: the page's words were a second, hand-typed
 * copy of the bars, and the PR that changed the bar had no reason to open a marketing section.
 *
 * THE PROPERTY, asked of the bars' OWN label sources (never a copy typed here):
 *   · the Supplier row's first line, in every locale, opens with the supplier bar's labels in bar order, then " —";
 *   · the Host row's first line, in every locale, opens with the couple's web bar labels — Home through Hub, from
 *     `buildCustomerMenuTree` — in bar order. The fifth word (More / Studio) follows the `NEXT_PUBLIC_SUITE` flag,
 *     which this process cannot read as production has it, so it is not asserted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HOW_IT_WORKS_COPY } from './_sections/_HowItWorks';
import { VENDOR_BOTTOM_NAV_ITEMS } from '@/app/vendor-dashboard/_components/vendor-bottom-nav';
import { buildCustomerMenuTree } from '@/lib/customer-menu';

const SEP = ' · ';

function firstLineOf(label: string, locale: string): string {
  const role = HOW_IT_WORKS_COPY[locale as keyof typeof HOW_IT_WORKS_COPY].roles.find((r) => r.label === label);
  assert.ok(role, `${locale}: /features has no "${label}" row`);
  const line = role.where[0];
  assert.ok(line, `${locale}: the "${label}" row has no first line`);
  return line;
}

test('🧭 the Supplier line on /features names the supplier bar, tab for tab', () => {
  const bar = VENDOR_BOTTOM_NAV_ITEMS.map((i) => i.label);
  assert.ok(bar.length >= 3, 'premise: the supplier bar has its tabs');
  const want = `${bar.join(SEP)} —`;
  const locales = Object.keys(HOW_IT_WORKS_COPY);
  assert.ok(locales.length >= 2, 'premise: both locales are checked');
  for (const locale of locales) {
    const line = firstLineOf('Supplier', locale);
    assert.ok(line.startsWith(want), `${locale}: /features says "${line.split(' —')[0]}", the supplier bar is "${bar.join(SEP)}"`);
  }
});

test('🧭 the Host line on /features names the couple bar, Home through Hub, tab for tab', () => {
  const tree = buildCustomerMenuTree('S89E-TESTEVENT', { websiteEnabled: true, phase: 'plan' });
  const upToHub = tree.slice(0, tree.findIndex((m) => m.key === 'launch') + 1).map((m) => m.label);
  assert.ok(upToHub.length === 4 && upToHub[0] === 'Home', `premise: the couple bar opens Home … Hub (got ${upToHub.join(SEP)})`);
  const want = `${upToHub.join(SEP)}${SEP}`;
  for (const locale of Object.keys(HOW_IT_WORKS_COPY)) {
    const line = firstLineOf('Host', locale);
    assert.ok(line.startsWith(want), `${locale}: /features says "${line.split(' —')[0]}", the couple bar is "${upToHub.join(SEP)} · …"`);
  }
});
