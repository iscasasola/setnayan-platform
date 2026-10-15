/**
 * 🔠🎨 STAGES › A PART › STYLE › SIZE AND COLOUR REACH EVERY WORD THE PART DRAWS.
 *
 * Owner, 2026-10-14, on the live Maker: *"on the stages. Style Size is inconsistent"* → *"when we where changing size,
 * the text did not shrink, the highlight just moved"*. Measured on the Maker lab, 2026-10-15 (glyph heights read from a
 * Range over each word, never the inline style): every cover part scaled with the slider, but on the Countdown, the
 * Message, What to bring and the Love Story the slider went 100 % → 120 % and NOT ONE word changed — the row wrote
 * `elements.heading` (`stage-panel/part-look.ts`), and those scenes draw no heading. Colour, the same row, the same
 * write: the same dead circle. Owner, 2026-10-15: Colour → *"All the words"*; Dress code's chip names and do / don't
 * lines → *"Yes, include them"* (both follow Size AND Colour).
 *
 * The claim, tested the way the couple sees it: for every part the Maker offers a Size or a Colour on, the value it
 * saves (`partLookNext`) becomes a rule the page's own stylesheet lays (`hubElementSceneCss` / `hubElementDeclarations`
 * — the guest page and the Maker's canvas both draw from them), and EVERY word the scene renders — mounted through the
 * real dispatcher (`HideableWidgetRender`), as the guest page mounts it, in every Dress code palette and do / don't
 * look — sits inside an element that rule reaches. A word no rule reaches is a word the row cannot change.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {
  HUB_SCENE_ELEMENT_KEYS,
  HUB_SCENE_ELEMENT_SELECTOR,
  hubElementDeclarations,
  hubElementSceneCss,
  hubElementSizePct,
  type HubElementKey,
} from './element-style';
import { MAKER_PARTS, type MakerPartKey } from './maker-parts';
import { PALETTE_LOOK_IDS } from './palette-looks';
import { DOS_LOOK_IDS } from './dress-code-looks';
import {
  partLookFields,
  partLookNext,
  partLookSizes,
  partLookTarget,
} from '../app/dashboard/[eventId]/launch/_components/stage-panel/part-look';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

type Field = 'size' | 'color';
const FIELDS: readonly Field[] = ['size', 'color'];
const PICK = { size: null as number | null, color: '#123456' };

/** Every part the Maker draws this field for, with the words the pick is written on. */
function lookParts(field: Field) {
  const out: Array<{ part: MakerPartKey; key: string; widgetType: string; written: HubElementKey[] }> = [];
  for (const part of Object.keys(MAKER_PARTS) as MakerPartKey[]) {
    const def = MAKER_PARTS[part];
    const t = partLookTarget(def.canvas, def.el ?? null);
    if (!t || !partLookFields(t)[field === 'size' ? 'size' : 'colour']) continue;
    const value = field === 'size' ? partLookSizes(t.el).find((s) => s > 100)! : PICK.color;
    const next = partLookNext(t, {}, field, value);
    assert.ok(next, `${part}: a ${field} pick changed nothing on the canvas`);
    const written = (Object.keys(next.elements ?? {}) as HubElementKey[]).filter((k) =>
      field === 'size' ? hubElementSizePct(next.elements?.[k]?.size) !== null : next.elements?.[k]?.color === PICK.color,
    );
    out.push({ part, key: t.key, widgetType: t.widgetType, written });
  }
  return out;
}

