/**
 * Owner 2026-10-25, asked whether a shop may buy Papic credit packs while Papic
 * is off: "No. Papic needs to be on." Two halves, both required — a hidden
 * button is not a gate, and a gate with a live button is a dead end:
 *   · the server action refuses before it mints an order;
 *   · the wallet sheet draws no Buy while the switch is off.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel: string) => readFileSync(new URL(`../../../../${rel}`, import.meta.url), 'utf8');

test('the pack action asks the Papic switch before it inserts an order', () => {
  const src = read('app/vendor-dashboard/on-the-day/live/[eventId]/papic/portfolio-pack-actions.ts');
  const body = src.slice(src.indexOf('export async function buyVendorPapicPortfolioPack'));
  const gate = body.search(/if \(!\(await isVendorPapicCaptureEnabled\(\)\)\) \{\s*return err\(/);
  const insert = body.indexOf(".from('orders')");
  assert.ok(gate > 0, 'buyVendorPapicPortfolioPack never refuses when Papic is off');
  assert.ok(insert > gate, 'the Papic refusal must come before the order insert');
});

test('the wallet sheet hides Buy while Papic is off, and the page reads the switch', () => {
  const sheet = read('app/vendor-dashboard/customers/_components/shop-wallet-sheet.tsx');
  assert.match(sheet, /if \([^)]*!buy\.papicOn[^)]*\) return null;/, 'BuyAPack draws while Papic is off');
  const segment = read('app/vendor-dashboard/customers/_components/money-segment.tsx');
  assert.match(segment, /isVendorPapicCaptureEnabled\(\)/, 'the money page never reads the Papic switch');
  assert.match(segment, /packCredits: VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS, papicOn \}/, 'papicOn is not handed to the sheet');
});
