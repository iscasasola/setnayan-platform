/**
 * RW-285d (live walk, 14 Nov 2026) — Problems lines built from raw internal names: "Saving the samahan stories"
 * for a DELETE, "Saving the refresh bottleneck signals" for a background refresh, and a tapped label carrying an
 * avatar's initial glued onto the name ("IIndalecio Casasola"). Every fixture below is a LIVE prod row.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { problemLine, mendLabel } from './problem-line';

const day = { dayCount: 1, dayDate: '2026-11-14', today: '2026-11-14' };
const line = (kind: string, action: string, label: string | null = null, page: string | null = null) =>
  problemLine({ ...day, kind, action, label, page });

test('a DELETE removes, it never "saves"', () => {
  assert.equal(line('DB_ZERO_ROW', 'DELETE samahan_stories'), 'Removing the samahan stories — nothing was there to remove · once today');
  assert.match(line('DB_ZERO_ROW', 'DELETE event_category_decisions'), /^Removing the event category decisions — /);
});

test('a background call says what it does', () => {
  assert.equal(line('DB_WRITE_REFUSED', 'POST rpc/refresh_bottleneck_signals'), 'Refreshing the bottleneck signals — could not refresh · once today');
  assert.equal(line('DB_WRITE_REFUSED', 'POST rpc/detect_inquiry_concentration'), 'Checking the inquiry concentration — could not check · once today');
  assert.equal(line('DB_WRITE_REFUSED', 'POST rpc/get_event_service_counts'), 'Loading the event service counts — could not load · once today');
});

test('a plain write still saves', () => {
  assert.equal(line('DB_WRITE_REFUSED', 'POST chat_messages'), 'Saving the chat messages — could not save · once today');
  assert.equal(line('DB_WRITE_REFUSED', 'POST admin_audit_log'), 'Saving the admin audit log — could not save · once today');
});

test('no Problems line opens with "Saving the" a word that is itself a verb', () => {
  for (const a of ['DELETE samahan_stories', 'POST rpc/refresh_bottleneck_signals', 'POST rpc/detect_inquiry_concentration', 'POST rpc/get_vendor_cocktail_editor']) {
    assert.doesNotMatch(line('DB_WRITE_REFUSED', a), /^Saving the (refresh|detect|get|delete)\b|^Saving the samahan/, a);
  }
});

test("a stored label's doubled avatar initial is mended on display", () => {
  assert.equal(mendLabel('IIndalecio Casasola@[email]'), 'Indalecio Casasola@[email]');
  assert.equal(mendLabel('Indalecio'), 'Indalecio');
  assert.equal(mendLabel('OK'), 'OK');
  assert.match(line('DEAD_TAP', '/admin/money · IIndigo Moriales@[email]', 'IIndigo Moriales@[email]', '/admin/money'), /^Indigo Moriales/);
});

test('the capture skips hidden text, so a new label arrives without the initial', () => {
  const src = readFileSync(join(__dirname, 'fault-observer.ts'), 'utf8');
  const label = src.slice(src.indexOf('export function labelOf'), src.indexOf('export function labelOf') + 600);
  assert.match(label, /visibleText\(el\)/, 'labelOf reads the visible words');
  assert.doesNotMatch(label, /el\.textContent/, 'labelOf no longer glues every text node together');
  const helper = src.slice(src.indexOf('export function visibleText'), src.indexOf('export function labelOf'));
  assert.match(helper, /getAttribute\('aria-hidden'\) === 'true'\) return/, 'hidden text is skipped');
  assert.match(helper, /parts\.join\(' '\)/, 'pieces are separated');
});

test('an avatar initial marked hidden never reaches the label', async () => {
  const { labelOf } = await import('./fault-observer');
  const text = (v: string) => ({ nodeType: 3, nodeValue: v, childNodes: [] });
  const elem = (attrs: Record<string, string>, kids: unknown[]) => ({
    nodeType: 1,
    tagName: 'BUTTON',
    childNodes: kids,
    getAttribute: (k: string) => attrs[k] ?? null,
    querySelector: () => null,
  });
  const row = elem({}, [elem({ 'aria-hidden': 'true' }, [text('I')]), elem({}, [text('Indalecio Casasola')]), elem({}, [text('ice@example.com')])]);
  assert.equal(labelOf(row as never), 'Indalecio Casasola ice@example.com');
});
