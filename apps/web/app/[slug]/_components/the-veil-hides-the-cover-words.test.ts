/**
 * the-veil-hides-the-cover-words.test.ts — BEHIND THE VEIL, NONE OF THE COVER'S WORDS SHOW; AFTER THE UNVEIL EVERY
 * LINE ENTERS (owner 2026-10-16, DECISION_LOG "BEHIND THE VEIL, NONE OF THE COVER'S WORDS SHOW"; verbatim: *"Yes —
 * behind the veil, none of the cover's words show. After the unveil, every line enters with the cover's entrance
 * (lines with no Build in get the cover's default)."*).
 *
 * 🔴 Live on cale-ice, veil closed: the date and the venue showed through the fabric, with the mark's two hairlines.
 * They had no Build in, so no paused first frame held them back — the names did (theirs).
 *
 *   (1) EVERY LINE IS MARKED — in all four designs, with and without the card, the badge and the rule included; a line
 *       with its own Build in says so (`own`); the joiner is inside the names, never a line of its own.
 *   (2) THE HOLD DRAWS NONE OF THEM — the veil's one `<style>` hides every marked line, and the script also writes the
 *       marker that outlives the unveil and numbers the lines in reading order BEFORE it lets go.
 *   (3) THE DEFAULT ENTRANCE IS THE SHIPPED DEFAULT BUILD IN — Calm (`HUB_PRESET_BODY[HUB_DEFAULT_PRESET]`): the same
 *       keyframe, seconds, ease and stagger, written into globals.css under the marker, inside the reduced-motion gate,
 *       on lines WITHOUT a Build in only (a line with one keeps it).
 *   (4) THE LOADING FRAME IN FRONT OF A VEIL draws none of them either, for at most the hold's own failsafe; page.tsx
 *       asks the page's own opening decision; the Maker's canvas never is.
 *
 * The rendered half — opacity actually 0 under the hold and actually 1 after the unveil — is
 * `tests/e2e/the-veil-hides-the-cover-words.spec.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  COVER_DEFAULT_ENTRANCE,
  COVER_LINE_ATTR,
  VEIL_HOLD_ATTR,
  VEIL_HOLD_FAILSAFE_MS,
  VEIL_HOLD_SCRIPT,
  VEIL_WORDS_ATTR,
} from '@/lib/hub-veil';
import { HUB_DEFAULT_PRESET, HUB_PRESET_BODY, hubCanvasVars, hubInKeyframe } from '@/lib/hub-canvas';
import { loadingOpensUnderAVeil } from '../_lib/loading-stage';

(globalThis as unknown as { React: unknown }).React = React;
const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const DESIGNS = ['card', 'marquee', 'crest', 'letter'] as const;

/** The masthead's root `<header data-pahina-first-screen …>…</header>`. */
function header(html: string): string {
  const at = html.indexOf('<header data-pahina-first-screen=""');
  assert.ok(at >= 0, 'no masthead header in the render');
  return html.slice(at, html.indexOf('</header>', at) + '</header>'.length);
}

