/**
 * the-stages-panel-wears-the-templates.test.ts — IN THE STAGES PANEL A SWITCH, AN ⓘ AND A CHOICE OF VALUES ARE THE
 * APP'S OWN TEMPLATES, NOT THE PANEL'S.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9, APPROVED): *"switch is teracota or greyed out"* · *"explanation on
 * what you show is for desktop / there is an appropriate info like a center screen popup?"* · § 2: *"3+ options →
 * ONE dropdown"*.
 *
 *   (1) THE SWITCH — rendered: the panel's switch is the ONE drawing (`SwitchTrack`, 50 × 30), on a 44-px tap, its
 *       name, state and handler the caller's. (The watch over every switch is `every-switch-wears-the-one-look`.)
 *   (2) THE ⓘ — rendered: the explanation template (`Explain`) — its own 44-px button that opens a dialog — never the
 *       older hover note; in the panel's rows AND in the ＋ sheet.
 *   (3) "HOW CLOSE" — one of three values is ONE dropdown that writes the same value, never a row of segments.
 *   (4) A REVEAL CARD'S NAME READS WHOLE — nothing in its caption can cut a word; its ◆ Pro mark has its own line.
 *   (The slider is `the-slider-is-one-drawing`; buttons and marks are `the-stages-panel-wears-the-accent`.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { SP_LOOK_MARK, SP_LOOK_NAME_WHOLE, SP_SWITCH } from './maker-stage-room';
import { phoneHeightPx } from './maker-phone-room';
import { SWITCH_TRACK } from '../app/_components/switch-track';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const PANEL = `../${L}/stage-panel`;

test('(1) the panel’s switch is the ONE drawing — 50 × 30 inside a 44-px tap — and still the caller’s switch', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PanelSwitch } = await import(`${PANEL}/kit`);
  const draw = (on: boolean) => renderToStaticMarkup(React.createElement(PanelSwitch, { on, label: 'Fade in', data: 'in-fade', onChange: () => {} }));
  for (const on of [true, false]) {
    const html = draw(on).replace(/&#x27;/g, "'");
    assert.match(html, new RegExp(`^<button type="button" role="switch" aria-checked="${on}" aria-label="Fade in" data-stage-switch="in-fade" class="[^"]*">`), 'its name, state or mark changed');
    /* Inside it: exactly the shared track, told whether it is on — and nothing else. */
    assert.equal(html.slice(html.indexOf('>') + 1), `<span aria-hidden="true" data-on="${on}" class="${SWITCH_TRACK}"></span></button>`, 'the panel draws a track of its own');
  }
  for (const c of ['h-[30px]', 'w-[50px]']) assert.ok(SWITCH_TRACK.split(' ').includes(c), 'anti-vacuity: the shared track is not the approved 50 × 30');
  assert.ok((phoneHeightPx(SP_SWITCH, 812) ?? 0) >= 44, 'the switch is under 44 px to the finger');
  assert.ok(SP_SWITCH.split(' ').includes('w-[50px]'), 'the tap is not as wide as the track it holds');
  /* The handler flips it. */
  const kit = read(`${L}/stage-panel/kit.tsx`);
  assert.match(kit, /role="switch" aria-checked=\{on\} aria-label=\{label\} data-stage-switch=\{data\} onClick=\{\(\) => onChange\(!on\)\} className=\{SP_SWITCH\}>\s*<SwitchTrack on=\{on\} \/>/);
  /* The Reveal's per-stage switches are this same piece. */
  assert.match(read(`${L}/maker-reveal.tsx`), /<PanelSwitch on=\{revealSwitchOn\(now, st\)\}/);
});

test('(2) the ⓘ is the explanation template — a 44-px button that opens a dialog — never the hover note; in the rows and in the ＋ sheet', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { About, Dd } = await import(`${PANEL}/kit`);
  const html = renderToStaticMarkup(React.createElement(About, { label: 'on this stage' }, 'Auto shows it when it has content.'));
  assert.match(html, /^<span class="inline-flex h-11 w-8 shrink-0 items-center justify-center" data-stage-about=""><button type="button" data-explain="" aria-label="About On this stage" aria-haspopup="dialog" aria-expanded="false" class="([^"]*)">/, 'the ⓘ is not the explanation template’s button, named for what it explains');
  const cls = /<button[^>]*class="([^"]*)"/.exec(html)![1]!.split(' ');
  assert.ok(cls.includes('h-11'), 'the ⓘ is under 44 px tall');
  assert.ok(cls.includes('sn-press'), 'the ⓘ does not answer a press');
  /* CLOSED, its words are not on the panel at all (the hover note kept them in the page, under a tooltip). */
  assert.doesNotMatch(html, /role="tooltip"|sn-tip|Auto shows it/, 'the older hover note is back');
  /* A row's ⓘ sits BESIDE its dropdown, never inside it. */
  const row = renderToStaticMarkup(React.createElement(Dd, { small: 'On this stage', label: 'Show this scene', data: 'show', value: 'a', options: [{ key: 'a', label: 'Shown' }], onPick: () => {}, about: 'Auto shows it when it has content.' }));
  assert.match(row, /data-stage-dd="show"[\s\S]*<\/div><span[^>]*data-stage-about=""><button[^>]*data-explain=""/, 'the ⓘ is inside the dropdown, or gone');
  const kit = read(`${L}/stage-panel/kit.tsx`);
  assert.match(kit, /import \{ Explain \} from '@\/app\/_components\/explain';/);
  assert.doesNotMatch(kit, /info-tip|<InfoTip\b/, 'the panel’s kit still draws the hover note');
  const sheet = read(`${L}/add-part-sheet.tsx`);
  assert.match(sheet, /<Explain title=\{p\.label\}>\{p\.path\.note\}<\/Explain>/, 'a part that is waiting does not say why behind the template’s ⓘ');
  assert.doesNotMatch(sheet, /info-tip|<InfoTip\b/);
});

