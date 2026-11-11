#!/usr/bin/env node
// print-prices — the CURRENT price of every SKU, printed from the live
// catalogue. Build 6 Lane M, step 2.
//
// WHY THIS EXISTS: CLAUDE.md — "NEVER derive a price from this file or from a
// code comment — read platform_retail_catalog_v2, which is admin-managed and is
// the only price a customer is charged." So no document types a number. The
// feature register (corpus `FEATURE_REGISTER.md` § 7) lists every SKU KEY, the
// feature it unlocks, who pays and the admin page that edits it; THIS script
// prints the numbers beside those keys, on demand, from the database.
//
// SAFETY: SELECT only (see scripts/lib/read-only-db.mjs — one SELECT, inside a
// read-only transaction, on a read-only session). The database URL is read from
// PRICES_DB_URL / SUPABASE_DB_URL / DATABASE_URL and never printed.
//
// USAGE
//   SUPABASE_DB_URL=… node scripts/print-prices.mjs              # markdown to stdout
//   … node scripts/print-prices.mjs --json                       # rows as JSON
//   … node scripts/print-prices.mjs --out /tmp/prices.md         # write a file
//   node scripts/print-prices.mjs --from-json rows.json          # format rows read elsewhere (no DB)
//   --corpus <dir>   where FEATURE_REGISTER.md is (default: found; see findCorpus)
//   --active-only    on-sale rows only
//
// Exit codes: 0 printed · 2 could not read the catalogue (the reason is printed; no number is guessed).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRows } from './lib/read-only-db.mjs';
import { findCorpus, pricesIndex } from './lib/feature-register-core.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const RETAIL_SQL = `select 'platform_retail_catalog_v2' as catalogue, service_code as key, title,
  retail_price_php as price_php, gift_price_php, included_papic_credits, billing_period as billing,
  is_active, retired_at::date as retired_on, replaced_by_service_code as replaced_by
  from public.platform_retail_catalog_v2`;

export const VENDOR_SQL = `select 'vendor_billing_catalog' as catalogue, sku_code as key, title,
  price_php, null::numeric as gift_price_php, null::integer as included_papic_credits, offering_type as billing,
  is_active, retired_at::date as retired_on, replaced_by_sku_code as replaced_by
  from public.vendor_billing_catalog`;

export const PRICES_SQL = `select * from (${RETAIL_SQL} union all ${VENDOR_SQL}) c order by catalogue desc, is_active desc, key`;

const peso = (v) => (v == null || v === '' ? '—' : `₱${Number(v).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`);
const cell = (v) => String(v ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** Rows → markdown. Pure, so the format is unit-tested without a database. */
export function formatPrices(rows, { index = new Map(), printedAt = new Date().toISOString(), via = '(rows supplied)', activeOnly = false } = {}) {
  const out = [];
  out.push(`# Prices — printed from the live catalogue`);
  out.push('');
  out.push(`Printed ${printedAt} via ${via}, read-only. **Do not copy these numbers into a page, a doc or an answer** — re-run this script, or open Admin › Pricing (\`/admin/pricing\`). Who pays and what each key unlocks: \`FEATURE_REGISTER.md\` § 7.`);
  for (const cat of ['platform_retail_catalog_v2', 'vendor_billing_catalog']) {
    const list = rows.filter((r) => r.catalogue === cat && (!activeOnly || r.is_active));
    const onSale = list.filter((r) => r.is_active).length;
    out.push('', `## \`${cat}\` — ${list.length} rows, ${onSale} on sale`, '');
    const retail = cat === 'platform_retail_catalog_v2';
    out.push(retail
      ? '| SKU key | Title | Feature (register § 7) | Price | Gift price | Papic credits | Billing | On sale | Retired |'
      : '| SKU key | Title | Feature (register § 7) | Price | Billing | On sale | Retired |');
    out.push(retail ? '|---|---|---|---|---|---|---|---|---|' : '|---|---|---|---|---|---|---|');
    for (const r of list) {
      const feat = index.get(r.key)?.feature || '⚠ no register row';
      const base = [`\`${r.key}\``, cell(r.title), cell(feat), peso(r.price_php)];
      const tail = [cell(r.billing), r.is_active ? 'yes' : 'no', cell(r.retired_on ?? (r.replaced_by ? `→ ${r.replaced_by}` : '—'))];
      out.push('| ' + (retail ? [...base, peso(r.gift_price_php), cell(r.included_papic_credits ?? '—'), ...tail] : [...base, ...tail]).join(' | ') + ' |');
    }
  }
  const unregistered = rows.filter((r) => !index.has(r.key)).map((r) => r.key);
  out.push('', unregistered.length
    ? `⚠ ${unregistered.length} key(s) have no row in FEATURE_REGISTER.md § 7: ${unregistered.map((k) => `\`${k}\``).join(' · ')} — add them (\`node scripts/feature-register-check.mjs\` fails on this too).`
    : index.size ? 'Every key above has a row in FEATURE_REGISTER.md § 7.' : '(FEATURE_REGISTER.md not found — the Feature column is empty; pass --corpus <dir>.)');
  return out.join('\n') + '\n';
}

function arg(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

export function main(argv = process.argv.slice(2), env = process.env) {
  let rows; let via;
  const fromJson = arg(argv, '--from-json');
  if (fromJson) {
    rows = JSON.parse(fs.readFileSync(fromJson, 'utf8'));
    via = `rows from ${path.basename(fromJson)}`;
  } else {
    const r = readRows(PRICES_SQL, { env });
    if (!r.ok) {
      process.stderr.write(`print-prices: could not read the live catalogue — ${r.reason}.\nNo number is printed rather than a guessed one.\n`);
      return 2;
    }
    rows = r.rows; via = `$${r.via}`;
  }
  if (argv.includes('--json')) {
    const text = JSON.stringify(rows, null, 2) + '\n';
    const out = arg(argv, '--out');
    if (out) fs.writeFileSync(out, text); else process.stdout.write(text);
    return 0;
  }
  const corpus = findCorpus({ flag: arg(argv, '--corpus'), env, repoRoot: REPO });
  const index = corpus ? pricesIndex(fs.readFileSync(path.join(corpus, 'FEATURE_REGISTER.md'), 'utf8')) : new Map();
  const md = formatPrices(rows, { index, via, activeOnly: argv.includes('--active-only') });
  const out = arg(argv, '--out');
  if (out) { fs.writeFileSync(out, md); process.stderr.write(`print-prices: wrote ${out}\n`); } else process.stdout.write(md);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
