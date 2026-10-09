/**
 * setup-controls-are-the-templates.test.ts — STEP 3D of Guests › Setup: EVERY ⓘ IS THE APPROVED EXPLAIN, EVERY BUTTON THE ONE
 * ACTIONBUTTON, ONE FILLED FORWARD STEP PER ROW — in every state the view can be in.
 *
 * Rendered (not just read): all five "How guests get in" choices × Finalize open / locked × the invite count read / 0 / refused.
 * Read: the Guests-only Setup files hold no bare `<button>`, no older `InfoTip`, no native `<select>` / `<input>`, no `Sheet`,
 * and none of the old skin's strings.
 *
 * SABOTAGE (each seen RED, then restored): an `InfoTip` back on Finalize · a bare `<button>` in the rows · a second filled
 * button on the locked row · a native `<select>` in the frames.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { renderSetup } from './render-setup';

const HERE = dirname(fileURLToPath(import.meta.url));
const ONLY = ['guest-setup-rows.tsx', 'setup-frames.tsx'] as const;
const GET_IN = ['list', 'personal', 'requests', 'one_qr_approve', 'one_qr'] as const;

test('the Guests-only Setup files hold no hand-made control', () => {
  for (const f of ONLY) {
    const src = stripComments(readFileSync(join(HERE, f), 'utf8'));
    assert.doesNotMatch(src, /<button\b|<select\b|<input\b|<textarea\b|InfoTip|info-tip|<Sheet\b|button-primary|button-secondary|bg-ink\b|bg-mulberry|terracotta-\d/, `${f}: a hand-made control is back`);
  }
});

test('in every state, every ⓘ is Explain, every button is an ActionButton, and a row has at most one filled step', async () => {
  for (const getIn of GET_IN) {
    for (const locked of [false, true]) {
      for (const toInvite of [4, 0, null] as const) {
        const html = await renderSetup({ getIn, toInvite, headcount: { locked, attending: locked ? 7 : 3, heads: 7 } });
        const where = `${getIn} · ${locked ? 'locked' : 'open'} · toInvite ${toInvite}`;
        /* The ⓘ is the approved one: its own 44-px target, "About <name>", the accent mark — never the older tip. */
        for (const m of html.matchAll(/data-explain=""[^>]*>/g)) assert.match(m[0], /aria-label="About [^"]+"/, `${where}: an ⓘ without its name`);
        assert.doesNotMatch(html, /sn-tip|data-info-tip/, `${where}: the older ⓘ is drawn`);
        /* Every control that is a button is one the rule draws: `.ab`, a switch/chip/pill of the templates, the ⓘ, the dropdown. */
        for (const m of html.matchAll(/<button\b[^>]*>/g)) {
          assert.match(
            m[0],
            /class="ab |data-explain=|aria-haspopup="listbox"|data-form-row-pill=|role="switch"|data-chip|aria-pressed=/,
            `${where}: a button the templates do not draw: ${m[0].slice(0, 160)}`,
          );
        }
        for (const chunk of html.split('data-form-row=').slice(1)) {
          assert.ok((chunk.match(/class="ab ab-\w+ ab-main/g) ?? []).length <= 1, `${where}: a row has two filled steps`);
        }
      }
    }
  }
});

test('the locked list offers ONE way back and no filled step; the open list offers Finalize now as the OK-toned filled step', async () => {
  const locked = await renderSetup({ getIn: 'list', headcount: { locked: true, attending: 7, heads: 7 } });
  const row = locked.slice(locked.indexOf('data-setup-row="finalize"'));
  assert.match(row, /data-testid="setup-reopen"/);
  assert.doesNotMatch(row, /ab-main/, 'the locked row has a filled step');
  const open = await renderSetup({ getIn: 'list' });
  assert.match(open, /class="ab ab-ok ab-main[^"]*"[^>]*data-testid="setup-finalize-now"|data-testid="setup-finalize-now"[^>]*class="ab ab-ok ab-main/);
});