test('(3) “How close” is ONE dropdown over its three values — and writes the value a segment used to', () => {
  const row = read(`${E}/scene-background-row.tsx`);
  const at = row.indexOf('label="How close"');
  assert.ok(at > 0, 'How close is gone');
  const block = row.slice(row.lastIndexOf('<', at), row.indexOf('/>', at));
  assert.match(block, /^<PickMenu\s+label="How close"/, 'How close is not a dropdown');
  assert.match(block, /value=\{String\(shown\.zoom \?\? HUB_DEFAULT_ZOOM\)\}/, 'it does not show the value in force');
  assert.match(block, /options=\{HUB_ZOOMS\.map\(\(z\) => \(\{ key: String\(z\), label: z === 100 \? 'As it is' : z === 120 \? 'Closer' : 'Closest' \}\)\)\}/, 'its three choices or their words changed');
  assert.match(block, /const z = HUB_ZOOMS\.find\(\(x\) => String\(x\) === k\);\s*if \(z\) putKeys\(\{ zoom: z \}\);/, 'a pick does not write the zoom');
  assert.doesNotMatch(row, /<ISegmented label="How close">/, 'the row of segments is back');
  /* What stays a two-way selector there is two-way. */
  assert.match(row, /<ISegmented label="Framed or full width">/);
});

test('(4) a Reveal opening’s name reads whole — no class that can cut it — and its ◆ Pro mark sits on a line of its own under it', () => {
  /* Seen on the Maker lab at 375 (2026-10-09): "r-flap envelope ◆ PR" / "wo-flap side ◆ PRO" — the name and its mark,
     side by side and centred in a clipped one-line box narrower than they are, lost letters at BOTH ends. */
  const name = SP_LOOK_NAME_WHOLE.split(' ');
  for (const cut of ['truncate', 'overflow-hidden', 'whitespace-nowrap', 'text-ellipsis']) assert.ok(!name.includes(cut), `the name can be cut (“${cut}”)`);
  assert.ok(!name.some((c) => /^(?:h-|max-h-|line-clamp-)/.test(c)), 'the name is held to a height — a second line would be cut');
  assert.ok(name.includes('whitespace-normal'), 'the name cannot take a second line');
  assert.ok(name.includes('[overflow-wrap:normal]'), 'a word may be broken in the middle');
  /* It still never widens the card: as wide as the frame, whatever it says. */
  for (const c of ['w-0', 'min-w-full']) assert.ok(name.includes(c) && SP_LOOK_MARK.split(' ').includes(c), `the caption can widen its card (no “${c}”)`);
  const reveal = read(`${L}/maker-reveal.tsx`);
  const card = reveal.slice(reveal.indexOf('data-maker-reveal-kind={o.id}'), reveal.indexOf('</button>', reveal.indexOf('data-maker-reveal-kind={o.id}')));
  assert.ok(card.length > 400, 'anti-vacuity: the opening’s card was not found');
  /* The name: the label alone. The mark: after it, in its own line — never inside the name's box. */
  assert.match(card, /<span data-reveal-kind-name="" className=\{`\$\{SP_LOOK_NAME_WHOLE\} [^`]*`\}>\s*\{o\.label\}\s*<\/span>\s*\{mark \? \(\s*<span data-reveal-kind-mark="" className=\{SP_LOOK_MARK\}>\s*<PaidMark /, 'the name shares its line with the mark, or is no longer the label alone');
  assert.doesNotMatch(card, /SP_LOOK_NAME\}|!inline-flex|truncate/, 'the one-line, cut caption is back on an opening’s card');
  /* The widest name there is today, against the frame: it NEEDS the second line (so the fix is not decoration). */
  const css = read('app/globals.css');
  const frame = Number(/\.sn-phone-card \{[^}]*inline-size: var\(--phone-card-w, (\d+)px\)/.exec(css)?.[1]);
  assert.equal(frame, 112, 'the frame’s width moved — re-measure the names against it');
});
