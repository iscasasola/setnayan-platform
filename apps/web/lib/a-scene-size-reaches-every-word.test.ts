/**
 * 🔠 STAGES › A PART › STYLE › SIZE REACHES EVERY WORD THE PART DRAWS.
 *
 * Owner, 2026-10-14, on the live Maker: *"on the stages. Style Size is inconsistent"* → *"when we where changing size,
 * the text did not shrink, the highlight just moved"*. Measured on the Maker lab, 2026-10-15 (glyph heights read from a
 * Range over each word, never the inline style): every cover part (Title · Logo · Names · Date · Place) scaled with the
 * slider, but on the Countdown, the Message, What to bring and the Love Story the slider went 100 % → 120 % and NOT ONE
 * word changed — the row wrote `elements.heading.size` (`stage-panel/part-look.ts`), and those scenes draw no heading.
 * On the scenes that do (Schedule, Venue, Dress code) only the heading moved; the words under it stayed.
 *
 * The claim, tested the way the couple sees it: for every part the Maker offers a Size on, the size it saves
 * (`partLookNext`) becomes a `zoom` the page's own stylesheet lays (`hubElementSceneCss` / `hubElementDeclarations` —
 * the guest page and the Maker's canvas both draw from them), and EVERY word the scene renders — mounted through the
 * real dispatcher (`HideableWidgetRender`), as the guest page mounts it — sits inside an element that rule reaches.
 * A word no rule reaches is a word the slider cannot move.
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

/** Every part the Maker draws a Size slider for, with the words that size is written on. */
function sizedParts() {
  const out: Array<{ part: MakerPartKey; key: string; widgetType: string; sized: HubElementKey[] }> = [];
  for (const part of Object.keys(MAKER_PARTS) as MakerPartKey[]) {
    const def = MAKER_PARTS[part];
    const t = partLookTarget(def.canvas, def.el ?? null);
    if (!t || !partLookFields(t).size) continue;
    const up = partLookSizes(t.el).find((s) => s > 100)!;
    const next = partLookNext(t, {}, 'size', up);
    assert.ok(next, `${part}: a size pick changed nothing on the canvas`);
    const sized = (Object.keys(next.elements ?? {}) as HubElementKey[]).filter((k) => hubElementSizePct(next.elements?.[k]?.size) !== null);
    out.push({ part, key: t.key, widgetType: t.widgetType, sized });
  }
  return out;
}

/* ── the scene's words, as React draws them ─────────────────────────────── */
type El = { tag: string; classes: Set<string>; parent: El | null };
function words(html: string): Array<{ text: string; at: El }> {
  const root: El = { tag: '#root', classes: new Set(), parent: null };
  const VOID = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  let cur = root;
  const out: Array<{ text: string; at: El }> = [];
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[5] !== undefined) {
      if (cur.tag === 'style' || cur.tag === 'script' || cur.tag === 'svg' || cur.tag === 'title') continue;
      const text = m[5].replace(/&[a-z#0-9]+;/gi, 'x').trim();
      if (/[\p{L}\p{N}]/u.test(text)) out.push({ text, at: cur });
      continue;
    }
    const [, close, tag, rawAttrs, selfClose] = m;
    if (close) {
      while (cur !== root && cur.tag !== tag) cur = cur.parent!;
      if (cur !== root) cur = cur.parent!;
      continue;
    }
    const cls = /\sclass="([^"]*)"/.exec(rawAttrs ?? '')?.[1] ?? '';
    const node: El = { tag: tag!.toLowerCase(), classes: new Set(cls.split(/\s+/).filter(Boolean)), parent: cur };
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

