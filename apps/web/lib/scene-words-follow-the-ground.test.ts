/**
 * 🔤🪟 A SCENE'S WORDS FOLLOW ITS GROUND — EVERY WORD, EVERY WIDGET, EVERY KIND —
 * AND GLASS READS AS GLASS.
 *
 * Owner, 2026-09-27, editing his own Event Hub: *"opaque glass, frosted glass
 * does not work."* Measured on production the same day: Opaque glass painted
 * the solid colour (identical to Full colour), both glasses took the couple's
 * DARKEST swatch, and on that dark ground the Countdown's label adapted while
 * its NUMERALS stayed the page's dark ink — dark on dark. The numerals set no
 * colour of their own; they inherited the page's, and the scene only moved the
 * TOKENS, never the inherited `color`. DECISION_LOG 2026-09-25 "TEXT COLOUR
 * ADAPTS TO EVERY BACKGROUND, AUTOMATICALLY, FOR EVERY COUPLE (free)" · 2026-09-27
 * "A SCENE'S BACKGROUND EXISTS TO SEPARATE IT FROM THE NEXT".
 *
 * Two properties, each over the whole matrix rather than one example:
 *
 *   A · THE MATH. Every theme × every ground kind (flat colour, opaque glass,
 *       frosted glass, photo/snippet under its scrim) × a dark and a light tint
 *       (and the awkward mid-tones): body text ≥ 4.5:1 over EVERY colour the
 *       ground can show (a translucent pane over black AND white behind it), the
 *       accent as text ≥ 4.5:1, the ink on a plate inside the scene ≥ 4.5:1, a
 *       `text-cream` label on a `bg-ink` button ≥ 4.5:1. And the two glasses are
 *       measurably different panes from each other and from the flat colour.
 *
 *   B · THE RENDER. Every scene widget, mounted through the REAL dispatcher on a
 *       dark and a light ground of every kind: each text node's colour is decided
 *       by an ADAPTIVE token (`text-ink…`, `text-terracotta…`, `text-gild…`,
 *       `text-mulberry…`, or inherited from the frame, which now carries the ink
 *       as `color`) — never a fixed class (`text-white`, `text-stone-600`,
 *       `text-[#…]`) and never a fixed stylesheet colour; every surface it sits on
 *       inside the scene is an adaptive token too. The frame hands the ink down
 *       as `color`, so a word with no class of its own follows.
 *
 * No `server-only` package exists outside Next's bundler; it is stubbed exactly
 * as `the-reply-is-a-sheet.test.ts` does, so the real dispatcher can load.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';
import { INVITE_THEMES, INVITE_THEME_IDS, type InviteThemeId } from './invite-themes';
import { AA_BODY, compositeOver, contrastRatio, relativeLuminance } from './hub-legibility';
import {
  SCENE_MEDIA_SCRIM,
  sceneLegibilityVars,
  sceneTintGround,
  type SceneTintKind,
} from './scene-legibility';
import { HUB_GLASS_DEFAULT_TINT, resolveHubBackground, sanitizeHubCanvas } from './hub-canvas';
import { WIDGET_TYPES } from './invitation-widgets';
import { SCENE_TEMPLATE_IDS } from './scene-templates';
import { PUBLIC_R2_BUCKET } from './r2-client-ref';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const ROOT = join(__dirname, '..');
const CSS = stripComments(readFileSync(join(ROOT, 'app/globals.css'), 'utf8'));

/* The owner's own case (a very dark maroon, measured rgb(53,17,21)) and the
   light surface every glass now starts from — plus the mid-tones where the two
   inks come closest to failing. */
const DARK = '#351115';
const LIGHT = HUB_GLASS_DEFAULT_TINT;
const TINTS = [DARK, LIGHT, '#5c2542', '#a9834b', '#f4e9dc', '#777777', '#111111', '#35403a'];
const KINDS: SceneTintKind[] = ['color', 'glass', 'frost', 'media'];
/** The widgets a scene can hold (the dispatcher's imports), for the source-level checks. */
const SCENE_WIDGET_FILES = [
  'countdown.tsx', 'schedule-widget.tsx', 'venue-widget.tsx', 'dress-code-widget.tsx', 'photo-moments-widget.tsx',
  'your-photos-widget.tsx', 'special-message-widget.tsx', 'what-to-bring-widget.tsx', 'our-photos-widget.tsx',
  'our-love-story-widget.tsx', 'tier-comparison-widget.tsx', 'custom-section-widget.tsx', 'scene-template.tsx',
  'hideable-widget-render.tsx',
];

