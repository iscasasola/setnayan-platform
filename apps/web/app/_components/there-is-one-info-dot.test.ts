/**
 * there-is-one-info-dot.test.ts — 2026-10-25. Owner, on the Suppliers page's "Cover your event" header, whose ⓘ was a
 * white disc with an ORANGE "i" while the ⓘ on every other page was grey ink: *"and the (i) is not consistent across
 * the app"*.
 *
 * 🔑 WHY IT DRIFTED. The app had two shipped ⓘ components and five hand-drawn ones, each with its own size, hairline,
 * weight and colour: `<InfoTip>` (16 px, ink/25 hairline, a 10-px semibold ink/55 "i" — 77 files), `<Explain>`
 * (a 22-px white disc, an ACCENT bold "i" — the Suppliers page, every Form row and Page card), the My Events shelf's
 * <details> (20 px, bold ITALIC), the setup card's (28 px, 12-px), the selfie step's and the Maker stage's (a lucide
 * glyph), and the wallet page's (the font's own `ⓘ`). Nothing compared them, so each was right on its own page.
 *
 * ✅ THE RULE: ONE DRAWN ⓘ, AND IT IS INFOTIP'S. Its look is READ from `info-tip.tsx` — the trigger's own class
 * string — never retyped here, so if the house ⓘ changes, every ⓘ is held to the new look. Every other place that
 * draws an "i" must (1) be listed below with the reason it cannot be `<InfoTip>` or `<Explain>`, and (2) wear that
 * look token for token. Behaviour may differ (a hover note, a centred popup, a <details> that works without
 * JavaScript); the drawing may not.
 *
 * Also caught: the `ⓘ` glyph rendered as text (its size is whatever the phone's font draws), and an icon-only button
 * whose face is a lucide info glyph (`Info` · `CircleHelp` · …) — the two other ways a hand-made ⓘ gets written.
 *
 * ⚠ To add a new ⓘ: use `<InfoTip>` (a hover note beside a label it prints) or `<Explain>` (a 44-px button and a
 * popup). Only when neither can work, add a reasoned entry to `SITES` and copy InfoTip's classes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/* ── the house look, read from the house ⓘ ─────────────────────────────── */

const INFO_TIP = 'app/_components/info-tip.tsx';

function infoTipTrigger(): string[] {
  const src = read(INFO_TIP);
  const m = /<button[\s\S]*?className="([^"]*\bsn-dot-btn\b[^"]*)"[\s\S]*?<span aria-hidden="true">i<\/span>/.exec(src);
  assert.ok(m, 'anti-vacuity: InfoTip no longer draws its ⓘ as a `.sn-dot-btn` button with an "i" — re-aim this guard');
  return m[1]!.split(/\s+/).filter(Boolean);
}