test('(1) every line of the cover is marked — the badge and the rule too; a line with its own Build in says so', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PahinaMasthead } = await import('./pahina-masthead');
  const badge = React.createElement('p', { className: 'inline-flex' }, 'Happening now');
  const mark = React.createElement('span', { 'data-test-mark': '' }, 'MJ');
  const elements = { names: { motion: { in: { fade: true } } }, joiner: { motion: { in: { fade: true } } } };
  const card = { eyebrow: 'Together with their families', line: 'invite you to celebrate their wedding', timeLabel: 'Starts 2:30 PM', hubHref: '#hub', hubLabel: 'the day, the place' };
  for (const design of DESIGNS) {
    for (const withCard of [true, false]) {
      const html = header(
        renderToStaticMarkup(
          React.createElement(PahinaMasthead, {
            displayName: 'Maria & Jose',
            eventDate: '2026-12-18',
            venueName: 'Manila Cathedral',
            badgeSlot: badge,
            monogramSlot: mark,
            design,
            elements,
            ...(withCard ? { card } : {}),
          } as never),
        ),
      );
      const where = `${design}${withCard ? ' + card' : ''}`;
      const marked = [...html.matchAll(new RegExp(`<(\\w+)[^>]*${COVER_LINE_ATTR}="(\\w*)"[^>]*>`, 'g'))];
      // The words a guest reads: each one sits inside a marked line.
      for (const words of ['Happening now', 'Maria', 'Jose', 'December', withCard ? 'invite you' : 'Manila Cathedral', 'MJ']) {
        const at = html.indexOf(words);
        assert.ok(at > 0, `${where}: "${words}" is not on the cover`);
        const before = html.slice(0, at);
        const opened = (before.match(new RegExp(`${COVER_LINE_ATTR}="`, 'g')) ?? []).length;
        assert.ok(opened > 0, `${where}: "${words}" is drawn before any cover line — it would show behind the veil`);
      }
      // The names wear `own` (their Build in); the joiner is never a line of its own, even with a Build in.
      const names = /<h1[^>]*data-hub-names=""[^>]*>/.exec(html)![0];
      assert.match(names, new RegExp(`${COVER_LINE_ATTR}="own"`), `${where}: the names' own Build in is not marked — it would be replaced`);
      assert.equal(marked.filter((m) => m[2] === 'own').length, 1, `${where}: a line without a Build in is marked as having one`);
      assert.ok(marked.filter((m) => m[2] === '').length >= 4, `${where}: the lines without a Build in are not marked`);
      // Nothing un-marked draws ink in the header except the ground: no text node outside a line.
      const outside = html
        .replace(new RegExp(`<(\\w+)[^>]*${COVER_LINE_ATTR}="\\w*"[^>]*>[\\s\\S]*?</\\1>`, 'g'), '')
        .replace(/<[^>]+>/g, '')
        .trim();
      assert.equal(outside, '', `${where}: words outside every cover line — they would show behind the veil: "${outside}"`);
      if (design === 'card' && !withCard) assert.match(html, new RegExp(`<hr ${COVER_LINE_ATTR}=""`), 'the rule under the names is not a line');
    }
  }
});

test('(2) the hold draws no line, writes the marker that outlives it, and numbers the lines before it lets go', () => {
  const script = VEIL_HOLD_SCRIPT;
  assert.match(script, new RegExp(`st\\.setAttribute\\('${VEIL_HOLD_ATTR}',''\\);st\\.textContent='[^']*\\[${COVER_LINE_ATTR}\\]\\{opacity:0 !important\\}'`), 'the hold no longer hides the cover’s lines');
  assert.match(script, new RegExp(`ws\\.setAttribute\\('${VEIL_WORDS_ATTR}',''\\);\\(document\\.head\\|\\|d\\)\\.appendChild\\(ws\\)`), 'the page no longer says it opened under a veil');
  assert.doesNotMatch(script, /removeChild\(ws\)/, 'the marker is taken off — the lines would pop in instead of entering');
  const release = script.slice(script.indexOf('w.__veilRelease=function(){'));
  const numbering = release.indexOf(`querySelectorAll('[${COVER_LINE_ATTR}]')`);
  const letGo = release.indexOf('st.parentNode.removeChild(st)');
  assert.ok(numbering > 0 && numbering < letGo, 'the lines are not numbered (reading order) before the hold lets go');
  assert.match(release, /style\.setProperty\('--cover-at',String\(c\)\)/);
  assert.equal(VEIL_HOLD_FAILSAFE_MS, 12000);
});

