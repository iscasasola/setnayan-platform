/**
 * TWO SUPPLIER-SIDE CONNECTIONS THAT HAD ONE END — now both ends exist (S39).
 *
 * S26's orphan sweep found two functions whose READ side shipped and whose
 * WRITE side had no caller, so the reader could only ever show emptiness:
 *
 *   1. recompute_market_funnel_bands() — the only writer of market_funnel_bands,
 *      which every supplier's My Performance funnel benchmark reads. Nothing
 *      called it, so the table was empty in production and every supplier was
 *      told "not enough peer data" whatever the data.
 *   2. vendor_set_booth_studio_content() — the only writer of
 *      event_vendor_booth_posters.poster_content, which the 3D booth renders.
 *      Nothing called it, so no supplier could put words on a booth.
 *
 * These checks pin BOTH ends of each: the action calls the RPC, a mounted form
 * or component calls the action, and the mount is exactly once. A deletion of
 * any hop — the call, the import, the JSX — turns this red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(__dirname, '..', 'app');
const read = (rel: string) => readFileSync(join(APP, rel), 'utf8');
/** Strip block and line comments so prose naming a symbol cannot satisfy a check. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const count = (hay: string, needle: string) => hay.split(needle).length - 1;

/** The body of `export async function <name>(` up to its closing brace at column 0. */
function fnBody(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} is not exported`);
  const end = src.indexOf('\n}\n', start);
  assert.ok(end > start, `${name} has no closing brace at column 0`);
  return src.slice(start, end);
}

test('funnel bands: the admin action calls the only writer of market_funnel_bands', () => {
  const body = fnBody(code(read('admin/price-bands/actions.ts')), 'recomputeFunnelBands');
  assert.equal(count(body, "rpc('recompute_market_funnel_bands')"), 1);
});

test('funnel bands: the price-bands surface mounts that action as a form, exactly once', () => {
  const src = code(read('admin/pricing/_surfaces/price-bands-surface.tsx'));
  const mounts = count(src, '<form action={recomputeFunnelBands}>');
  assert.equal(mounts, 1, `expected one recomputeFunnelBands form, found ${mounts}`);
});

test('booth studio: the server action calls the only writer of poster_content', () => {
  const body = fnBody(
    code(read('vendor-dashboard/clients/[eventId]/cocktail/actions.ts')),
    'setBoothStudioContent',
  );
  assert.equal(count(body, "rpc('vendor_set_booth_studio_content'"), 1);
  // It stores what the renderer would draw — the same sanitizer, before the write.
  assert.ok(
    body.indexOf('sanitizeBoothStudioContent(') >= 0 &&
      body.indexOf('sanitizeBoothStudioContent(') < body.indexOf('.rpc('),
    'content must be sanitized by the renderer’s rule BEFORE it is stored',
  );
});

test('booth studio: the composer calls the action, and the client page mounts it once behind the flag', () => {
  const card = code(read('vendor-dashboard/clients/[eventId]/_components/booth-studio-card.tsx'));
  assert.ok(/await setBoothStudioContent\(/.test(card), 'the composer never calls setBoothStudioContent');

  const page = code(read('vendor-dashboard/clients/[eventId]/page.tsx'));
  const mounts = count(page, '<BoothStudioCard ');
  assert.equal(mounts, 1, `expected one <BoothStudioCard> mount, found ${mounts}`);
  // The condition in front of the mount must be the renderer's own flag — a
  // composer shown with the renderer off would collect words nobody sees.
  const at = page.indexOf('<BoothStudioCard ');
  const guard = page.slice(page.lastIndexOf('{', at), at);
  assert.match(guard, /boothStudioEnabled\(\)/, `mount is not gated on boothStudioEnabled(): ${guard}`);
  // And the page actually reads the column the composer edits.
  assert.match(page, /\.select\('poster_ref, poster_content'\)/);
});
