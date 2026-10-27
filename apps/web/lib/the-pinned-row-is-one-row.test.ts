/**
 * the-pinned-row-is-one-row.test.ts — 🔒 ON SCROLL, EACH MENU PINS ONE ROW, AND THE ROW KEEPS ITS SELECTOR.
 *
 * Owner 2026-10-27 (DECISION_LOG "PINNED ROWS ON SCROLL — ONE ROW PER MENU (Guests B · Home A · Suppliers A)" and
 * "PINNED ROWS KEEP THEIR SELECTORS — SIMPLIFIED"; verbatim "pinned approve", "On the pinned the selectors should stay
 * but simplified"; prototype `prototypes/guests_pinned_row_2026-10-27/`):
 *
 *   · GUESTS — the sticky block is ONE 44-px row. Its pinned face is `List · Map` (the shipped pill, small, words only —
 *     no Settings) · the three reply doors (the SAME `data-reply-filter` doors as the strip) · `Invite N ›` (the SAME
 *     `/guests/send` door). The Replies strip (%, bar, +1s, Excel, ⓘ) is OUT of the sticky block — it scrolls. The
 *     summary face lies over the full pill (absolute), so the block's in-flow height never changes.
 *   · HOME — the cover band pins with a NEGATIVE top; stuck, one line `<names> · <date> · ⚙`. No selector; the ⚙
 *     (Event Details) is its one control.
 *
 * ⚙ EVERY PINNED ROW ENDS WITH ITS MENU'S ⚙ (owner 2026-10-27, "EVERY MENU'S ⚙ RIDES ITS PINNED ROW TOO" and "THE
 * PINNED ROW IS THE APP-WIDE TEMPLATE": selector or name line · counts · one action · ⚙). Guests' ⚙ is ONE mounted
 * button both faces show (the summary face stops short of it), so `every-menu-has-one-settings-button` still counts one.
 * Suppliers' ⚙ is the same mounted button at rest and pinned (the row IS the pinned row).
 *
 * Sabotage (2026-10-27, ⚙ ends, each reverted): Guests ⚙ moved before the pill · `data-has-gear` dropped · the face's
 * `right: 52px` → 0 · Home's ⚙ removed · a second control in Home's line · Suppliers ⚙ removed · a control after
 * Suppliers ⚙ — each red.
 *   · SUPPLIERS — only `Find · Build · Booked · ⚙` pins; the date · place line is plain content above it and scrolls away.
 *
 * Sabotage (2026-10-27, each reverted): the counts strip moved back inside `data-guests-stick` → Guests test red;
 * `pinSeg('share', 'Settings')` added to the pinned face → Guests test red; `pinSeg('map', …)` removed → red;
 * `{factsSlot}` moved back inside `data-suppliers-stick` → Suppliers test red; a `<button>` added to the Home pin → red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';
import { guestRow, renderGuestsScreen } from '@/app/dashboard/[eventId]/guests/_components/render-guests-screen';

const APP = join(process.cwd(), 'app', 'dashboard', '[eventId]');
const read = (...p: string[]) => stripComments(readFileSync(join(APP, ...p), 'utf8'));
const count = (s: string, needle: string | RegExp) =>
  typeof needle === 'string' ? s.split(needle).length - 1 : (s.match(needle) ?? []).length;

test('Guests — the sticky block is one row; its pinned face keeps List · Map, the three doors and Invite', async () => {
  const guests = [
    guestRow({ role: 'bride', rsvp_status: 'attending', custom_tags: [] } as never),
    guestRow({ role: 'groom', side: 'groom', rsvp_status: 'attending', custom_tags: [] } as never),
    ...Array.from({ length: 5 }, (_, i) => guestRow({ first_name: `Ask${i}`, invitation_sent_at: null, custom_tags: [] } as never)),
  ];
  const html = await renderGuestsScreen({ guests, setup: React.createElement('p', null, 'the sheet rows') });
  const at = html.indexOf('data-guests-stick');
  const stripAt = html.indexOf('data-roster-counts');
  assert.ok(at > -1 && stripAt > at, 'the sticky block or the Replies strip is gone');
  const stick = html.slice(at, stripAt);

  // ONE ROW: nothing of the strip rides in the sticky block.
  for (const piece of ['data-replied-meter', 'data-plus-filter', 'gs-replied-pct', 'data-roster-excel', 'Excel']) {
    assert.equal(count(stick, piece), 0, `"${piece}" is pinned again — the pinned block is one row`);
  }

  // The summary face: List · Map (no Settings), the three doors, one Invite.
  const faceAt = stick.indexOf('data-guests-pin-face="summary"');
  const fullAt = stick.indexOf('data-guests-segmented');
  assert.ok(faceAt > -1 && fullAt > faceAt, 'the pinned summary face is gone (or drawn after the full pill)');
  const face = stick.slice(faceAt, stick.lastIndexOf('<nav', fullAt));
  const segs = [...face.matchAll(/data-guests-pin-seg="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(segs, ['list', 'map'], `the pinned selector reads ${segs.join(' · ')} — it is List · Map, simplified`);
  assert.equal(count(face, /<nav\b/g), 1, 'the pinned face has one selector');
  assert.doesNotMatch(face, />Settings<|data-guests-seg="share"/, 'Settings rides in the pinned row');
  const doors = [...face.matchAll(/data-reply-filter="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(doors, ['attending', 'declined', 'none'], 'the pinned row lost a reply door');
  assert.equal(count(face, 'href="/dashboard/e1/guests/send"'), 1, 'the pinned Invite is not the one send door');
  assert.match(face, /data-roster-to-invite="door"/);

  // The full pill — List · Map (Settings became the ⚙, 27 Oct) — is still the face at rest.
  const fullEnd = stick.indexOf('</nav>', fullAt);
  const full = stick.slice(fullAt, fullEnd);
  assert.deepEqual([...full.matchAll(/data-guests-seg="(\w+)"/g)].map((m) => m[1]), ['list', 'map']);

  // ⚙ THE ROW ENDS WITH ITS ⚙ — ONE mounted button that BOTH faces show: exactly one in the sticky block, not in the
  // summary face, right after the full pill's </nav> as the first row's last child, and nothing pressable after it.
  assert.equal(count(stick, 'data-menu-settings="guests"'), 1, 'the Guests sticky block does not hold exactly one ⚙');
  assert.equal(count(face, 'data-menu-settings'), 0, 'the summary face mounts its own ⚙ — two buttons for one door');
  const gearAt = stick.indexOf('data-menu-settings="guests"');
  assert.ok(gearAt > fullEnd, 'the ⚙ is not after the selector — the row does not end with it');
  const firstRow = stick.slice(stick.lastIndexOf('data-first-row', fullAt));
  const afterGear = firstRow.slice(firstRow.indexOf('data-menu-settings="guests"'));
  assert.ok(/^[^]*?<\/button><\/span><\/div>/.test(afterGear), 'something sits after the ⚙ in the first row');
  assert.equal(count(afterGear.slice(0, afterGear.search(/<\/button><\/span><\/div>/)), /<(a|button)\b/g), 1, 'the ⚙ is not the row\'s last control');
  assert.ok(stick.indexOf('data-has-gear') > -1, 'the sticky block does not say it holds a ⚙ — the summary face would cover it');

  // Same box: the face is laid OVER the pill's 44 px; the block pads 8 / 8.
  const css = readFileSync(join(APP, 'guests', '_components', 'guests-screen.module.css'), 'utf8');
  assert.match(css, /\.stick\.pinned \{\s*padding: 8px 0;/, 'the pinned block is not 8 + 44 + 8');
  assert.match(css, /\.face \{\s*position: absolute;[^}]*height: 44px;/, 'the summary face is not laid over the pill — the swap would move the list');
  // The ⚙ is never faded with the pill, and the face stops short of it — so pinned, the row still ends with it.
  assert.match(css, /\.stick\.pinned\[data-has-gear\] \.face \{\s*right: 52px;/, 'the summary face covers the ⚙ when pinned');
  assert.match(css, /\.stick\.pinned\[data-collapsed\] \[data-first-row\] > \[data-guests-segmented\] \{\s*opacity: 0;/, 'pinned, the full pill no longer fades (or the whole first row — ⚙ included — does)');
  assert.doesNotMatch(css, /\[data-collapsed\][^{]*\[data-first-row\]\s*\{|\[data-collapsed\][^{]*\[data-menu-settings/, 'pinned, the ⚙ is faded out');
});

test('Suppliers — only Find · Build · Booked · ⚙ pins; the date · place line scrolls away above it', () => {
  const src = read('vendors', '_components', 'services-takeover.tsx');
  const at = src.indexOf('data-suppliers-stick=""');
  assert.ok(at > -1, 'the pinned row is gone');
  const open = src.lastIndexOf('<div', at);
  const close = src.indexOf('</ISegmented>', at);
  assert.ok(close > at, 'the pinned row lost its selector');
  const stick = src.slice(open, close);
  assert.match(stick, /className="[^"]*\bsticky\b/, 'the selector row is not sticky');
  assert.equal(count(stick, /<ISegmented\b/g), 1, 'the pinned row holds one selector');
  assert.match(stick, /SUPPLIERS_MODES\.map\(/, 'the pinned selector is not Find · Build · Booked');
  assert.equal(count(stick, '{factsSlot}'), 0, 'the date · place line is pinned again — two rows');
  const facts = src.indexOf('{factsSlot}');
  assert.ok(facts > -1 && facts < open, 'the date · place line must sit above the pinned row, as plain content');

  // ⚙ The row ENDS with Suppliers ⚙ (owner 2026-10-27, "SUPPLIERS GETS ITS ⚙" + "EVERY MENU'S ⚙ RIDES ITS PINNED ROW
  // TOO"): the row is the menu's first row, and after the selector comes its ONE ⚙ and nothing else before </div>.
  const rowEnd = src.indexOf('</div>', close);
  const tail = src.slice(close + '</ISegmented>'.length, rowEnd);
  assert.match(src.slice(open, at + 400), /data-first-row=""/, 'the pinned row is not marked as the menu’s first row');
  assert.equal(count(tail, /<MenuSettingsButton\b[^>]*\bmenu="suppliers"/g), 1, 'the pinned row does not end with Suppliers ⚙');
  assert.equal(count(tail, /<(?!\/|MenuSettingsButton\b)[A-Za-z]/g), 0, 'something besides the ⚙ is drawn after the selector');
});

test('Home — the cover pins as one line: names · date · ⚙, the ⚙ its one control', async () => {
  const band = read('_components', 'home-cover-band.tsx');
  assert.match(band, /\bsticky top-\[calc\(var\(--home-bar\)-var\(--home-band-h\)\+52px\)\]/, 'the cover band does not pin with a negative top');
  assert.match(band, /<HomeCoverPin name=\{cover\.name\} date=\{cover\.shortDate\} settingsHref=\{settingsHref\} \/>/);
  assert.match(read('_components', 'home-first-screen.tsx'), /<HomeCoverBand [^>]*settingsHref=\{`\/dashboard\/\$\{eventId\}\/details`\}/, 'the Home does not hand its pinned line the ⚙');
  const pin = read('_components', 'home-cover-pin.tsx');
  assert.doesNotMatch(pin, /<button\b|<Link\b|<select\b|<nav\b/, 'the Home pin grew a control besides its ⚙ — Home has no selector');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HomeCoverPin } = await import('@/app/dashboard/[eventId]/_components/home-cover-pin');
  const html = renderToStaticMarkup(React.createElement(HomeCoverPin, { name: 'Cale & Ice', date: 'Dec 5', settingsHref: '/dashboard/e1/details' }));
  assert.match(html, /^<span data-home-cover-pin=""[^>]*\bh-\[52px\]/, 'the pinned line is not one 52-px line');
  // <names> · <date> · ⚙ — the ⚙ the LAST thing in the line, its one control, opening Event Details.
  assert.match(html, /Cale &amp; Ice<\/span><span[^>]*>Dec 5<\/span><span data-home-pin-gear=""[^>]*><a\b[^>]*href="\/dashboard\/e1\/details"[^>]*>(?:(?!<a\b|<button\b).)*<\/a><\/span><\/span>$/, 'the pinned line does not end with its ⚙');
  assert.equal(count(html, /<(a|button)\b/g), 1, 'the pinned line holds another control besides its ⚙');
});
