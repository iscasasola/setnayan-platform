/**
 * lib/catalog-denied-columns-read-by-service-role.test.ts — A SESSION CLIENT ONLY ASKS THE PRICE LIST FOR WHAT IT MAY
 * READ (G6, 2026-11-10).
 *
 * `platform_retail_catalog_v2` is granted to `anon` + `authenticated` COLUMN BY COLUMN (20271201188010, "the catalog
 * keeps its margin"): the cost, the admin identities and — since the final price sheet (20271308555594) — the supplier
 * gift price and the included Papic credits are withheld. PostgREST refuses the WHOLE query that names one withheld
 * column (42501), so a session-client read that asks for `gift_price_php` reads NOTHING.
 *
 * That is exactly what shipped: `fetchShopPapicPacks` and `fetchShopGiftUnlockRows` selected `gift_price_php` off the
 * client their callers passed, five callers passed the supplier's own session client, and ~105 production errors
 * from 4 Nov to 10 Nov were the supplier's shop packs and gift rows reading "unavailable" on Shop › Promote, a new
 * card and a bundle's Gift row — a bundle's gift could not be saved at all. The DB test
 * (`tests/db/the-catalog-keeps-its-margin.db.test.ts`) held the grant exactly right the whole time; what nobody held
 * was the CALLER.
 *
 * THE RULE, read from the db test's own lists so the two can never disagree:
 *   every `.from('platform_retail_catalog_v2').select(…)` chained off a client that is NOT the service role names
 *   only columns in that test's PUBLIC_COLUMNS (each asserted SELECT-able by `authenticated` there) — never `*`,
 *   never a DENIED_COLUMNS name, never a column nobody has proved is granted.
 *   The service role is `createAdminClient()` or a receiver named for it (`admin`, `giftsAdmin`, `service…`).
 *
 * …and, because those two readers take their client from the caller, every CALL of them must hand over a
 * service-role client (test 3).
 *
 * 🛡 Sabotaged: `fetchShopGiftPacks(supabase)` put back in `packages/actions.ts` turns 3 red naming the line;
 * renaming either reader's `admin` parameter back to `client` turns 1 and 2 red naming `gift_price_php`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const MARGIN_TEST = join(WEB, 'tests', 'db', 'the-catalog-keeps-its-margin.db.test.ts');

/** A `const NAME = [ '…', … ] as const;` list out of the db test — the one place the grant is decided. */
function listFrom(src: string, name: string): string[] {
  const m = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\] as const;`).exec(src);
  assert.ok(m, `${name} not found in the margin db test — the list moved; point this guard at its new home`);
  return [...m[1]!.matchAll(/'([a-z_0-9]+)'/g)].map((x) => x[1]!);
}

const marginSrc = stripComments(readFileSync(MARGIN_TEST, 'utf8'));
const PUBLIC = new Set(listFrom(marginSrc, 'PUBLIC_COLUMNS'));
const DENIED = new Set(listFrom(marginSrc, 'DENIED_COLUMNS'));

function* sources(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* sources(p);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.|\.harness\./.test(e.name)) yield p;
  }
}

type Chain = { file: string; line: number; receiver: string; columns: string[] };

/** Every literal `<receiver>.from('platform_retail_catalog_v2').select('<columns>')`, however it is wrapped. */
function catalogueChains(): Chain[] {
  const out: Chain[] = [];
  const re =
    /([A-Za-z_$][\w$]*(?:\(\))?)\s*\.from\(\s*['"]platform_retail_catalog_v2['"]\s*\)\s*\.select\(\s*(['"`])([\s\S]*?)\2/g;
  for (const root of ['app', 'lib']) {
    for (const abs of sources(join(WEB, root))) {
      const src = readFileSync(abs, 'utf8');
      for (const m of src.matchAll(re)) {
        out.push({
          file: relative(WEB, abs),
          line: src.slice(0, m.index).split('\n').length,
          receiver: m[1]!,
          columns: m[3]!
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
        });
      }
    }
  }
  return out;
}

const isServiceRole = (receiver: string) => receiver === 'createAdminClient()' || /admin|service/i.test(receiver);

const CHAINS = catalogueChains();