/* ══ A · THE MATH ═══════════════════════════════════════════════════════════ */

test('A · every theme × every ground kind × dark/light/mid tints: every text clears AA over everything the ground can show', () => {
  let cells = 0;
  const rows: string[] = [];
  for (const id of INVITE_THEME_IDS) {
    for (const kind of KINDS) {
      for (const tint of kind === 'media' ? [LIGHT] : TINTS) {
        const g = sceneTintGround(INVITE_THEMES[id], kind, tint);
        const at = `${id} · ${kind} · ${tint}`;
        assert.ok(g.samples.length > 0, `anti-vacuity: ${at} has no ground samples`);
        for (const s of g.samples) {
          const body = contrastRatio(g.ink, s);
          assert.ok(body >= AA_BODY, `${at}: body ${g.ink} on ${s} = ${body.toFixed(2)}`);
          const accent = contrastRatio(g.accent, s);
          assert.ok(accent >= AA_BODY, `${at}: accent ${g.accent} on ${s} = ${accent.toFixed(2)}`);
          /* A plate inside the scene (`bg-veil/60`, `bg-veil/40`, a solid plate). */
          for (const a of [0.4, 0.6, 1]) {
            const plate = compositeOver(g.plate, a, s);
            const c = contrastRatio(g.ink, plate);
            assert.ok(c >= AA_BODY, `${at}: ink on the plate at ${a} over ${s} = ${c.toFixed(2)}`);
            /* …and a MUTED word (`text-ink/50`) held to the scene's floor. */
            const muted = contrastRatio(compositeOver(g.ink, g.muteFloor, plate), plate);
            assert.ok(muted >= AA_BODY, `${at}: a muted word at ${g.muteFloor} on the plate = ${muted.toFixed(2)}`);
          }
          const muted = contrastRatio(compositeOver(g.ink, g.muteFloor, s), s);
          assert.ok(muted >= AA_BODY, `${at}: a muted word at ${g.muteFloor} on ${s} = ${muted.toFixed(2)}`);
        }
        /* `text-cream` on a `bg-ink` button: cream is the ground, ink the fill. */
        const ground = g.kind === 'media' ? LIGHT : tint;
        const pair = contrastRatio(ground, g.ink);
        assert.ok(pair >= AA_BODY, `${at}: a cream label on an ink button = ${pair.toFixed(2)}`);
        /* …and on an accent fill (a CTA, the monogram plate): cream on mulberry. */
        const onAccent = contrastRatio(ground, g.accent);
        assert.ok(onAccent >= AA_BODY, `${at}: a cream label on an accent fill = ${onAccent.toFixed(2)}`);
        cells++;
        if ((tint === DARK || tint === LIGHT) && (id === 'vintage' || id === 'velvet' || id === 'house')) {
          rows.push(`${at.padEnd(30)} pane ${g.alpha.toFixed(2)} sheen ${g.sheen.toFixed(2)} · body ≥ ${g.bodyContrast.toFixed(2)}:1`);
        }
      }
    }
  }
  console.log(`[scene-words] contrast matrix: ${cells} cells, every one ≥ ${AA_BODY}:1\n  ${rows.join('\n  ')}`);
  assert.ok(cells >= INVITE_THEME_IDS.length * 3 * TINTS.length, 'anti-vacuity: the matrix shrank');
});

test('A · glass reads as glass: a light pane first, the opaque one milky and nearly solid, the frosted one see-through', () => {
  // The glass a couple starts from is LIGHT — never the darkest swatch.
  assert.ok(relativeLuminance(HUB_GLASS_DEFAULT_TINT) > 0.9, 'the default glass tint is not a light surface');
  assert.deepEqual(resolveHubBackground(sanitizeHubCanvas({ canvas: { kind: 'glass' } })), { kind: 'glass', color: LIGHT });
  for (const id of INVITE_THEME_IDS) {
    const t = INVITE_THEMES[id];
    const flat = sceneTintGround(t, 'color', LIGHT);
    const glass = sceneTintGround(t, 'glass', LIGHT);
    const frost = sceneTintGround(t, 'frost', LIGHT);
    assert.equal(flat.alpha, 1, `${id}: a flat colour is solid`);
    assert.ok(glass.alpha >= 0.86 && glass.alpha < 1, `${id}: opaque glass is milky, not solid (${glass.alpha})`);
    assert.ok(glass.sheen > 0, `${id}: the light opaque pane lost its sheen`);
    assert.ok(frost.alpha <= 0.7, `${id}: frosted glass is not see-through (${frost.alpha})`);
    assert.ok(frost.alpha < glass.alpha, `${id}: frosted is no clearer than opaque`);
  }
});