const TRIGGER = infoTipTrigger();
/** The drawing: size, shape, hairline, type, ink — every unprefixed token of those kinds on InfoTip's trigger. */
const LOOK = TRIGGER.filter((t) => /^(?:h-|w-|rounded-|border|text-|font-|leading-)/.test(t));
/** The same drawing without its two colours — for a surface whose ink is not the page's (see `colours`). */
const SHAPE = LOOK.filter((t) => !/^(?:border|text)-(?:ink|white|black|\[)/.test(t) || /^text-\[\d/.test(t));
/** The colours it turns while hovered or open (InfoTip's `aria-expanded:` tokens, any variant may carry them). */
const ON = TRIGGER.filter((t) => t.startsWith('aria-expanded:')).map((t) => t.slice('aria-expanded:'.length));
/** A resting colour that is not the house ink — what the Suppliers ⓘ wore. */
const LOUD = /^(?:text|bg|border)-(?:sn-accent|sn-on-accent|terracotta|mulberry|orange|white)(?:\/\d+)?$|^bg-/;

test('the house look was read, and it is the calm one', () => {
  for (const t of ['h-4', 'w-4', 'rounded-full', 'border', 'text-[10px]', 'font-semibold', 'leading-none']) {
    assert.ok(LOOK.includes(t), `anti-vacuity: InfoTip's ⓘ lost \`${t}\` — LOOK is ${LOOK.join(' ')}`);
  }
  assert.ok(LOOK.some((t) => /^text-ink\/\d+$/.test(t)), 'the house ⓘ is no longer ink at rest');
  assert.ok(LOOK.some((t) => /^border-ink\/\d+$/.test(t)), 'the house ⓘ hairline is no longer ink');
  assert.equal(SHAPE.length, LOOK.length - 2, `SHAPE should be LOOK minus its two colours — got ${SHAPE.join(' ')}`);
  assert.ok(ON.length >= 2, 'anti-vacuity: InfoTip has no open-state colours');
  assert.ok(!TRIGGER.some((t) => LOUD.test(t)), 'the house ⓘ itself wears a loud resting colour');
  assert.ok(TRIGGER.includes('sn-dot-btn'), 'the house ⓘ lost the 46-px halo press');
});

/* ── every place that draws an "i" ─────────────────────────────────────── */

type Site = {
  /** Why this file draws its own ⓘ instead of rendering `<InfoTip>` / `<Explain>`. */
  why: string;
  /**
   * `obsidian`: the surface is dark in both themes, where `ink/*` reads 1.27:1 — the shape is held, not the ink.
   * `guest`: a guest page (`app/[slug]`) never names the app's accent (`the-accent-is-one-token.test.ts` (4)) — the
   * couple's own colour, `terracotta` (every hub look moves it), stands in for `sn-accent` as the "on" colour.
   */
  colours?: 'obsidian' | 'guest';
};

const SITES: Record<string, Site> = {
  [INFO_TIP]: { why: 'THE house ⓘ — the source of LOOK.' },
  'app/_components/explain.tsx': {
    why: 'the explanation template (a 44-px button; a centred popup on a phone) — its mark is InfoTip’s, inside that button',
  },
  'app/dashboard/[eventId]/schedule/_components/day-ui.tsx': {
    why: 'InfoTip PRINTS its label; every ⓘ on the day rail sits beside a label its caller already prints',
  },
  'app/dashboard/(launcher)/page.tsx': {
    why: 'the My Events shelf ⓘ is a server-rendered <details> so it opens with JavaScript off, on a venue’s bad signal',
  },
  'app/onboarding/_shared/setup-card.tsx': { why: 'it opens its line IN the page under the title, not a hover note' },
  'app/[slug]/_components/selfie-capture.tsx': {
    why: 'a 44-px button that opens the face-step details sheet',
    colours: 'guest',
  },
  'app/_components/site-stage/site-stage.tsx': {
    why: 'the Maker’s who×when stage is obsidian in both themes; InfoTip’s ink and popover are the light page’s',
    colours: 'obsidian',
  },
};

/** Draws an "i" that is NOT an info button. Each needs a reason a person would accept. */
const NOT_AN_INFO_BUTTON: Record<string, string> = {
  'app/dashboard/[eventId]/launch/_components/stage-panel/camera-face.tsx':
    'a non-interactive DRAWING of the guest camera’s own status chip, white on the camera feed (approved prototype ' +
    'papic_camera_complete_2026-10-24_fable.html) — not a control, nothing opens',
};

/** Plain HTML strings with no stylesheet: the look is held as inline-style numbers, checked below. */
const HTML_STRING_PAGES = ['lib/wallet-pass.ts'];

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.d\.ts$/.test(name)) out.push(p);
    }
  };
  for (const root of ['app', 'lib', 'components']) {
    try {
      walk(join(WEB, root));
    } catch {
      /* a root that does not exist */
    }
  }
  return out.map((p) => relative(WEB, p).split(sep).join('/'));
}

const FILES = sourceFiles();
/** Each file read and comment-stripped ONCE — three tests scan the whole tree. */
const SRC = new Map(FILES.map((f) => [f, read(f)]));
/** An element whose only text is "i": `>i<`, with any whitespace. */
const DRAWN_I = />\s*i\s*<\//g;

type Drawn = { file: string; line: number; cls: string[]; control: string[] };

function drawnSites(): Drawn[] {
  const out: Drawn[] = [];
  for (const [file, src] of SRC) {
    for (const m of src.matchAll(DRAWN_I)) {
      // From the nearest opening <button>/<summary> (the control the "i" sits in), or 900 chars when there is none.
      // Comments are blanked to spaces by `stripComments`, so a long note between the two must not cut the window.
      const opener = Math.max(src.lastIndexOf('<button', m.index!), src.lastIndexOf('<summary', m.index!));
      const before = src.slice(Math.max(0, Math.min(opener < 0 ? Infinity : opener, m.index! - 900)), m.index!);
      const all = [...before.matchAll(/className="([^"]*)"/g)];
      const cls = all.length ? all[all.length - 1]![1]!.split(/\s+/).filter(Boolean) : [];
      // The enclosing control's OWN classes — the first className after its opening tag.
      const own = opener < 0 ? null : /className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(src.slice(opener, m.index!));
      const control = own ? (own[1] ?? own[2]!).split(/\s+/).filter(Boolean) : [];
      out.push({ file, line: src.slice(0, m.index!).split('\n').length, cls, control });
    }
  }
  return out;
}

const DRAWN = drawnSites();

test('anti-vacuity: the scan reads the tree and finds the ⓘs it should', () => {
  assert.ok(FILES.length > 1000, `only ${FILES.length} source files were read`);
  for (const file of [...Object.keys(SITES), ...Object.keys(NOT_AN_INFO_BUTTON), ...HTML_STRING_PAGES]) {
    assert.ok(
      DRAWN.some((d) => d.file === file),
      `${file} is listed here but draws no "i" any more — take it off the list (a stale entry hides a new one)`,
    );
  }
});

test('no hand-made ⓘ outside the list — use <InfoTip> or <Explain>', () => {
  const known = new Set([...Object.keys(SITES), ...Object.keys(NOT_AN_INFO_BUTTON), ...HTML_STRING_PAGES]);
  const strays = DRAWN.filter((d) => !known.has(d.file)).map((d) => `${d.file}:${d.line}`);
  assert.deepEqual(
    strays,
    [],
    `a hand-drawn "i" — render <InfoTip label=…> (a hover note beside its label) or <Explain title=…> (a 44-px ` +
      `button and a popup). Only if neither can work, add a reasoned entry to SITES and wear InfoTip's classes:\n  ` +
      strays.join('\n  '),
  );
});

