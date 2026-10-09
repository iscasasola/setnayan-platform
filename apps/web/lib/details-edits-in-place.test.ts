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
  // Part 2b: the special message is its OWN component (Details › Words, and the
  // stage's tap), drawn under its print switch as the same node.
  /* RE-AIMED 2026-10-09 (Studio › Prints): the include switches are drawn by `IncludeSwitch` — the shipped `Toggle` in the shipped Maker, the Form row's switch in the Studio — over the SAME children,
     so the special message is still the same node under its print switch (the anchor was the tag's old name). */
  assert.match(src, /name="inc_special_message"[^>]*>[^<]*?\{facts\['special-message'\]\}\s*<\/(?:Toggle|IncludeSwitch)>/, 'the special message is typed where it prints');
  assert.match(src, /'special-message': \(\s*<SpecialMessageField\b/, 'the special message editor is the shared one');
  assert.match(read('special-message-field.tsx'), /<form action=\{action\} data-details-special=""/, 'the special message posts its one writer');
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
        { key: 'address', group: 'event', label: 'Address', icon: null },
        { key: 'qr', group: 'event', label: 'QR code', icon: null },
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

test('🗂 Your event is ONE form: one row in the list, every field’s editor shown one under the other, named (owner 2026-10-06)', async () => {
  const React = (await import('react')).default;
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DetailsWorkspace, detailsListGroups } = await import('../app/dashboard/[eventId]/launch/_components/details-workspace');
  const groups = [
    { key: 'look', label: 'Look', items: [{ key: 'background' as const, group: 'look' as const, label: 'Background', icon: null }] },
    {
      key: 'event',
      label: 'Your event',
      form: true as const,
      items: [
        { key: 'names' as const, group: 'event' as const, label: 'Event Name', icon: null },
        { key: 'date' as const, group: 'event' as const, label: 'Date', icon: null },
        { key: 'qr' as const, group: 'event' as const, label: 'QR code', icon: null },
      ],
    },
    { key: 'elsewhere', label: 'Elsewhere', hidden: true as const, items: [{ key: 'papic' as const, group: 'elsewhere' as const, label: 'Photos', icon: null }] },
  ];
  // The list: Look's row, ONE "Your event" row keyed by the field showing, and no hidden row.
  const list = detailsListGroups(groups, 'date');
  assert.deepEqual(list.map((g) => g.key), ['look', 'event']);
  assert.deepEqual(list[1]!.items.map((i) => [i.key, i.label]), [['date', 'Your event']]);
  const html = renderToStaticMarkup(
    React.createElement(DetailsWorkspace, {
      groups,
      bodies: { names: 'N-BODY', date: 'D-BODY', qr: 'Q-BODY', background: 'B-BODY', papic: 'P-BODY' },
      editors: { names: 'NAMES-EDITOR', date: 'DATE-EDITOR', qr: 'QR-EDITOR', background: 'BG-EDITOR', papic: 'PAPIC-EDITOR' },
      initial: 'date',
    }),
  );
  const shown = (k: string) => {
    const tag = new RegExp(`<div[^>]*data-details-editor="${k}"[^>]*>`).exec(html)?.[0] ?? '';
    assert.ok(tag, `anti-vacuity: no editor wrapper for ${k}`);
    return !/hidden=""/.test(tag);
  };
  for (const k of ['names', 'date', 'qr']) assert.ok(shown(k), `${k} is not shown in the Your event form`);
  assert.ok(!shown('background') && !shown('papic'), 'an item outside the form shows with it');
  for (const label of ['Event Name', 'Date', 'QR code']) assert.match(html, new RegExp(`data-details-form-heading="[a-z]+"[^>]*>${label}<`), `${label} is not named in the form`);
  // Hidden items stay MOUNTED (their fields still post) but are never a list row.
  assert.match(html, /PAPIC-EDITOR/);
  assert.doesNotMatch(html, /data-details-nav-item="papic"/, 'a hidden item is drawn as a row');
  // Sabotage (2026-10-06): dropping `formKeys.has(k)` from `showsEditor` turned this red ("names is not shown…").
});