/** A CSS rule's body by exact selector, comments stripped. */
function rule(selector: string): string {
  const i = CSS.indexOf(`${selector} {`);
  assert.ok(i >= 0, `no CSS rule for ${selector}`);
  return CSS.slice(i, CSS.indexOf('}', i));
}

test('A · the stylesheet paints three different things: flat colour, a milky pane with a sheen, a blurred translucent pane', () => {
  const flat = rule('.hub-bg-color');
  const glass = rule('.hub-bg-glass');
  const frost = rule('.hub-bg-frost');
  assert.doesNotMatch(flat, /backdrop-filter|--hub-glass/, 'a flat colour must not look like glass');
  assert.match(glass, /background-color:\s*var\(--hub-glass-fill,/, 'opaque glass ignores its measured fill');
  assert.match(glass, /var\(--hub-glass-sheen/, 'opaque glass has no sheen');
  assert.match(glass, /inset 0 1px 0 rgb\(255 255 255/, 'opaque glass has no bright edge');
  assert.match(frost, /background-color:\s*var\(--hub-glass-fill,/, 'frosted glass ignores its measured fill');
  const blur = /backdrop-filter:\s*blur\((\d+)px\)/.exec(frost);
  assert.ok(blur && Number(blur[1]) >= 16, 'frosted glass has no real blur of what lies behind');
  assert.doesNotMatch(frost, /--hub-glass-sheen/, 'frosted glass wears the opaque pane’s sheen');
});

test('A · every muted ink a scene widget uses is held to the scene’s floor — a new alpha cannot slip under it', () => {
  const files = [
    ...SCENE_WIDGET_FILES.map((f) => join(ROOT, 'app/[slug]/_components', f)),
    ...['nav-links.tsx', 'run-of-show-header.tsx', 'guest-to-host-cta.tsx', 'vendor-location-map.tsx'].map((f) => join(ROOT, 'app/_components', f)),
  ];
  const used = new Set<string>();
  for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/text-ink\/(\d+)/g)) used.add(m[1]!);
  assert.ok(used.size >= 5, `anti-vacuity: only ${used.size} muted inks found — the file list is stale`);
  for (const a of used) {
    const rule = `.hub-canvas .text-ink\\/${a} { color: rgb(var(--color-ink) / max(${Number(a) / 100}, var(--hub-mute-floor, 0))); }`;
    assert.ok(CSS.includes(rule), `text-ink/${a} has no mute floor inside a scene — add: ${rule}`);
  }
});

test('A · the photo scrim the words are measured over IS the scrim the stylesheet paints — and it never turns dark', () => {
  for (const sel of ['.hub-has-media > .hub-canvas-media::after', '.hub-bg-snippet::after']) {
    const m = /rgb\(255 255 255 \/ (0\.\d+)\)/.exec(rule(sel));
    assert.ok(m, `${sel}: no light scrim`);
    assert.equal(Number(m[1]), SCENE_MEDIA_SCRIM, `${sel}: the scrim drifted from the measured one`);
  }
  // The words do not follow the phone's dark mode, so the scrim may not either.
  assert.doesNotMatch(CSS, /prefers-color-scheme:\s*dark\)\s*\{[^@]*hub-canvas-media/, 'a dark-mode scrim is back under light-ink words');
});

/* ══ B · THE RENDER ═════════════════════════════════════════════════════════ */

const ALWAYS_ON = new Set(['hero', 'greeting', 'qr_card', 'rsvp']);
const SCENE_WIDGETS = WIDGET_TYPES.filter((t) => !ALWAYS_ON.has(t));
const PHOTO = `r2://${PUBLIC_R2_BUCKET}/events/E1/p1.jpg`;
const MEDIA_URLS = { [PHOTO]: 'https://example.invalid/p1.jpg' };

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
  dress_code_config: {
    title: 'Garden formal',
    description: 'Soft colours, comfortable shoes.',
    dos: ['Barong or suit'],
    donts: ['White gowns'],
    palette: [
      { name: 'Sage', hex: '#9caf88' },
      { name: 'Dusty rose', hex: '#d8a7a7' },
    ],
  },
  photo_moments_config: {
    intro_copy: 'Phones down for the vows.',
    moments: [
      { time_label: '3:00 PM', title: 'The vows', note: 'Please keep phones away.', mode: 'phone_down' },
      { time_label: '6:00 PM', title: 'First dance', note: 'Snap away!', mode: 'camera_ok' },
    ],
  },
  special_message: 'Thank you for being part of our story.',
  what_to_bring: 'An umbrella, and your dancing shoes.',
  love_story: {
    moments: [
      { id: 'm-1', line: 'We met at a friend’s wedding.', date: { y: 2019, m: 3 }, place: 'Tagaytay' },
      { id: 'm-2', line: 'He asked, on the beach.', date: { y: 2024, m: 6 } },
    ],
  },
  role_palette: null,
} as const;

const GUEST = {
  guest_id: 'G1',
  first_name: 'Carla',
  last_name: 'Reyes',
  display_name: null,
  role: 'guest',
  side: 'bride',
  group_category: 'friends',
  plus_one_of_guest_id: null,
  plus_one_mode: null,
};

const SCHEDULE = [0, 1].map((i) => ({
  block_id: `B${i}`,
  public_id: `S89B-TESTTEST0${i}`,
  event_id: 'E1',
  label: i === 0 ? 'Ceremony' : 'Reception',
  block_type: i === 0 ? 'ceremony' : 'reception',
  start_at: i === 0 ? "2099-12-12T07:00:00Z" : "2099-12-12T10:00:00Z",
  end_at: null,
  location: i === 0 ? 'San Agustin Church' : 'The Manila Hotel',
  notes: i === 0 ? 'Please be seated by 2:45.' : null,
  is_public: true,
  sort_order: i,
  parent_block_id: null,
  created_at: '2099-01-01T00:00:00Z',
  run_state: 'upcoming',
  actual_start_at: null,
  actual_end_at: null,
}));

async function words() {
  const { eventWordsFromProfile } = await import('../app/[slug]/_lib/event-words');
  return eventWordsFromProfile({
    terminology: { organizerNoun: 'couple', eventWord: 'wedding', occasionNoun: 'celebration', register: 'celebratory', personB: 'Ben', celebrantShape: 'pair' },
  } as never);
}

/* ── A tiny, strict parser for React's static markup ─────────────────────── */
type El = { tag: string; attrs: Record<string, string>; classes: Set<string>; parent: El | null; children: El[] };
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

function el(tag: string, attrs: Record<string, string>, parent: El | null): El {
  const node: El = { tag, attrs, classes: new Set((attrs.class ?? '').split(/\s+/).filter(Boolean)), parent, children: [] };
  parent?.children.push(node);
  return node;
}

/**
 * The page around a scene, exactly as the guest page wears it (`guest-look-scope.tsx`):
 * html › body › the look scope (`sn-editorial … text-ink`, `data-hub-theme`). Rules
 * scoped under those (`.sn-editorial .pahina-eyebrow`) must match here as they do there.
 */
function parse(html: string, theme: InviteThemeId): { texts: Array<{ text: string; at: El }> } {
  const doc = el('html', {}, null);
  const body = el('body', {}, doc);
  const scope = el('div', { class: 'sn-editorial contents text-ink', 'data-hub-theme': theme, 'data-guest-look': '' }, body);
  let cur = scope;
  const texts: Array<{ text: string; at: El }> = [];
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[5] !== undefined) {
      if (cur.tag === 'style' || cur.tag === 'script') continue;
      const text = m[5].replace(/&[a-z#0-9]+;/gi, 'x').trim();
      if (text) texts.push({ text, at: cur });
      continue;
    }
    const [, close, tag, rawAttrs, selfClose] = m;
    if (close) {
      while (cur !== scope && cur.tag !== tag) cur = cur.parent!;
      if (cur !== scope) cur = cur.parent!;
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of (rawAttrs ?? '').matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) attrs[a[1]!] = (a[2] ?? '').replace(/&amp;/g, '&');
    const node = el(tag!, attrs, cur);
    if (!(selfClose || VOID.has(tag!))) cur = node;
  }
  return { texts };
}

/* ── A small CSS selector matcher — enough for this stylesheet ───────────── */

/** Split on `sep` at depth 0 (outside `()` and `[]`). */
function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (depth === 0 && ch === sep) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out.map((x) => x.trim()).filter(Boolean);
}