/* ── the scene's words, as React draws them ─────────────────────────────── */
type El = { tag: string; classes: Set<string>; parent: El | null; unseen: boolean };
function words(html: string): Array<{ text: string; at: El }> {
  const root: El = { tag: '#root', classes: new Set(), parent: null, unseen: false };
  const VOID = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  let cur = root;
  const out: Array<{ text: string; at: El }> = [];
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[5] !== undefined) {
      if (cur.tag === 'style' || cur.tag === 'script' || cur.tag === 'svg' || cur.tag === 'title') continue;
      const text = m[5].replace(/&[a-z#0-9]+;/gi, 'x').trim();
      /* What a screen reader alone hears (`sr-only`, `aria-hidden`) is not drawn: no size or colour can be seen on it. */
      if (/[\p{L}\p{N}]/u.test(text) && !cur.unseen) out.push({ text, at: cur });
      continue;
    }
    const [, close, tag, rawAttrs, selfClose] = m;
    if (close) {
      while (cur !== root && cur.tag !== tag) cur = cur.parent!;
      if (cur !== root) cur = cur.parent!;
      continue;
    }
    const cls = /\sclass="([^"]*)"/.exec(rawAttrs ?? '')?.[1] ?? '';
    const classes = new Set(cls.split(/\s+/).filter(Boolean));
    const unseen = cur.unseen || classes.has('sr-only') || /\saria-hidden(="true")?(\s|$)/.test(rawAttrs ?? '');
    const node: El = { tag: tag!.toLowerCase(), classes, parent: cur, unseen };
    if (!(selfClose || VOID.has(tag!.toLowerCase()))) cur = node;
  }
  return out;
}

/** The shipped selectors' grammar: a list of `tag` / `.class` compounds, each with `:not(.class)` filters. */
function matcher(selector: string): (e: El) => boolean {
  const alts = selector.split(',').map((s) => s.trim());
  const tests = alts.map((alt) => {
    const m = /^([a-z][a-z0-9]*)?((?:\.[\w-]+)*)((?::not\(\.[\w-]+\))*)$/i.exec(alt);
    assert.ok(m && (m[1] || m[2]), `the guard cannot read the selector "${alt}" — teach it before trusting it`);
    const tag = m[1]?.toLowerCase();
    const must = (m[2] ?? '').split('.').filter(Boolean);
    const not = [...(m[3] ?? '').matchAll(/:not\(\.([\w-]+)\)/g)].map((x) => x[1]!);
    return (e: El) => (!tag || e.tag === tag) && must.every((c) => e.classes.has(c)) && not.every((c) => !e.classes.has(c));
  });
  return (e) => tests.some((t) => t(e));
}

function reached(at: El, rules: Array<(e: El) => boolean>): boolean {
  for (let e: El | null = at; e; e = e.parent) if (rules.some((r) => r(e))) return true;
  return false;
}

const EVENT = {
  event_id: 'E1',
  public_id: 'S89E-TESTTESTTE',
  display_name: 'Ana & Ben',
  event_date: '2099-12-12',
  event_type: 'wedding',
  ceremony_type: 'catholic',
  venue_name: 'San Agustin Church',
  venue_address: 'General Luna St, Intramuros, Manila',
  venue_latitude: 14.5889,
  venue_longitude: 120.9751,
  venues: [
    { role: 'ceremony', name: 'San Agustin Church', address: 'Intramuros, Manila', latitude: 14.5889, longitude: 120.9751 },
    { role: 'reception', name: 'The Manila Hotel', address: 'One Rizal Park, Manila', latitude: 14.5832, longitude: 120.9747 },
  ],
  dress_code_config: { title: 'Garden formal', description: 'Soft colours, comfortable shoes.', dos: ['Barong or suit'], donts: ['White gowns'], palette: [{ name: 'Sage', hex: '#9caf88' }] },
  special_message: 'Thank you for being part of our story.',
  what_to_bring: 'An umbrella, and your dancing shoes.',
  love_story: { moments: [{ id: 'm-1', line: 'We met at a friend’s wedding.', date: { y: 2019, m: 3 }, place: 'Tagaytay' }] },
};
const GUEST = { guest_id: 'G1', first_name: 'Carla', last_name: 'Reyes', display_name: null, role: 'guest', side: 'bride', group_category: 'friends', plus_one_of_guest_id: null, plus_one_mode: null };
const SCHEDULE = [0, 1].map((i) => ({
  block_id: `B${i}`, public_id: `S89B-TESTTEST0${i}`, event_id: 'E1', label: i === 0 ? 'Ceremony' : 'Reception', block_type: i === 0 ? 'ceremony' : 'reception',
  start_at: i === 0 ? '2099-12-12T07:00:00Z' : '2099-12-12T10:00:00Z', end_at: null, location: i === 0 ? 'San Agustin Church' : 'The Manila Hotel',
  notes: i === 0 ? 'Please be seated by 2:45.' : null, is_public: true, sort_order: i, parent_block_id: null, created_at: '2099-01-01T00:00:00Z',
  run_state: 'upcoming', actual_start_at: null, actual_end_at: null,
}));