test('(3) the default entrance is the shipped default Build in, under the marker, only on lines with none of their own', () => {
  const calm = HUB_PRESET_BODY[HUB_DEFAULT_PRESET];
  assert.equal(COVER_DEFAULT_ENTRANCE.keyframe, hubInKeyframe(calm), 'the default entrance is not the default Build in’s keyframe');
  assert.equal(COVER_DEFAULT_ENTRANCE.durationS, calm.duration);
  assert.equal(COVER_DEFAULT_ENTRANCE.staggerS, calm.stagger);
  assert.equal(COVER_DEFAULT_ENTRANCE.ease, hubCanvasVars({})['--hub-ease'], 'the default entrance is not on the default Build in’s ease');

  const css = read('app/globals.css');
  const { keyframe: kf, durationS: d, ease, staggerS: st } = COVER_DEFAULT_ENTRANCE;
  const marker = `html:has(> head > style[${VEIL_WORDS_ATTR}])`;
  const enter = `${marker} [${COVER_LINE_ATTR}='']:not([data-el-motion]) {\n    animation: ${kf} ${d}s ${ease} calc(${st}s * var(--cover-at, 0)) both;\n  }`;
  const at = css.indexOf(enter);
  assert.ok(at > 0, `globals.css no longer gives a line with no Build in the default entrance:\n${enter}`);
  const fade = `${marker} [${COVER_LINE_ATTR}=''][data-el-motion] {\n    transition: opacity ${d}s ${ease} calc(${st}s * var(--cover-at, 0));\n  }`;
  assert.ok(css.includes(fade), 'a line that moves but has no Build in no longer fades in on the default clock');
  const gate = css.lastIndexOf('@media', at);
  assert.equal(css.slice(gate, css.indexOf('{', gate)).trim(), '@media screen and (prefers-reduced-motion: no-preference)', 'the entrance is outside the reduced-motion gate');
  assert.match(css, new RegExp(`@keyframes ${kf}\\s*\\{ from \\{ opacity: 0; \\} \\}`), 'the default Build in’s keyframe is gone');
  // A line WITH its own Build in is never given the default: no rule names `own` lines.
  assert.doesNotMatch(css, new RegExp(`\\[${COVER_LINE_ATTR}='own'\\]`), 'a rule overrides a line’s own Build in');
});

test('(4) the loading frame in front of a veil keeps the lines’ places and draws none; the Maker’s canvas never', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { InvitationSkeleton } = await import('./invitation-skeleton');
  for (const design of DESIGNS) {
    const veiled = renderToStaticMarkup(React.createElement(InvitationSkeleton, { displayName: 'Maria & Jose', monogramText: 'MJ', eventDate: '2026-12-18', design, veiled: true }));
    assert.match(veiled, /<main [^>]*data-loading-veiled=""/, `${design}: the loading frame in front of a veil draws the cover’s words`);
    assert.ok((veiled.match(new RegExp(`${COVER_LINE_ATTR}="`, 'g')) ?? []).length >= 4, `${design}: the loading frame’s lines are not marked`);
    const open = renderToStaticMarkup(React.createElement(InvitationSkeleton, { displayName: 'Maria & Jose', monogramText: 'MJ', eventDate: '2026-12-18', design }));
    assert.doesNotMatch(open, /data-loading-veiled/, `${design}: a page with no veil loads without its words`);
  }
  const css = read('app/globals.css');
  const rule = /\[data-loading-veiled\] \[data-cover-line\] \{\s*animation: sn-el-waits (\d+)s step-end;\s*\}/.exec(css);
  assert.ok(rule, 'the loading frame’s lines are not held back by visibility (their place must be kept)');
  assert.equal(Number(rule[1]) * 1000, VEIL_HOLD_FAILSAFE_MS, 'the loading frame holds the words longer (or shorter) than the hold’s own failsafe');
  const gate = css.lastIndexOf('@media', rule.index);
  assert.equal(css.slice(gate, css.indexOf('{', gate)).trim(), '@media screen and (prefers-reduced-motion: no-preference)');

  const base = { makerCanvas: false, openingMounts: true, revealPlaysOn: (p: string) => p === 'rsvp', clockPhase: 'rsvp', pinnedPhase: null, askedPhase: null, solemn: false } as const;
  assert.equal(loadingOpensUnderAVeil(base), true);
  assert.equal(loadingOpensUnderAVeil({ ...base, makerCanvas: true }), false, 'the Maker’s canvas never opens under a veil');
  assert.equal(loadingOpensUnderAVeil({ ...base, openingMounts: false }), false, 'a page with no opening loads under a veil');
  assert.equal(loadingOpensUnderAVeil({ ...base, clockPhase: 'event' }), false);
  assert.equal(loadingOpensUnderAVeil({ ...base, clockPhase: 'event', askedPhase: 'rsvp' }), true, 'a `?phase=` that may be honoured is not counted');

  const page = stripComments(read('app/[slug]/page.tsx'));
  assert.match(page, /veiled=\{skeletonVeiled\}/, 'page.tsx no longer tells the loading screen about the veil');
  assert.match(page, /makerCanvas: asksForEditorBridge\(search\)/);
  assert.match(page, /revealAllowedFor\(\{ ownsPro: owns, chosenTemplate, adminDefault: config\.defaultTemplate, isStaffPreview, allowed: config\.templates \}\) !==\s*REVEAL_NONE/, 'the loading frame no longer asks the page’s own opening decision');
});