async function sceneHtml(widgetType: string): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HideableWidgetRender } = await import('../app/[slug]/_components/hideable-widget-render');
  const { eventWordsFromProfile } = await import('../app/[slug]/_lib/event-words');
  const Render = HideableWidgetRender as unknown as React.FunctionComponent<Record<string, unknown>>;
  return renderToStaticMarkup(
    React.createElement(Render, {
      widget: { widget_id: `W-${widgetType}`, event_id: 'E1', widget_type: widgetType, is_always_on: false, is_visible: true, config_json: { canvas: {}, title: 'Our words', body: 'A few lines from us.' } },
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

/** What one part's Size leaves unmoved: the words of its scene that no zoom rule reaches. */
async function wordsSizeMisses(widgetType: string, sized: readonly HubElementKey[]): Promise<{ total: number; missed: string[] }> {
  const rules = (HUB_SCENE_ELEMENT_KEYS as readonly HubElementKey[])
    .filter((k) => sized.includes(k))
    .map((k) => matcher(HUB_SCENE_ELEMENT_SELECTOR[k as keyof typeof HUB_SCENE_ELEMENT_SELECTOR]));
  const all = words(await sceneHtml(widgetType));
  return { total: all.length, missed: all.filter((w) => !reached(w.at, rules)).map((w) => w.text.slice(0, 40)) };
}

test('every part the Maker offers a Size on writes a size its words are drawn at', () => {
  const parts = sizedParts();
  assert.ok(parts.length >= 10, `anti-vacuity: only ${parts.length} sized parts found`);
  for (const p of parts) {
    assert.ok(p.sized.length > 0, `${p.part}: the slider saved no size at all`);
    if (p.key.startsWith('w:')) {
      const css = hubElementSceneCss(p.widgetType, Object.fromEntries(p.sized.map((k) => [k, { size: 120 }])) as never) ?? '';
      for (const k of p.sized) {
        const sel = HUB_SCENE_ELEMENT_SELECTOR[k as keyof typeof HUB_SCENE_ELEMENT_SELECTOR];
        assert.ok(sel && css.includes(`:is(${sel}){zoom:1.2`), `${p.part}: "${k}" got a size but the scene's stylesheet lays no zoom on it`);
      }
    } else {
      for (const k of p.sized) {
        assert.ok(hubElementDeclarations({ size: 120 } as never).some(([prop]) => prop === 'zoom'), `${p.part}: "${k}" carries no zoom`);
      }
    }
  }
});

/**
 * 📋 WORDS THE SIZE DOES NOT REACH, KNOWN AND NAMED (measured on the lab, 2026-10-15, both engines). They are not one
 * of a scene's three parts in the shipped element model (`HUB_SCENE_ELEMENT_SELECTOR`: label · heading · `p` words), so
 * neither Size nor any other part look reaches them today. Listed exactly — a NEW unreached word fails, and so does a
 * listed one that is no longer drawn or is now reached (take its line out).
 *   · venue_map — the map's own furniture: pin numbers, the tile credit, and the three app buttons (Google Maps · Waze
 *     · Apple Maps) — controls, not the couple's words.
 *   · dress_code — the Mood Board colour chips' names and the do / don't list rows (`li`). Those ARE the couple's
 *     words: an open follow-up (the body selector is `p` only), flagged to the controller, not decided here.
 */
const KNOWN_UNREACHED: Readonly<Record<string, readonly string[]>> = {
  venue_map: ['1', '2', '© OpenStreetMap', 'Google Maps', 'Waze', 'Apple Maps'],
  dress_code: ['Sage', '· Barong or suit', '· White gowns'],
};

test('a scene part’s Size reaches EVERY word the scene draws — not the heading alone', async () => {
  const scenes = sizedParts().filter((p) => p.key.startsWith('w:'));
  assert.ok(scenes.length >= 6, `anti-vacuity: only ${scenes.length} scene parts take a size`);
  const misses: string[] = [];
  for (const p of scenes) {
    const { total, missed } = await wordsSizeMisses(p.widgetType, p.sized);
    assert.ok(total > 0, `anti-vacuity: ${p.widgetType} rendered no words — the fixture does not reach it`);
    console.log(`[scene-size] ${p.part} (${p.widgetType}): ${total - missed.length}/${total} words reached by ${p.sized.join('+')}`);
    const known = KNOWN_UNREACHED[p.widgetType] ?? [];
    for (const w of missed) if (!known.includes(w)) misses.push(`${p.part} (${p.widgetType}): "${w}" — the slider cannot move it`);
    for (const k of known) if (!missed.includes(k)) misses.push(`${p.part} (${p.widgetType}): "${k}" is listed as unreached but is not — take it off KNOWN_UNREACHED`);
  }
  assert.deepEqual(misses, []);
});

test('the matcher can tell a reached word from a missed one (anti-vacuity for the guard itself)', async () => {
  /* Heading alone — what shipped before 2026-10-15: the Countdown's words are all missed. */
  const before = await wordsSizeMisses('countdown', ['heading']);
  assert.ok(before.total > 0 && before.missed.length === before.total, `heading-only must miss every Countdown word (missed ${before.missed.length}/${before.total})`);
  const html = '<section><h2 class="hub-tpl-h">Title</h2><p class="pahina-eyebrow">Label</p><p>Words</p><div><span>Loose</span></div></section>';
  const ws = words(html);
  const all = (HUB_SCENE_ELEMENT_KEYS as readonly string[]).map((k) => matcher(HUB_SCENE_ELEMENT_SELECTOR[k as keyof typeof HUB_SCENE_ELEMENT_SELECTOR]));
  assert.deepEqual(ws.filter((w) => !reached(w.at, all)).map((w) => w.text), ['Loose']);
});
