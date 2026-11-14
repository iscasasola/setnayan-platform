/**
 * the-tab-is-called-clients.test.ts — 👥 THE TAB IS CALLED CLIENTS (THE ONE BUILD S2 / guard G3, 8 Nov 2026).
 *
 * BARS LOCKED BY OWNER, 7 Nov 2026: the supplier bar reads Today · Clients · Shop · Portfolio. The word a supplier SEES
 * for their people is "Clients" — the route and the key stay `customers` (no redirect, no rename of code), only the
 * visible word changes.
 *
 * What it holds: no `Customers` (the capitalised, whole word) left in code a supplier reads — every non-test file under
 * `app/vendor-dashboard/**`, `lib/menu-settings.ts`, `lib/help.ts`, `lib/tours.ts`, `lib/nav-registry-defaults.ts` —
 * read through `stripComments`, so a comment may still say it but a JSX text, `label=`, `aria-label=`, `title`,
 * `metadata` or slot label may not. Identifiers (`CustomersRoster`) and the lowercase key are not the word.
 *
 * Baseline 0 for THE ONE BUILD. Until the lane that owns a file lands, it sits on KNOWN — and KNOWN ONLY SHRINKS: a new
 * file is red, and a file that has been fixed must leave the list (a stale entry is red too).
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-08): `sheet: 'Customers settings'` put back in `lib/menu-settings.ts`'s customers
 * entry (red: a new offender); `crew-panel.tsx` put back to "No Today, Customers, Shop or money." (red: a new offender).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { PUBLIC_HELP_SOURCES } from '@/lib/help-sources.test-helper';

const WEB = join(__dirname, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const SHARED = ['lib/menu-settings.ts', ...PUBLIC_HELP_SOURCES, 'lib/tours.ts', 'lib/nav-registry-defaults.ts']; // help split 2026-11-14

/** Files whose owning lane renames the word in THE ONE BUILD (owner lane in the value). Remove a line once fixed. */
// Integration (8 Nov): emptied — the last three strings (the pinned row's group + Show label, the client page's back
// link) now say Clients. It stays as the shape of the ratchet: a new "Customers" string is red.
const KNOWN: Record<string, string> = {};

const WORD = /\bCustomers\b/g;

test('no supplier string says "Customers" — the tab is Clients (the known files only shrink)', () => {
  const found: Record<string, number> = {};
  const files = [...walk(join(WEB, 'app', 'vendor-dashboard')), ...SHARED.map((f) => join(WEB, f))];
  for (const file of files) {
    const n = (stripComments(readFileSync(file, 'utf8')).match(WORD) ?? []).length;
    if (n) found[relative(WEB, file)] = n;
  }
  const fresh = Object.keys(found).filter((f) => !(f in KNOWN));
  assert.deepEqual(fresh, [], `the supplier sees "Customers" here — the tab is called Clients:\n${fresh.join('\n')}`);
  const fixed = Object.keys(KNOWN).filter((f) => !(f in found));
  assert.deepEqual(fixed, [], `these files no longer say "Customers" — take them OFF the KNOWN list (it only shrinks):\n${fixed.join('\n')}`);
  // eslint-disable-next-line no-console
  console.log(`supplier files still saying "Customers": ${Object.keys(found).length} (target 0)`);
});

test('the bar, the rail and the ⚙ say Clients', () => {
  const menu = stripComments(readFileSync(join(WEB, 'lib/menu-settings.ts'), 'utf8'));
  assert.match(menu, /Clients settings/, 'the customers ⚙ is not titled "Clients settings"');
  const reg = stripComments(readFileSync(join(WEB, 'lib/nav-registry-defaults.ts'), 'utf8'));
  for (const slot of ['vendor.sidebar.customers', 'vendor.bottom-nav.customers']) {
    const at = Math.max(reg.indexOf(`'${slot}'`), reg.indexOf(`"${slot}"`));
    assert.ok(at >= 0, `registry slot ${slot} is gone — this guard cannot read it`);
    assert.match(reg.slice(at, at + 400), /label: ['"]Clients['"]/, `${slot} is not labelled Clients`);
  }
});
