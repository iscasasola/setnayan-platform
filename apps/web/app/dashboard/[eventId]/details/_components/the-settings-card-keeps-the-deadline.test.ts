/**
 * the-settings-card-keeps-the-deadline.test.ts — the guest-list edit deadline
 * is asked ONCE (audit HOLD on train d, 2026-10-02).
 *
 * It was asked twice: in Event settings (this card's date input) and in the
 * Maker's RSVP item as "Reply by". Both wrote `events.guest_list_edit_deadline`
 * through `updatePaxSettings`. The RSVP item keeps it; this card keeps only "How
 * you see costs". The action writes BOTH columns on every save, and an empty
 * deadline means "clear it". So the card must post the stored date back
 * unchanged, or saving the cost view would silently wipe the couple's deadline.
 *
 * RENDER-LEVEL: the card is painted with renderToStaticMarkup. The fields a
 * browser would submit (named inputs that are not unchecked radios) are read
 * out of that HTML and handed to the action's own parser
 * (`parsePaxSettingsForm`, the code `updatePaxSettings` runs).
 *
 * SABOTAGE PERFORMED AND UNDONE: the hidden `guest_list_edit_deadline` input
 * was deleted from pax-settings-card.tsx. "a cost-view save keeps the stored
 * deadline" went red (the parsed deadline came back null, i.e. cleared).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import React from 'react';
import { parsePaxSettingsForm } from '@/lib/pax-settings-form';

(globalThis as unknown as { React: unknown }).React = React;

/* ── `server-only` shim — the card imports `updatePaxSettings` from
 * `../../actions`, whose graph opens with `import 'server-only'`, a module the
 * BUNDLER supplies. Resolving it to an empty module is faithful (the boundary
 * is enforced by `scripts/lint-server-only-boundary.mjs`); same shim and
 * reasoning as `app/pay/[reference]/_components/one-stage-at-a-time.test.ts`.
 * Registered at module scope with the card import kept DYNAMIC. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_pax_settings_card__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

async function render(deadline: string | null, mode: 'realtime' | 'final_only'): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PaxSettingsCard } = await import('./pax-settings-card');
  const { LoaderOverlayProvider } = await import('@/components/sd-loader/loader-overlay');
  return renderToStaticMarkup(
    React.createElement(
      LoaderOverlayProvider,
      null,
      React.createElement(PaxSettingsCard, { eventId: 'S89E-TEST000001', deadline, mode }),
    ),
  );
}

type Field = { type: string; name: string; value: string; checked: boolean };

function inputsOf(html: string): Field[] {
  const out: Field[] = [];
  for (const m of html.matchAll(/<input\b([^>]*)\/?>/g)) {
    const attrs = m[1]!;
    const attr = (k: string) => new RegExp(`\\b${k}="([^"]*)"`).exec(attrs)?.[1];
    out.push({
      type: attr('type') ?? 'text',
      name: attr('name') ?? '',
      value: attr('value') ?? '',
      checked: /\bchecked=""/.test(attrs),
    });
  }
  return out;
}

/** What the browser submits: every named input except unchecked radios/checkboxes. */
function submitted(html: string): FormData {
  const fd = new FormData();
  for (const f of inputsOf(html)) {
    if (!f.name) continue;
    if ((f.type === 'radio' || f.type === 'checkbox') && !f.checked) continue;
    fd.append(f.name, f.value);
  }
  return fd;
}

test('Event settings asks no deadline: no date input, no deadline wording', async () => {
  const html = await render('2026-12-01', 'final_only');
  const visible = inputsOf(html).filter((f) => f.type !== 'hidden');
  assert.deepEqual(
    visible.filter((f) => f.name === 'guest_list_edit_deadline' || f.type === 'date'),
    [],
    'the card must not show an editable deadline — the RSVP item\'s "Reply by" is its one place',
  );
  assert.doesNotMatch(html, /edit deadline/i);
  // The one control it keeps.
  assert.match(html, /How you see costs/);
  assert.equal(visible.filter((f) => f.name === 'adaptive_pricing_mode').length, 2);
});

test('a cost-view save keeps the stored deadline', async () => {
  const html = await render('2026-12-01', 'final_only');
  const fd = submitted(html);
  // The couple flips the cost view, the only thing this card changes.
  fd.set('adaptive_pricing_mode', 'realtime');
  const parsed = parsePaxSettingsForm(fd);
  assert.ok(parsed.ok);
  assert.equal(parsed.deadline, '2026-12-01', 'saving the cost view cleared the deadline');
  assert.equal(parsed.mode, 'realtime');
});

test('no stored deadline stays no deadline (the 14-day default), not an error', async () => {
  const html = await render(null, 'realtime');
  const parsed = parsePaxSettingsForm(submitted(html));
  assert.ok(parsed.ok);
  assert.equal(parsed.deadline, null);
  assert.equal(parsed.mode, 'realtime');
});
