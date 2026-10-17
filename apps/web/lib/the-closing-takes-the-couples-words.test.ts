/**
 * 🕯 THE CLOSING'S LINE TAKES THE COUPLE'S WORDS AND LOOK — owner 2026-10-17, verbatim: *"and also allow styles on the
 * see you soon and customization. so we can edit the text there."* (`lib/closing-line.ts`).
 *
 * The property, end to end: what the couple types for "See you soon." and the look they give it are what a guest
 * reads — on BOTH sign-offs the shell draws (the plain footer and the art kit's) — and an empty line is "See you
 * soon.", never a blank band. A line nobody touched is the footer exactly as it was. Held here:
 *   1 · the words and the look reach the guest page, through the shell, on both sign-offs;
 *   2 · empty (typed empty, spaces, or never typed) is "See you soon.";
 *   3 · nobody touched it → the sign-off byte for byte as before (a free event keeps its published look);
 *   4 · it is stored where the cover's words are (the hero row's canvas) and gated by the same comparison: its motion
 *       is Pro at Apply, its words and Colour · Size · Width are free — as a cover word's are today;
 *   5 · the Maker's doors: Edit types it (one line, the hero row's write), Style's last row sets its look, Animate
 *       opens its own sheet on the hero row — and a Build in "On arrival" plays as a guest reaches the foot.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HUB_CLOSING_DEFAULT_WORDS, HUB_ELEMENT_FIELDS, hubElementDuringOffered, sanitizeHubElements, sanitizeHubElementStyle, type HubElementStyle } from './element-style';
import { CLOSING_CANVAS_KEY, closingLineMotionVars, closingLineWords, elementCanvasOwner } from './closing-line';
import { sanitizeHubCanvas } from './hub-canvas';
import { canvasLookFacets, canvasLookChange } from './hub-draft';
import { withTypedWords } from './type-in-place';
import { MAKER_PARTS, makerPartOfTap, makerPartToolWorks } from './maker-parts';
import { artKitView } from './art-kits';
import { stripComments } from './strip-comments';
import { ClosingLine } from '../app/[slug]/_components/closing-line';
import { KitClosing } from '../app/[slug]/_components/kit-piece';
import { InvitationShell } from '../app/[slug]/_components/invitation-shell';
import { partLookTarget, partLookFields } from '../app/dashboard/[eventId]/launch/_components/stage-panel/part-look';
import { partWordsWrite, type PartWordsField } from '../app/dashboard/[eventId]/launch/_components/stage-panel/part-words';

(globalThis as unknown as { React: unknown }).React = React;
const h = React.createElement;
const ROOT = join(__dirname, '..');
const code = (p: string) => stripComments(readFileSync(join(ROOT, p), 'utf8'));

/** The couple's line as the hero row's sanitiser keeps it — the only shape the page ever reads. */
const stored = (raw: unknown): HubElementStyle | null => sanitizeHubCanvas({ canvas: { elements: { closing: raw } } }).elements?.closing ?? null;
const OURS = stored({ word: 'Until December!', color: '#1F6F5C', size: 120, font: 'playfair' });
const KIT = { names: 'Maria & Jose', date: 'December 12, 2026', photoUrl: null, mark: 'M & J', twoPeople: true };
const vintage = () => artKitView({ theme: 'vintage', accents: {}, ownsPro: true, tryOn: false })!;
const shell = (closingLine: HubElementStyle | null, kit: boolean) =>
  renderToStaticMarkup(
    h(InvitationShell, { closingLine, kitClosing: kit ? { kit: vintage(), ...KIT } : null } as never, h('p', null, 'the page')),
  );
/** The sign-off line as drawn: its opening tag and its text. */
const signOff = (html: string) => {
  const m = html.match(/<p data-shell-sign-off=""([^>]*)>([\s\S]*?)<\/p>/);
  assert.ok(m, 'no sign-off line drawn');
  return { attrs: m![1]!, text: m![2]!.replace(/<[^>]+>/g, '') };
};