async function sceneHtml(widgetType: string, canvas: Record<string, unknown> = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HideableWidgetRender } = await import('../app/[slug]/_components/hideable-widget-render');
  const { eventWordsFromProfile } = await import('../app/[slug]/_lib/event-words');
  const Render = HideableWidgetRender as unknown as React.FunctionComponent<Record<string, unknown>>;
  return renderToStaticMarkup(
    React.createElement(Render, {
      widget: { widget_id: `W-${widgetType}`, event_id: 'E1', widget_type: widgetType, is_always_on: false, is_visible: true, config_json: { canvas, title: 'Our words', body: 'A few lines from us.' } },
      event: EVENT,
      words: eventWordsFromProfile({ terminology: { organizerNoun: 'couple', eventWord: 'wedding', occasionNoun: 'celebration', register: 'celebratory', personB: 'Ben', celebrantShape: 'pair' } } as never),
      guest: GUEST,
      sideLabel: 'Bride',
      scheduleBlocks: SCHEDULE,
      isLive: false,
      isLimitedPlusOne: false,
      ourPhotoUrls: ['https://example.invalid/a.jpg'],
      canvasMediaUrls: {},
      hubTheme: 'vintage',
    }),
  );
}

/** Every way a scene is drawn here: Dress code in each palette look × each do / don't look; the rest as they come. */
function drawings(widgetType: string): Array<Record<string, unknown>> {
  if (widgetType !== 'dress_code') return [{}];
  return PALETTE_LOOK_IDS.flatMap((palette) => DOS_LOOK_IDS.map((dos) => ({ palette, dos })));
}

/** What one part's pick leaves unchanged: the words of its scene that no rule for the written elements reaches. */
async function wordsMissed(widgetType: string, written: readonly HubElementKey[]): Promise<{ total: number; missed: string[] }> {
  const rules = (HUB_SCENE_ELEMENT_KEYS as readonly HubElementKey[])
    .filter((k) => written.includes(k))
    .map((k) => matcher(HUB_SCENE_ELEMENT_SELECTOR[k as keyof typeof HUB_SCENE_ELEMENT_SELECTOR]));
  let total = 0;
  const missed = new Set<string>();
  for (const canvas of drawings(widgetType)) {
    const all = words(await sceneHtml(widgetType, canvas));
    total += all.length;
    for (const w of all) if (!reached(w.at, rules)) missed.add(w.text.slice(0, 40));
  }
  return { total, missed: [...missed] };
}

/** The rule body the scene's stylesheet lays on one element's selector, or ''. */
function ruleFor(css: string, sel: string): string {
  const at = css.indexOf(`:is(${sel}){`);
  return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
}

for (const field of FIELDS) {
  test(`every part the Maker offers a ${field === 'size' ? 'Size' : 'Colour'} on writes one its words are drawn with`, () => {
    const parts = lookParts(field);
    assert.ok(parts.length >= (field === 'size' ? 10 : 9), `anti-vacuity: only ${parts.length} parts take a ${field}`);
    const want = field === 'size' ? 'zoom:1.2' : `color:${PICK.color}`;
    for (const p of parts) {
      assert.ok(p.written.length > 0, `${p.part}: the pick saved nothing`);
      if (p.key.startsWith('w:')) {
        assert.deepEqual([...p.written].sort(), [...HUB_SCENE_ELEMENT_KEYS].sort(), `${p.part}: a scene's ${field} must be written on all its words`);
        const css = hubElementSceneCss(p.widgetType, Object.fromEntries(p.written.map((k) => [k, field === 'size' ? { size: 120 } : { color: PICK.color }])) as never) ?? '';
        for (const k of p.written) {
          const sel = HUB_SCENE_ELEMENT_SELECTOR[k as keyof typeof HUB_SCENE_ELEMENT_SELECTOR];
          assert.ok(ruleFor(css, sel).includes(want), `${p.part}: "${k}" got a ${field} but the scene's stylesheet lays no ${want} on it`);
        }
      } else {
        const decl = hubElementDeclarations((field === 'size' ? { size: 120 } : { color: PICK.color }) as never).map(([prop, v]) => `${prop}:${v}`);
        assert.ok(decl.some((d) => d.startsWith(want)), `${p.part}: its ${field} is drawn as nothing (${decl.join(';')})`);
      }
    }
  });
}