test('every listed ⓘ wears the house look, token for token — no accent "i", no white disc, no other size', () => {
  for (const d of DRAWN.filter((x) => SITES[x.file])) {
    const site = SITES[d.file]!;
    const where = `${d.file}:${d.line}`;
    const need = site.colours === 'obsidian' ? SHAPE : LOOK;
    const missing = need.filter((t) => !d.cls.includes(t));
    assert.deepEqual(missing, [], `${where} is not the house ⓘ — missing ${missing.join(' ')} (has: ${d.cls.join(' ')})`);
    const stray = d.cls.filter((t) => /^(?:h|w)-(?!4$|11$)/.test(t) || /^text-\[\d/.test(t) && t !== 'text-[10px]');
    assert.deepEqual(stray, [], `${where} draws a second size beside the house one: ${stray.join(' ')}`);
    if (site.colours !== 'obsidian') {
      const loud = d.cls.filter((t) => LOUD.test(t));
      assert.deepEqual(loud, [], `${where} wears a resting colour that is not the house ink: ${loud.join(' ')}`);
      const ons = site.colours === 'guest' ? ON.map((t) => t.replace('sn-accent', 'terracotta')) : ON;
      for (const on of ons) {
        assert.ok(
          d.cls.some((t) => t.endsWith(`:${on}`)),
          `${where} does not turn \`${on}\` when hovered or open, as InfoTip does`,
        );
      }
    }
    // The 44-px floor: InfoTip's halo, an enclosing 44-px button, or a <summary>'s halo layer reaching 46.
    const pressable =
      d.cls.includes('sn-dot-btn') ||
      (d.control.includes('h-11') && d.control.includes('w-11')) ||
      d.cls.includes('before:-inset-[15px]');
    assert.ok(pressable, `${where} presses at under 44 px — wear \`sn-dot-btn\` or sit inside a 44-px button`);
  }
});

test('the wallet page’s ⓘ (a bare HTML string) spells the same look in inline styles', () => {
  const src = read('lib/wallet-pass.ts');
  const m = /const WALLET_INFO_DOT =\s*'([^']*)'/.exec(src);
  assert.ok(m, 'anti-vacuity: the wallet page no longer names its ⓘ');
  const dot = m[1]!;
  for (const decl of ['width:16px', 'height:16px', 'border-radius:9999px', 'font-size:10px', 'font-weight:600', 'line-height:1']) {
    assert.ok(dot.includes(decl), `the wallet ⓘ lost \`${decl}\` — it is not InfoTip's drawing`);
  }
  assert.match(dot, /border:1px solid rgba\(30,34,41,\.25\)/, 'the wallet ⓘ hairline is not ink/25');
  assert.match(dot, /color:rgba\(30,34,41,\.55\)/, 'the wallet ⓘ "i" is not ink/55');
  assert.match(src, /<summary aria-label="More" style="[^"]*min-width:44px;min-height:44px[^"]*">\$\{WALLET_INFO_DOT\}<\/summary>/);
});

test('no ⓘ glyph rendered as text — its size and weight are whatever the phone’s font draws', () => {
  const hits: string[] = [];
  for (const [file, src] of SRC) {
    // As JSX text or a string's whole value — prose ABOUT the ⓘ in a CSS comment inside a string is not a render.
    for (const m of src.matchAll(/>\s*ⓘ|ⓘ\s*<|(['"`])\s*ⓘ\s*\1/g)) {
      hits.push(`${file}:${src.slice(0, m.index!).split('\n').length}`);
    }
  }
  assert.deepEqual(hits, [], `render <InfoTip> or <Explain> instead of the ⓘ glyph:\n  ${hits.join('\n  ')}`);
});

test('no icon-only button whose face is a lucide info glyph', () => {
  const ICON = /<(Info|InfoIcon|BadgeInfo|CircleHelp|HelpCircle|CircleQuestionMark)\b[^>]*\/>\s*<\/(button|summary)>/g;
  const hits: string[] = [];
  for (const [file, src] of SRC) {
    if (!file.endsWith('.tsx')) continue;
    for (const m of src.matchAll(ICON)) {
      // The icon is the button's ONLY child when the nearest tag before it is that button's own opening tag.
      const before = src.slice(0, m.index!);
      const opens = [...before.matchAll(/<([A-Za-z][\w.]*)\b/g)];
      const parent = opens.length ? opens[opens.length - 1]![1] : '';
      if (parent === m[2] && /\}?\s*>\s*$/.test(before)) hits.push(`${file}:${before.split('\n').length} <${m[1]}>`);
    }
  }
  assert.deepEqual(hits, [], `an ⓘ drawn with a lucide glyph — use <InfoTip> or <Explain>:\n  ${hits.join('\n  ')}`);
});