type Part = { comb: ' ' | '>'; compound: string };
/** Right-most compound last. Null for what this matcher does not model (siblings, pseudo-elements). */
function parseSelector(sel: string): Part[] | null {
  const parts: Part[] = [];
  let depth = 0;
  let buf = '';
  let comb: ' ' | '>' = ' ';
  const flush = () => {
    if (buf.trim()) parts.push({ comb, compound: buf.trim() });
    buf = '';
  };
  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i]!;
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (depth === 0 && (ch === '+' || ch === '~')) return null;
    if (depth === 0 && (ch === '>' || /\s/.test(ch))) {
      if (buf.trim()) {
        flush();
        comb = ' ';
      }
      if (ch === '>') comb = '>';
      continue;
    }
    buf += ch;
  }
  flush();
  if (parts.length === 0 || parts.some((p) => p.compound.includes('::') || /:(?:before|after|first-letter|first-line|placeholder|selection|marker)\b/.test(p.compound))) return null;
  return parts;
}

function descendants(e: El): El[] {
  return e.children.flatMap((c) => [c, ...descendants(c)]);
}

function matchCompound(e: El, compound: string): boolean {
  let rest = compound;
  const tag = /^([a-zA-Z][\w-]*|\*)/.exec(rest);
  if (tag) {
    if (tag[1] !== '*' && tag[1]!.toLowerCase() !== e.tag.toLowerCase()) return false;
    rest = rest.slice(tag[0].length);
  }
  while (rest.length > 0) {
    let m: RegExpExecArray | null;
    if ((m = /^\.((?:\\.|[\w-])+)/.exec(rest))) {
      if (!e.classes.has(m[1]!.replace(/\\(.)/g, '$1'))) return false;
    } else if ((m = /^#([\w-]+)/.exec(rest))) {
      if (e.attrs.id !== m[1]) return false;
    } else if ((m = /^\[([\w-]+)(?:([~^$*|]?=)['"]?([^'"\]]*)['"]?)?\]/.exec(rest))) {
      const v = e.attrs[m[1]!];
      if (v === undefined) return false;
      if (m[2] === '=' && v !== m[3]) return false;
    } else if ((m = /^:([\w-]+)(?:\(((?:[^()]|\([^()]*\))*)\))?/.exec(rest))) {
      const [, name, arg] = m;
      if (name === 'root') {
        if (e.tag !== 'html') return false;
      } else if (name === 'has') {
        const inner = arg!.trim();
        const child = inner.startsWith('>');
        const target = child ? inner.slice(1).trim() : inner;
        const pool = child ? e.children : descendants(e);
        if (!splitTop(target, ',').some((t) => pool.some((c) => matchCompound(c, t)))) return false;
      } else if (name === 'not') {
        if (splitTop(arg!, ',').some((t) => !/\s|>/.test(t) && matchCompound(e, t))) return false;
      } else if (name === 'is' || name === 'where') {
        if (!splitTop(arg!, ',').some((t) => !/\s|>/.test(t) && matchCompound(e, t))) return false;
      } else if (name === 'empty') {
        if (e.children.length > 0) return false;
      }
      // :hover, :focus-visible, :first-child … — a guest can reach each state, so
      // a colour set there is a colour guests see: treated as matching.
    } else {
      return false; // something this matcher does not model — never a false match
    }
    rest = rest.slice(m[0].length);
  }
  return true;
}

function matches(e: El, parts: Part[]): boolean {
  const last = parts[parts.length - 1]!;
  if (!matchCompound(e, last.compound)) return false;
  let cur: El | null = e;
  for (let i = parts.length - 2; i >= 0; i--) {
    const comb = parts[i + 1]!.comb;
    const want = parts[i]!.compound;
    if (comb === '>') {
      cur = cur!.parent;
      if (!cur || !matchCompound(cur, want)) return false;
    } else {
      let a: El | null = cur!.parent;
      while (a && !matchCompound(a, want)) a = a.parent;
      if (!a) return false;
      cur = a;
    }
  }
  return true;
}

/** Every stylesheet rule that sets a text colour, a background, or `@apply`s utilities. */
type Rule = { parts: Part[]; selector: string; color?: string; background?: string; apply: string[] };
const RULES: Rule[] = [];
for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const body = m[2]!;
  const color = /(?:^|[;\s{])color:\s*([^;}]+)/.exec(body)?.[1]?.trim();
  const background = /(?:^|[;\s{])background(?:-color)?:\s*([^;}]+)/.exec(body)?.[1]?.trim();
  const apply = /@apply\s+([^;]+)/.exec(body)?.[1]?.trim().split(/\s+/) ?? [];
  if (!color && !background && apply.length === 0) continue;
  const prelude = m[1]!.trim();
  if (prelude.startsWith('@')) continue;
  for (const selector of splitTop(prelude, ',')) {
    const parts = parseSelector(selector);
    if (parts) RULES.push({ parts, selector, color, background, apply });
  }
}

