/**
 * 🛡 THE HUB LEFTOVERS (guest side, 2026-10-13) — three small faults the owner's walks found on the reply page.
 *
 *   1 · steps 2+ drew their question at 20 px while step 1's question is the couple's 32 px question line. Every
 *       question the one-at-a-time flow turns into a heading takes `RSVP_STEP_QUESTION_CLASS` (= step 1's class).
 *   2 · the terms line at 375: "Privacy Notice" broke across two lines, and the right ~6 px of the "Terms" press ticked
 *       the box (the sentence text after the link sat over the link's padding in the hit test).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BASE, GUEST, doorAction, renderReplyCard } from '@/lib/reply-card.fixture';
import { RSVP_FORM_QUESTION_CLASS, RSVP_STEP_QUESTION_CLASS } from '../_components/rsvp-lines';

const ASK_ALL = { plus_ones: true, meal: true, dietary: true, song_request: true, note: true, mobile: true };

/** Every opening tag whose class list holds the serif heading look, with the text it holds. */
function serifHeadings(html: string): Array<{ cls: string; text: string; ctx: boolean }> {
  const out: Array<{ cls: string; text: string; ctx: boolean }> = [];
  for (const m of html.matchAll(/<(legend|label|span|p)\b([^>]*?)class="([^"]*\bfont-serif\b[^"]*)"([^>]*)>([\s\S]*?)<\/\1>/g)) {
    out.push({ cls: m[3]!, text: m[5]!.replace(/<[^>]+>/g, '').trim(), ctx: /data-rsvp-context/.test(m[2]! + m[4]!) });
  }
  return out;
}

test('1 · step 1’s question class is the 32 px couple’s question line, and every later step takes that very class', () => {
  assert.match(RSVP_FORM_QUESTION_CLASS.out, /text-\[32px\]/);
  assert.equal(RSVP_STEP_QUESTION_CLASS, RSVP_FORM_QUESTION_CLASS.out);
});

test('1 · on the one-at-a-time reply every step’s question wears it — no 20 px heading after step 1', async () => {
  let checked = 0;
  for (const status of ['pending', 'attending'] as const)
    for (const canvas of [false, true]) {
      const html = await renderReplyCard({
        ...BASE,
        doorAction,
        oneAtATime: true,
        askTagging: true,
        previewEveryQuestion: canvas,
        ask: ASK_ALL,
        guest: { ...GUEST, rsvp_status: status, plus_one_allowed: true, plus_one_count: 1 },
      });
      const heads = serifHeadings(html);
      for (const h of ['Want to be tagged', 'Who are you bringing?', 'A note to', 'How the couple can reach you', 'Your meal preference', 'Your dietary notes', 'A song to get you dancing']) {
        const hit = heads.find((x) => x.text.startsWith(h));
        assert.ok(hit, `${status}/${canvas ? 'sample' : 'guest'}: no heading "${h}" was drawn — this guard tests nothing`);
        assert.equal(hit.cls, RSVP_STEP_QUESTION_CLASS, `${status}/${canvas ? 'sample' : 'guest'}: "${h}" does not wear step 1's question line ("${hit.cls}")`);
        checked += 1;
      }
      for (const x of heads) {
        if (x.ctx) continue;
        assert.doesNotMatch(x.cls, /\btext-xl\b/, `${status}: "${x.text}" is a 20 px heading on a reply that asks one question at a time`);
      }
    }
  assert.ok(checked >= 28, `only ${checked} headings checked`);
});

test('1 · off "one at a time" the small labels stay small — the page form is unchanged', async () => {
  const html = await renderReplyCard({ ...BASE, doorAction, oneAtATime: false, ask: ASK_ALL, guest: { ...GUEST, rsvp_status: 'attending' } });
  assert.match(html, /<label for="meal_preference" class="block text-sm font-medium text-ink">Your meal preference<\/label>/);
});
