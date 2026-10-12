/**
 * 🛡 EVERY STEP OF THE REPLY WEARS SCREEN 1 — AND THE PROGRESS NEVER SAYS "N OF M" (owner's live walk, 2026-10-12, on
 * his own invitation as a guest, production 820508f):
 *
 *   1 · screen 1 read "1 of 3"; after "Joyfully accepts" screen 2 read "2 of 4" — a yes opens the questions only
 *       somebody coming is asked, so the total changed mid-way. Now: dots only, one per step known so far, each a
 *       FIXED size, so a yes adds dots quietly and going forward never draws less filled (`RsvpStepProgress`).
 *   2 · screen 1's answers were white pills with a dark outline; screen 2's ("Yes, tag me / No thanks") were grey
 *       filled pills in italic serif — the tagging question drew The question style's pill, hard-coded, with no
 *       Look › Buttons hook. Now every two-choice question on the card wears the style's ONE answer
 *       (`RSVP_ANSWER_CLASS`, `rsvp-styles.tsx`), the hook, and — on the reply card — the couple's own Yes / No look
 *       (`data-rsvp-wears`, `lib/rsvp-look.ts`).
 *
 * Proven by rendering, not by reading the source: the cards are drawn for every style, both registers, with and
 * without plus-ones, as a guest and on the Maker's sample.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BASE, CELEBRATE, GUEST, SOLEMN, doorAction, renderReplyCard } from '@/lib/reply-card.fixture';
import { readRsvpLook, rsvpLookCss } from '@/lib/rsvp-look';

/** Every `<label>` that holds a radio, with the fieldset it answers. */
function answers(html: string): Array<{ group: string; open: string }> {
  const out: Array<{ group: string; open: string }> = [];
  for (const m of html.matchAll(/(<label\b[^>]*>)(?:(?!<\/label>)[\s\S])*?<input type="radio"[^>]*? name="([^"]+)"/g)) {
    out.push({ open: m[1]!, group: m[2]! });
  }
  return out;
}
const classOf = (open: string) => /class="([^"]*)"/.exec(open)?.[1] ?? '';

const CARDS: Array<[string, Record<string, unknown>]> = [];
for (const style of [null, 'question', 'ticket'] as const)
  for (const words of [CELEBRATE, SOLEMN])
    for (const plus of [0, 1, 2])
      for (const one of [true, false])
        for (const canvas of [false, true])
          CARDS.push([
            `${style ?? 'reply-card'} · ${words === SOLEMN ? 'solemn' : 'celebratory'} · +${plus} · ${one ? 'one at a time' : 'one page'} · ${canvas ? 'sample' : 'guest'}`,
            {
              ...BASE,
              words,
              sceneStyle: style,
              doorAction,
              askTagging: true,
              oneAtATime: one,
              previewEveryQuestion: canvas,
              guest: { ...GUEST, plus_one_allowed: plus > 0, plus_one_count: plus },
            },
          ]);

test('2 · every two-choice question on the card wears screen 1’s answer — one class, one hook, every style', async () => {
  let tagged = 0;
  for (const [name, props] of CARDS) {
    const html = await renderReplyCard(props);
    const all = answers(html);
    const first = all.filter((a) => a.group === 'rsvp_status');
    const later = all.filter((a) => a.group !== 'rsvp_status');
    assert.equal(first.length, 2, `${name}: screen 1 has its two answers`);
    assert.ok(later.length >= 2, `${name}: the tagging question was not drawn — this guard tests nothing`);
    tagged += 1;
    const look = classOf(first[0]!.open);
    const hooked = /data-rsvp-answer=""/.test(first[0]!.open);
    for (const a of [...first, ...later]) {
      assert.equal(classOf(a.open), look, `${name}: "${a.group}" draws an answer of its own — screen 2 looks unlike screen 1`);
      assert.equal(/data-rsvp-answer=""/.test(a.open), hooked, `${name}: "${a.group}" is ${hooked ? 'missing' : 'given'} the Look › Buttons hook screen 1 ${hooked ? 'has' : 'lacks'}`);
    }
    assert.doesNotMatch(later.map((a) => classOf(a.open)).join(' '), props.sceneStyle === 'question' ? /$^/ : /\bitalic\b|bg-ink\/\[0\.05\]/, `${name}: a later answer is the grey italic pill`);
  }
  assert.ok(tagged >= 72, `only ${tagged} cards drawn`);
});

