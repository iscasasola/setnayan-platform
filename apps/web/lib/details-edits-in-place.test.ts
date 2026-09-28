/**
 * details-edits-in-place.test.ts — owner 2026-09-28 (DECISION_LOG "NO 'GO EDIT
 * IT OVER THERE' LINKS — EDIT IT WHERE YOU ARE"): on the Maker's Details page a
 * text-carrying switch shows its field right there, and the parents are
 * opened AND added right there. Held by source: no link sends the couple to the
 * Guest list to do it, and each edit goes through its shipped writer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const L = join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'launch', '_components');
const read = (f: string) => stripComments(readFileSync(join(L, f), 'utf8'));

test('a parent is opened and ADDED in place — the Guest list’s own add, the parent role preset', () => {
  const src = read('parent-cards.tsx');
  assert.doesNotMatch(src, /<Link\b|href=[^>]*\/guests|guestsHref/, 'a parent is sent to the Guest list again');
  assert.match(src, /import \{ addSingleGuest \} from '\.\.\/\.\.\/guests\/inline-actions';/, 'not the shipped single-guest add');
  assert.match(src, /roleHint: side === 'bride' \? \('bride_parents' as const\) : \('groom_parents' as const\)/);
  assert.match(src, /makerSave\(\(\) => addSingleGuest\(eventId, draft\), requestMakerRefresh\)/);
  // …and the new parent's card opens once the list carries it.
  assert.match(src, /setPendingOpen\(r\.guest\.guest_id\)/);
  // A parent opens their OWN card — never a names-only box over a full-row write.
  assert.doesNotMatch(src, /updateGuest|name="first_name"/);
});

test('the Details page links out to edit nothing it can edit in place', () => {
  const src = read('maker-details.tsx');
  assert.doesNotMatch(src, /Edit on Guest list|Add parents on your Guest list|Edit in [A-Z]|Write it ↗/);
  assert.match(src, /<PabuyaMessageEditor eventId=\{eventId\}/, 'the thank-you is typed where it prints');
  assert.match(src, /<form action=\{specialMessageAction\} data-details-special=""/, 'the special message is typed where it prints');
  assert.match(src, /<ParentCards eventId=\{eventId\} parents=\{parents\} \/>/);
});

test('ONE item shows at a time — a hidden item carries no display class that would override `hidden`', async () => {
  // Caught on a 390 px phone (the Details lab, 2026-09-29): every editor showed at
  // once, because Tailwind's `flex` beats the `hidden` attribute's display:none.
  const React = (await import('react')).default;
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DetailsWorkspace } = await import('../app/dashboard/[eventId]/launch/_components/details-workspace');
  const html = renderToStaticMarkup(
    React.createElement(DetailsWorkspace, {
      groups: [{ key: 'hub', label: 'Your Event Hub', items: [
        { key: 'address', group: 'hub', label: 'Address', icon: null },
        { key: 'qr', group: 'hub', label: 'QR code', icon: null },
      ] }],
      bodies: { address: 'ADDRESS-BODY', qr: 'QR-BODY' },
      editors: { address: 'ADDRESS-EDITOR', qr: 'QR-EDITOR' },
      initial: 'address',
    }),
  );
  const editor = (k: string) => new RegExp(`<div hidden=""[^>]*data-details-editor="${k}"[^>]*>|<div[^>]*data-details-editor="${k}"[^>]*>`).exec(html)?.[0] ?? '';
  assert.doesNotMatch(editor('address'), /hidden=""/, 'the picked item is hidden');
  assert.match(editor('qr'), /hidden=""/, 'an item not picked is showing');
  assert.match(editor('qr'), /class="hidden"/, 'a hidden item keeps a display class that overrides `hidden`');
  assert.doesNotMatch(html, /QR-BODY/, 'a body not yet opened was drawn');
});