/**
 * 📋 WORDS NO PART LOOK REACHES, KNOWN AND NAMED — the venue map's own furniture: the tile credit and
 * the three app buttons (Google Maps · Waze · Apple Maps) — the pins' numbers are `aria-hidden`, so not counted. Controls, not the couple's words; owner 2026-10-15: they
 * stay fixed. Listed exactly — a NEW unreached word fails, and so does a listed one that is no longer drawn or is now
 * reached (take its line out). Dress code's chip names and do / don't lines WERE listed here until the owner ruled
 * them in (`lib/scene-words-class.ts`).
 */
const KNOWN_UNREACHED: Readonly<Record<string, readonly string[]>> = {
  venue_map: ['© OpenStreetMap', 'Google Maps', 'Waze', 'Apple Maps'],
};

for (const field of FIELDS) {
  test(`a scene part’s ${field === 'size' ? 'Size' : 'Colour'} reaches EVERY word the scene draws — not the heading alone`, async () => {
    const scenes = lookParts(field).filter((p) => p.key.startsWith('w:'));
    assert.ok(scenes.length >= 6, `anti-vacuity: only ${scenes.length} scene parts take a ${field}`);
    const misses: string[] = [];
    for (const p of scenes) {
      const { total, missed } = await wordsMissed(p.widgetType, p.written);
      assert.ok(total > 0, `anti-vacuity: ${p.widgetType} rendered no words — the fixture does not reach it`);
      console.log(`[scene-look] ${field} · ${p.part} (${p.widgetType}): ${missed.length} of ${total} drawn words unreached`);
      const known = KNOWN_UNREACHED[p.widgetType] ?? [];
      for (const w of missed) if (!known.includes(w)) misses.push(`${field} · ${p.part} (${p.widgetType}): "${w}" — the row cannot change it`);
      for (const k of known) if (!missed.includes(k)) misses.push(`${field} · ${p.part} (${p.widgetType}): "${k}" is listed as unreached but is not — take it off KNOWN_UNREACHED`);
    }
    assert.deepEqual(misses, []);
  });
}

test('Dress code’s chip names and do / don’t lines are drawn in every look the fixture claims to walk', async () => {
  const seen = new Set<string>();
  for (const canvas of drawings('dress_code')) for (const w of words(await sceneHtml('dress_code', canvas))) seen.add(w.text);
  assert.ok(seen.has('Sage'), 'anti-vacuity: no colour-chip name rendered');
  assert.ok([...seen].some((w) => w.includes('Barong or suit')), 'anti-vacuity: no do line rendered');
  assert.ok([...seen].some((w) => w.includes('White gowns')), 'anti-vacuity: no don’t line rendered');
});

test('the matcher can tell a reached word from a missed one (anti-vacuity for the guard itself)', async () => {
  /* Heading alone — what shipped before 2026-10-15: the Countdown's words are all missed. */
  const before = await wordsMissed('countdown', ['heading']);
  assert.ok(before.total > 0 && before.missed.length > 0, `heading-only must miss the Countdown's words (missed ${before.missed.length}/${before.total})`);
  const html = '<section><h2 class="hub-tpl-h">Title</h2><p class="pahina-eyebrow">Label</p><p>Words</p><li class="hub-el-words">Line</li><div><span>Loose</span><span class="sr-only">Unseen</span></div></section>';
  const ws = words(html);
  const all = (HUB_SCENE_ELEMENT_KEYS as readonly string[]).map((k) => matcher(HUB_SCENE_ELEMENT_SELECTOR[k as keyof typeof HUB_SCENE_ELEMENT_SELECTOR]));
  assert.deepEqual(ws.filter((w) => !reached(w.at, all)).map((w) => w.text), ['Loose']);
});