test('2 · on the reply card the later answers wear the couple’s own Yes and No look', async () => {
  const html = await renderReplyCard({ ...BASE, doorAction, askTagging: true, oneAtATime: true });
  const tag = answers(html).filter((a) => a.group !== 'rsvp_status');
  assert.deepEqual(tag.map((a) => /data-rsvp-wears="([a-z]+)"/.exec(a.open)?.[1]), ['yes', 'no']);
  const css = rsvpLookCss(readRsvpLook({ look: { lines: { 'rsvp.yes': { s: 110 }, 'rsvp.no': { s: 85 } } } }), ['rsvp'], []);
  assert.match(css, /\[data-rsvp-line="yes"\]\[data-rsvp-line\],\[data-rsvp-wears="yes"\]\{zoom:1\.1;\}/);
  assert.match(css, /\[data-rsvp-line="no"\]\[data-rsvp-line\],\[data-rsvp-wears="no"\]\{zoom:0\.85;\}/);
  // The other styles name no lines, so their later answers wear none.
  for (const style of ['question', 'ticket']) {
    const other = await renderReplyCard({ ...BASE, doorAction, askTagging: true, sceneStyle: style });
    assert.doesNotMatch(other, /data-rsvp-wears/, `${style}: a style with no named lines wears one`);
  }
});

test('1 · the progress is dots only — never "N of M", whatever the step and the total', async () => {
  const { RsvpStepProgress, RSVP_PROGRESS_DOT } = await import('../_components/rsvp-one-at-a-time');
  for (let total = 2; total <= 12; total++)
    for (let index = 0; index < total; index++) {
      const html = renderToStaticMarkup(React.createElement(RsvpStepProgress, { index, total, onBack: () => {} }));
      const shown = html.replace(/<[^>]+>/g, ' ').replace(/‹ Back/, '').trim();
      assert.equal(shown, '', `${index + 1}/${total}: the progress says "${shown}" — a count in words`);
      assert.doesNotMatch(html, / of \d|of(?:<!-- -->)? ?\d/, `${index + 1}/${total}: "N of M" is back`);
      assert.doesNotMatch(html, /aria-[a-z]+="[^"]*\bof\b[^"]*"/, `${index + 1}/${total}: a screen reader is told a total`);
      const dots = [...html.matchAll(/<span aria-hidden="true" data-rsvp-dot="(done)?" class="([^"]*)"/g)];
      assert.equal(dots.length, total, 'one dot per step known so far');
      assert.equal(dots.filter((d) => d[1] === 'done').length, index + 1, 'the dots fill to the screen the guest is on');
      for (const d of dots) {
        assert.ok(d[2]!.startsWith(`${RSVP_PROGRESS_DOT} `), `a dot is not the fixed dot: "${d[2]}"`);
        assert.doesNotMatch(d[2]!, /\bflex-1\b|\bw-full\b|%/, 'a dot sized as a share of the row shrinks when a yes adds steps — progress that goes backwards');
      }
    }
});

test('1 · the dot is a FIXED size — so a yes that adds steps never draws less filled', async () => {
  const { RSVP_PROGRESS_DOT } = await import('../_components/rsvp-one-at-a-time');
  assert.match(RSVP_PROGRESS_DOT, /(?:^| )h-\d(?:\.\d)? /);
  assert.match(RSVP_PROGRESS_DOT, /(?:^| )w-\d(?:\.\d)?(?: |$)/);
  assert.match(RSVP_PROGRESS_DOT, /\bshrink-0\b/, 'a dot that may shrink is a share of the row again');
});