test('1 · the couple’s words and look reach the guest page — through the shell, on both sign-offs', () => {
  assert.ok(OURS?.word && OURS.color && OURS.size, 'the hero row’s sanitiser dropped the closing’s line');
  for (const kit of [false, true]) {
    const line = signOff(shell(OURS, kit));
    const where = kit ? 'the art kit’s sign-off' : 'the plain sign-off';
    assert.equal(line.text, 'Until December!', `${where}: the couple’s words are not drawn`);
    assert.match(line.attrs, /color:#1F6F5C/i, `${where}: the couple’s colour is not drawn`);
    assert.match(line.attrs, /zoom:1\.2/, `${where}: the couple’s size is not drawn`);
    assert.match(line.attrs, /font-family:var\(--/, `${where}: the couple’s font is not drawn`);
    assert.doesNotMatch(line.attrs, /data-el=/, `${where}: a guest is served the Maker’s part key`);
  }
  /* The page hands the shell the hero row's line (draft-overlaid on the Maker's canvas, like every cover word). */
  assert.match(code('app/[slug]/_components/site-body.tsx'), /closingLine=\{heroCanvas\.elements\?\.closing \?\? null\}/);
  /* ✨ Glow (and Shimmer) reach it as they reach a cover word: the hook, and the words cut for the halo. */
  const glow = renderToStaticMarkup(h(ClosingLine, { line: stored({ motion: { during: 'glow' } }), className: 'x' }));
  assert.match(glow, /data-el-motion=""/);
  assert.match(glow, /data-el-glow=""/);
  assert.match(glow, /data-el-w="" data-t="See"/, 'Glow’s words are not cut');
  const shimmer = renderToStaticMarkup(h(ClosingLine, { line: stored({ motion: { during: 'shimmer', band: 'gold' } }), className: 'x' }));
  assert.match(shimmer, /data-el-shimmer="gold"/);
});

test('2 · an empty line is "See you soon." — never a blank band', () => {
  for (const raw of [{ word: '' }, { word: '   ' }, {}, null]) {
    const s = stored(raw);
    assert.equal(s?.word, undefined, `${JSON.stringify(raw)}: an empty word was kept`);
    assert.equal(closingLineWords(s), HUB_CLOSING_DEFAULT_WORDS);
    assert.equal(signOff(shell(s, true)).text, 'See you soon.', `${JSON.stringify(raw)}: the line is not "See you soon."`);
  }
  /* Typing it empty in the Maker, or typing the words it already falls back to, stores no word at all. */
  assert.equal(withTypedWords({ closing: { word: 'Until December!' } }, 'closing', '  ', HUB_CLOSING_DEFAULT_WORDS).elements, null);
  assert.equal(withTypedWords(null, 'closing', 'See you soon.', HUB_CLOSING_DEFAULT_WORDS).elements, null);
  /* It cannot be hidden: a hand-made `hidden` is dropped. */
  assert.ok(!HUB_ELEMENT_FIELDS.closing.includes('hidden'));
  assert.equal(stored({ hidden: true }), null, 'the closing’s line was hidden');
});

test('3 · nobody touched it → the sign-off exactly as before (a free event keeps its published look)', () => {
  const plain = shell(null, false);
  assert.ok(
    plain.includes('<p data-shell-sign-off="" class="font-pahina text-lg italic text-terracotta-700">See you soon.</p>'),
    'the plain sign-off changed for an event that chose nothing',
  );
  const kit = renderToStaticMarkup(h(KitClosing, { kit: vintage(), ...KIT, hideWatermark: false }));
  assert.match(
    kit,
    /<p data-shell-sign-off="" class="mx-4 mb-6 mt-5 font-pahina text-\[1\.625rem\] italic" style="color:#[0-9A-Fa-f]{6}">See you soon\.<\/p>/,
    'the kit’s sign-off changed for an event that chose nothing',
  );
});

test('4 · stored beside the cover’s words, gated by the same comparison: motion Pro at Apply, words and look free', () => {
  assert.equal(elementCanvasOwner(CLOSING_CANVAS_KEY), 'hero');
  assert.equal(elementCanvasOwner('f:hero'), 'hero');
  assert.equal(elementCanvasOwner('w:countdown'), 'countdown');
  const live = sanitizeHubCanvas({ canvas: {} });
  const look = sanitizeHubCanvas({ canvas: { elements: { closing: { word: 'Until December!', color: '#1F6F5C', size: 120, width: 'wide' } } } });
  assert.equal(canvasLookChange(live, look, 'hero'), 'none', 'the closing’s words or look are priced — a cover word’s are free');
  const moving = sanitizeHubCanvas({ canvas: { elements: { closing: { motion: { during: 'glow' } } } } });
  assert.equal(canvasLookChange(live, moving, 'hero'), 'add', 'the closing’s Animate is not Pro at Apply');
  assert.ok(
    canvasLookFacets(live, moving, 'hero').some((f) => f.element === 'closing' && f.group === 'part-motion' && f.change === 'add'),
    'the Apply sheet cannot name the closing’s Animate',
  );
  /* …and the Apply sheet's "Go to" reaches the Closing itself, never the cover. */
  assert.match(code('lib/hub-pro-effects.ts'), /\.\.\.\(closing \? \{ fixed: 'closing' \} : fixedOf\(item\.widgetType\)\)/);
});

test('5 · the Maker’s doors: Edit types it, Style’s last row sets its look, Animate opens its sheet on the hero row', () => {
  assert.equal(MAKER_PARTS.closing.el, 'closing');
  for (const tool of ['edit', 'style', 'animate'] as const) assert.ok(makerPartToolWorks('closing', tool), `the Closing’s ${tool} is grey`);
  assert.equal(makerPartToolWorks('closing', 'bg'), false);
  /* A tap on the line picks the Closing; a tap on the oval or the band still does. */
  assert.equal(makerPartOfTap('save_the_date', 'home', CLOSING_CANVAS_KEY, 'closing'), 'closing');
  assert.equal(makerPartOfTap('save_the_date', 'home', CLOSING_CANVAS_KEY, null), 'closing');
  /* Style's last row: Colour · Size · Width, written to the hero row (the Accent ◆ ▾ stays the work area's). */
  const t = partLookTarget(CLOSING_CANVAS_KEY, 'closing');
  assert.deepEqual(t, { key: CLOSING_CANVAS_KEY, widgetType: 'hero', el: 'closing' });
  assert.deepEqual(partLookFields(t), { colour: true, size: true, width: true });
  assert.match(code('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx'), /if \(fixed === 'closing'\) return accentRowFor\('sign-off'\);/);
  /* Edit: the typed words are ONE write of the hero row's canvas, under its queue key. */
  const f: PartWordsField = { key: CLOSING_CANVAS_KEY, el: 'closing', field: null, label: 'Closing', text: 'See you soon.', auto: HUB_CLOSING_DEFAULT_WORDS, long: false, maxLength: 60, twoPeople: false };
  const w = partWordsWrite(f, 'Until December!', { heroCanvas: {}, ownWords: null });
  assert.ok(w.ok && w.patch, 'typing the closing writes nothing');
  assert.deepEqual((w.patch as { widgets: { hero: { canvas: { elements: unknown } } } }).widgets.hero.canvas.elements, { closing: { word: 'Until December!' } });
  /* Animate opens the part's sheet on the hero row — never on a 'closing' widget that does not exist. */
  assert.match(code('app/dashboard/[eventId]/launch/_components/stage-tools.tsx'), /widgetType: elementCanvasOwner\(def\.canvas\)/);
  /* …and on its sheet no Delay and no Leaves (no next scene; the hero's hand-off is not its to set). */
  assert.match(
    code('app/dashboard/[eventId]/website/editor/_components/element-sheet.tsx'),
    /\{\.\.\.\(target\.key === 'f:closing' \? \{ delay: null, leaves: null \} : \{\}\)\}\s*\/>/,
    'the closing’s Animate offers a Delay or the hero’s Leaves',
  );
  /* Its Action ▾ is a word's, with Glow — not Words ▾ (a clock at the foot plays out of sight). */
  assert.deepEqual([...hubElementDuringOffered('closing')], ['still', 'drift', 'shimmer', 'glow']);
  assert.equal(sanitizeHubElementStyle({ motion: { words: 'word' } }, 'closing'), null, 'Words ▾ was kept on the closing');
  /* 🧭 "On arrival" plays as a guest reaches the foot — the line's own view, never the clock at load. */
  const vars = Object.fromEntries(closingLineMotionVars(stored({ motion: { in: { fade: true } } })));
  assert.match(vars['--el-tl'] ?? '', /view\(\)/, 'the closing’s Build in plays on the clock, at load, out of sight');
  assert.ok(vars['--el-anim-t'], 'an engine without scroll timelines never plays it');
  assert.equal(sanitizeHubElements({ closing: { word: 'x'.repeat(61) } }), null, 'a closing longer than one line was kept');
});