test('0 · the lists and the scan are real — or every pass below is about nothing', () => {
  assert.ok(PUBLIC.has('retail_price_php') && PUBLIC.size >= 10, `PUBLIC_COLUMNS read as ${[...PUBLIC]}`);
  assert.ok(DENIED.has('saas_overhead_cost_php') && DENIED.has('gift_price_php'), `DENIED_COLUMNS read as ${[...DENIED]}`);
  assert.ok(CHAINS.length >= 30, `only ${CHAINS.length} catalogue reads seen — the scan is not reaching the source`);
  assert.ok(
    CHAINS.some((c) => !isServiceRole(c.receiver)),
    'no session-client catalogue read seen — the rule below would hold vacuously',
  );
  assert.ok(
    CHAINS.some((c) => isServiceRole(c.receiver) && c.columns.some((col) => DENIED.has(col))),
    'no service-role read of a withheld column seen — the scan cannot tell the two apart',
  );
});

test('1 · a session client asks the price list only for columns proved readable by `authenticated`', () => {
  const bad = CHAINS.filter((c) => !isServiceRole(c.receiver)).flatMap((c) =>
    c.columns
      .filter((col) => col === '*' || !PUBLIC.has(col))
      .map(
        (col) =>
          `${c.file}:${c.line} — \`${c.receiver}\` asks for \`${col}\`${DENIED.has(col) ? ' (WITHHELD from anon + authenticated)' : ' (not proved granted)'}`,
      ),
  );
  assert.deepEqual(
    bad,
    [],
    'These reads are refused whole (42501) for a signed-in viewer and read as empty / "unavailable".\n' +
      'Read the column with createAdminClient(), or — only if it is customer-facing — GRANT SELECT (col) TO anon,\n' +
      'authenticated in a migration and add it to PUBLIC_COLUMNS in tests/db/the-catalog-keeps-its-margin.db.test.ts.\n  ' +
      bad.join('\n  '),
  );
});

/** Every call of the gift-price readers, with the argument it hands them. */
const GIFT_READERS = ['fetchShopPapicPacks', 'fetchShopGiftUnlockRows', 'fetchShopGiftPacks'] as const;
function giftReaderCalls(): Array<{ where: string; fn: string; arg: string }> {
  const out: Array<{ where: string; fn: string; arg: string }> = [];
  const re = new RegExp(`\\b(${GIFT_READERS.join('|')})\\(\\s*([^,)]*(?:\\(\\))?)\\s*\\)`, 'g');
  for (const root of ['app', 'lib']) {
    for (const abs of sources(join(WEB, root))) {
      const src = stripComments(readFileSync(abs, 'utf8'));
      for (const m of src.matchAll(re)) {
        // the declarations themselves (`function fetchShopGiftPacks(admin: SupabaseClient)`) are not calls
        if (/function\s+$/.test(src.slice(Math.max(0, m.index! - 12), m.index))) continue;
        out.push({ where: `${relative(WEB, abs)}:${src.slice(0, m.index).split('\n').length}`, fn: m[1]!, arg: m[2]!.trim() });
      }
    }
  }
  return out;
}

test('2 · the two G6 readers ask the catalogue with the client named for the service role', () => {
  for (const file of ['lib/vendor-papic-grants.ts', 'lib/shop-gifts.server.ts']) {
    const mine = CHAINS.filter((c) => c.file === file && c.columns.includes('gift_price_php'));
    assert.ok(mine.length >= 1, `${file}: its gift-price read was not seen`);
    for (const c of mine) assert.ok(isServiceRole(c.receiver), `${file}:${c.line} reads the gift price off \`${c.receiver}\``);
  }
});

test('3 · every caller hands the gift-price readers a service-role client — never the viewer\'s session', () => {
  const calls = giftReaderCalls();
  assert.ok(calls.length >= 10, `only ${calls.length} calls of ${GIFT_READERS.join(' / ')} seen — the scan is not reaching them`);
  const bad = calls.filter((c) => !isServiceRole(c.arg)).map((c) => `${c.where} — ${c.fn}(${c.arg})`);
  assert.deepEqual(
    bad,
    [],
    'These hand a session client to a reader that selects `gift_price_php` — refused whole (42501) for every\n' +
      'supplier, read as "unavailable". Pass createAdminClient() (or the page\'s `admin`).\n  ' +
      bad.join('\n  '),
  );
});