/* ── What counts as adaptive ─────────────────────────────────────────────── */
const ADAPTIVE_TOKEN = '(?:ink|ink-on-plate|terracotta|gild|mulberry)';
const SURFACE_TOKEN = '(?:cream|paper|veil|paper-deep|ink|ink-on-plate|terracotta|gild|mulberry)';
const stripVariant = (c: string) => c.replace(/^(?:[a-z0-9-]+:|\[[^\]]*\]:)+/, '');
/** Text-colour utilities. Sizes, alignment and wrapping are not colours. */
function colourClasses(list: Iterable<string>): string[] {
  return [...list]
    .map(stripVariant)
    .filter((c) => /^text-/.test(c))
    .filter(
      (c) =>
        !/^text-(?:xs|sm|base|lg|xl|[2-9]xl|left|center|right|justify|start|end|balance|pretty|wrap|nowrap|clip|ellipsis)$/.test(c) &&
        !/^text-\[[\d.]+(?:rem|px|em|%|vw|vh|ch|cqi)\]$/.test(c) &&
        !/^text-\[(?:clamp|min|max|calc)\(/.test(c),
    );
}
function bgClasses(list: Iterable<string>): string[] {
  return [...list]
    .map(stripVariant)
    .filter((c) => /^(?:bg|from|via|to)-/.test(c))
    .filter((c) => !/^bg-(?:gradient|none|cover|contain|center|top|bottom|no-repeat|repeat|fixed|local|scroll|clip|origin|blend|auto|\[length|\[position|\[size)/.test(c))
    .filter((c) => !/^(?:from|via|to)-\d+%$/.test(c));
}
const ADAPTIVE_TEXT = new RegExp(`^text-(?:${ADAPTIVE_TOKEN}(?:-\\d{3})?(?:\\/\\d+)?|current|inherit|transparent)$`);
const PAIRED_TEXT = /^text-(?:cream|paper)(?:\/\d+)?$/; // a label ON an ink / accent fill
const PAIR_FILL = new RegExp(`^bg-${ADAPTIVE_TOKEN}(?:-\\d{3})?(?:\\/\\d+)?$`);
const ADAPTIVE_BG = new RegExp(`^(?:bg|from|via|to)-(?:${SURFACE_TOKEN}|transparent)(?:-\\d{3})?(?:\\/\\d+)?$`);
const ADAPTIVE_CSS_TEXT = new RegExp(`var\\(--color-${ADAPTIVE_TOKEN}\\b|^inherit$|^currentColor$|^transparent$`);
const ADAPTIVE_CSS_BG = new RegExp(`var\\(--(?:color-${SURFACE_TOKEN}|hub-glass-fill|hub-bg-color|hub-media)\\b|^none$|^transparent$|^inherit$`);
const PAIR_CSS_BG = new RegExp(`var\\(--color-${ADAPTIVE_TOKEN}\\b`);

/**
 * What one element says about colour: its utilities (its own classes plus any a
 * matched rule `@apply`s), the colour and background of every stylesheet rule
 * that matches it, and its inline style.
 */
function look(e: El) {
  const rules = RULES.filter((r) => matches(e, r.parts));
  const utilities = [...e.classes, ...rules.flatMap((r) => r.apply)];
  const style = e.attrs.style ?? '';
  return {
    textUtils: colourClasses(utilities),
    bgUtils: bgClasses(utilities),
    cssColours: rules.filter((r) => r.color).map((r) => ({ sel: r.selector, v: r.color! })),
    cssBackgrounds: rules.filter((r) => r.background).map((r) => ({ sel: r.selector, v: r.background! })),
    inlineColour: /(?:^|;)color:([^;]+)/.exec(style)?.[1]?.trim() ?? null,
    inlineBg: /(?:^|;)background(?:-color)?:([^;]+)/.exec(style)?.[1]?.trim() ?? null,
  };
}

type Ground = { kind: 'color' | 'glass' | 'frost' | 'photo' | 'none'; tint?: string };
const GROUNDS: Ground[] = [
  { kind: 'color', tint: DARK },
  { kind: 'color', tint: LIGHT },
  { kind: 'glass', tint: DARK },
  { kind: 'glass', tint: LIGHT },
  { kind: 'frost', tint: DARK },
  { kind: 'frost', tint: LIGHT },
  { kind: 'photo' },
  { kind: 'none' },
];

const REF = (n: number) => `r2://${PUBLIC_R2_BUCKET}/events/E1/s${n}.jpg`;
const TEMPLATE_MEDIA = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [REF(i), `https://example.invalid/s${i}.jpg`]));

function canvasFor(g: Ground, template?: number): Record<string, unknown> {
  const base: Record<string, unknown> =
    g.kind === 'photo' ? { media: PHOTO } : g.kind === 'none' ? { kind: 'none' } : { kind: g.kind, color: g.tint };
  if (!template) return base;
  const slots = Array.from({ length: 6 }, (_, i) => ({ media: REF(i), head: `Moment ${i + 1}`, text: `A line about moment ${i + 1}.` }));
  return { ...base, template, slots };
}

type Finding = { word: string; why: string };

/**
 * One word's verdict. Walks from the word up to the scene frame:
 *   · the FIRST element that says anything about text colour decides it, and
 *     everything it says must be adaptive (or a `text-cream` label on an
 *     adaptive fill — a pair that flips together);
 *   · every surface the word sits on inside the scene must be adaptive too;
 *   · an ISLAND — an element that paints its own opaque, fixed surface AND its
 *     own words (the onyx photo card, words over a photo on their own dark
 *     scrim) — is its own ground, measured by its own authors, and is counted
 *     rather than judged;
 *   · reaching the frame with nothing decided means the word inherits the
 *     frame's `color`, which must be there.
 */
function verdict(text: string, at: El, g: Ground, islands: { n: number }): Finding[] {
  const out: Finding[] = [];
  let decided = false;
  let pairFill = false;
  const path: El[] = [];
  for (let e: El | null = at; e; e = e.parent) {
    path.push(e);
    if (e.classes.has('hub-canvas')) break;
  }
  const frame = path[path.length - 1]!;
  if (!frame.classes.has('hub-canvas')) return g.kind === 'none' ? [] : [{ word: text, why: 'is outside any scene frame' }];
  // An island first: a fixed surface under fixed words, anywhere on the path.
  for (const e of path.slice(0, -1)) {
    const l = look(e);
    // A label on an adaptive FILL anywhere beneath the frame (a button, a
    // monogram plate) may take `cream`: the ground and the fill flip together.
    if (l.bgUtils.some((b) => PAIR_FILL.test(b)) || l.cssBackgrounds.some((b) => PAIR_CSS_BG.test(b.v))) pairFill = true;
    const fixedBg = l.cssBackgrounds.find((b) => !ADAPTIVE_CSS_BG.test(b.v) && !/gradient\(\s*to [a-z]+,\s*rgb\(\d+ \d+ \d+ \/ 0\)/.test(b.v));
    if (fixedBg) {
      islands.n++;
      return [];
    }
  }
  for (const e of path) {
    const isFrame = e === frame;
    const l = look(e);
    if (!isFrame) {
      for (const b of l.bgUtils) if (!ADAPTIVE_BG.test(b)) out.push({ word: text, why: `sits on a fixed surface ${b}` });
      if (l.inlineBg) out.push({ word: text, why: `sits on a fixed inline background ${l.inlineBg}` });
    }
    if (decided) continue;
    if (isFrame) {
      if (g.kind !== 'none' && !(l.inlineColour && /^rgb\(\d+ \d+ \d+\)$/.test(l.inlineColour))) {
        out.push({ word: text, why: 'inherits a colour the frame does not set' });
      }
      break;
    }
    const says = l.textUtils.length > 0 || l.cssColours.length > 0 || l.inlineColour !== null;
    if (!says) continue;
    decided = true;
    for (const c of l.textUtils) {
      if (ADAPTIVE_TEXT.test(c)) continue;
      if (PAIRED_TEXT.test(c) && pairFill) continue;
      out.push({ word: text, why: `is painted with a fixed ${c}` });
    }
    for (const c of l.cssColours) {
      if (ADAPTIVE_CSS_TEXT.test(c.v)) continue;
      if (/var\(--color-(?:cream|paper)\b/.test(c.v) && pairFill) continue;
      out.push({ word: text, why: `is painted by \`${c.sel} { color: ${c.v} }\`` });
    }
    if (l.inlineColour && !ADAPTIVE_CSS_TEXT.test(l.inlineColour)) out.push({ word: text, why: `has a fixed inline colour ${l.inlineColour}` });
  }
  return out;
}

async function renderAll(): Promise<{ findings: string[]; counts: Record<string, number>; islands: number }> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HideableWidgetRender } = await import('../app/[slug]/_components/hideable-widget-render');
  const w = await words();
  const Render = HideableWidgetRender as unknown as React.FunctionComponent<Record<string, unknown>>;
  const theme: InviteThemeId = 'vintage';
  const findings: string[] = [];
  const counts: Record<string, number> = {};
  const islands = { n: 0 };
  for (const g of GROUNDS) {
    const label = `${g.kind}${g.tint ? ` ${g.tint}` : ''}`;
    for (const type of SCENE_WIDGETS) {
      const templates = type === 'custom_1' ? SCENE_TEMPLATE_IDS : type.startsWith('custom_') ? [] : [undefined];
      for (const tpl of templates) {
        const html = renderToStaticMarkup(
          React.createElement(Render, {
            widget: {
              widget_id: `W-${type}`,
              event_id: 'E1',
              widget_type: type,
              is_always_on: false,
              is_visible: true,
              config_json: { canvas: canvasFor(g, tpl), title: 'Our words', body: 'A few lines from us.' },
            },
            event: EVENT,
            words: w,
            guest: GUEST,
            sideLabel: 'Bride',
            scheduleBlocks: SCHEDULE,
            isLive: false,
            isLimitedPlusOne: false,
            ourPhotoUrls: ['https://example.invalid/a.jpg', 'https://example.invalid/b.jpg'],
            canvasMediaUrls: { ...MEDIA_URLS, ...TEMPLATE_MEDIA },
            hubTheme: theme,
          }),
        );
        const { texts } = parse(html, theme);
        counts[type] = (counts[type] ?? 0) + texts.length;
        for (const { text, at } of texts) {
          for (const f of verdict(text, at, g, islands)) findings.push(`${type}${tpl ? ` #${tpl}` : ''} on ${label}: "${f.word.slice(0, 48)}" ${f.why}`);
        }
      }
    }
  }
  return { findings: [...new Set(findings)], counts, islands: islands.n };
}

test('B · every scene widget, on a dark and a light ground of every kind: every word is painted from the adaptive ink', async () => {
  const { findings, counts, islands } = await renderAll();
  console.log(`[scene-words] words checked per widget: ${JSON.stringify(counts)} · words on their own island: ${islands}`);
  for (const type of SCENE_WIDGETS.filter((t) => !t.startsWith('custom_') || t === 'custom_1')) {
    assert.ok((counts[type] ?? 0) > 0, `anti-vacuity: ${type} rendered no words — the fixture is not reaching it`);
  }
  assert.deepEqual(findings.slice(0, 40), [], `${findings.length} word(s) do not follow the ground`);
});

test('B · the matcher can see a fixed colour — on a class, in the stylesheet, and on the frame', () => {
  // Anti-vacuity for `verdict` itself: each of the three ways a word can be
  // painted wrong is caught, and the right way passes.
  const frame = `<div class="hub-canvas hub-bg-color" style="--color-ink:1 2 3;color:rgb(1 2 3)"><div class="hub-canvas-body">`;
  const judge = (inner: string, g: Ground = { kind: 'color', tint: DARK }) => {
    const { texts } = parse(`${frame}${inner}</div></div>`, 'vintage');
    return texts.flatMap(({ text, at }) => verdict(text, at, g, { n: 0 }));
  };
  assert.deepEqual(judge('<p class="text-ink/70">ok</p>'), []);
  assert.deepEqual(judge('<p>inherits</p>'), []);
  assert.equal(judge('<p class="text-stone-600">x</p>').length, 1, 'a fixed utility was not caught');
  assert.equal(judge('<p class="hub-tpl-over"><span class="hub-tpl-p">x</span></p>').length, 0, 'a rule whose context is absent was applied');
  assert.equal(judge('<div class="button-primary">x</div>').length, 0, 'an @apply pair (bg-mulberry + text-cream) was refused');
  assert.equal(judge('<div class="bg-white"><p class="text-ink">x</p></div>').length, 1, 'a fixed surface was not caught');
  const bare = parse(`<div class="hub-canvas hub-bg-color"><div class="hub-canvas-body"><p>x</p></div></div>`, 'vintage');
  assert.equal(bare.texts.flatMap(({ text, at }) => verdict(text, at, { kind: 'color', tint: DARK }, { n: 0 })).length, 1, 'a frame without `color` was not caught');
});

test('B · the frame hands the ink down as `color` — a word with no class of its own follows the ground', () => {
  for (const kind of ['color', 'glass', 'frost', 'media'] as const) {
    for (const tint of [DARK, LIGHT]) {
      const v = sceneLegibilityVars(INVITE_THEMES.vintage, tint, kind);
      assert.equal(v.color, `rgb(${v['--color-ink']})`, `${kind} ${tint}: the frame's colour is not its ink`);
      assert.ok(v['--color-cream'] && v['--color-veil'], `${kind} ${tint}: the scene's surfaces do not follow its ground`);
      assert.equal('--color-ink-on-light' in v, false, 'the ink for an always-light surface must stay dark');
    }
  }
});
