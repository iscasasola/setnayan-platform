/**
 * studio-logo-posts-the-same.test.ts — STUDIO › LOGO SENDS WHAT IT ALWAYS SENT (2026-10-09; the page's chrome moved onto the Action
 * button / Form row / Switch / Dropdown / Slider templates).
 *
 * The Logo page has ONE write: the composed logo and its layers into the couple's DRAFT (`hubDraftAction`, published by ✓ Apply), after
 * a pause and only when the logo really changed. A control that is redrawn but changes what is posted — or when — renders exactly like
 * success. So `studio-logo-posts-the-same.golden.json` holds the FormData the page built BEFORE any control moved (recorded from the real
 * page in Chromium; see its `_about`), and this test RUNS the builder the page now posts through (`lib/studio-logo-saves.ts`) on those
 * payloads and compares, byte for byte; it holds the wiring (the page posts through the builder and through the context's action only),
 * the save gate and the pause as they were, and that a refused or dropped save says so in plain words (the golden's `says_after`).
 *
 * SABOTAGE (each seen RED, then restored): the builder drops `intent` · the config key renamed · the page hand-builds a patch beside the
 * builder · the refusal printed raw again · the pause changed · the save gate no longer asked · the page imports the real action again.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOGO_NOT_SAVED, logoDraftFields } from './studio-logo-saves';
import { isPlainSentence } from '../app/dashboard/[eventId]/guests/_components/plain-refusal';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const LOGO = 'app/dashboard/[eventId]/launch/_components/maker-logo.tsx';
type Call = { action: string; args: Array<{ formData: Array<[string, string]> } | string> };
type Entry = { calls: Call[]; state_before: string; says_before: Array<{ state: string; text?: string }>; state_after: string; says_after: Array<{ state: string; text?: string }> };
const golden = JSON.parse(readFileSync(join(__dirname, 'studio-logo-posts-the-same.golden.json'), 'utf8')) as Record<string, Entry>;
const scenarios = Object.keys(golden).filter((k) => !k.startsWith('_'));

test('1 · every save is the composed logo and its layers as one `patch`, through the draft door — rebuilt from the recorded payloads, byte for byte', () => {
  let saves = 0;
  for (const s of scenarios) {
    for (const c of golden[s]!.calls) {
      saves++;
      assert.equal(c.action, 'hubDraftAction', s);
      assert.equal(c.args[0], 'E1', `${s}: the event is the first argument`);
      const fd = (c.args[1] as { formData: Array<[string, string]> }).formData;
      assert.deepEqual(fd.map(([k]) => k), ['intent', 'patch'], `${s}: field names and order`);
      const ev = (JSON.parse(fd[1]![1]) as { events: { monogram_custom_svg: string; monogram_studio_config: { layers: unknown[]; anim?: unknown } } }).events;
      assert.deepEqual(Object.keys(ev), ['monogram_custom_svg', 'monogram_studio_config'], `${s}: the columns written`);
      const rebuilt = logoDraftFields({ svg: ev.monogram_custom_svg, layers: ev.monogram_studio_config.layers, anim: ev.monogram_studio_config.anim ?? null });
      assert.deepEqual(Object.entries(rebuilt), fd, `${s}: the builder does not rebuild what the page sent`);
    }
  }
  assert.ok(saves >= 13, `only ${saves} recorded saves — the golden shrank`);
});

test('2 · each control sends one save, once the logo has really changed — and a rename, or a move that changes nothing, sends none (as before)', () => {
  for (const s of ['l1_add_frame', 'l2_frame_kind', 'l3_colour_studio', 'l3b_colour_shipped', 'l4_size', 'l5b_rotate', 'l6_move', 'l7_remove', 'l8_knockout', 'l9_motion_in', 'l9b_motion_out', 'l10_delay']) {
    assert.equal(golden[s]!.calls.length, 1, `${s}: one save`);
  }
  assert.equal(golden.l11_rename!.calls.length, 0, 'a rename is in the layer list, not in the file — it never saved on its own');
  assert.equal(golden.l5_centre!.calls.length, 0);
  const src = read(LOGO);
  assert.match(src, /const PAUSE_MS = 1500;/, 'the pause before a change is sent moved');
  assert.match(src, /if \(!gate\.current\.shouldSave\(svg\) \|\| inFlight\.current\) return;/, 'the save gate is no longer asked before a write');
  assert.match(src, /gate\.current\.touch\(composedRef\.current\)/, 'the couple’s own touch no longer records the logo as it stood (opening could write)');
  assert.equal((src.match(/hubDraftAction\(eventId, fd\)/g) ?? []).length, 1, 'the page has more than one write');
});

test('3 · the page posts only through the builder and the context’s action', () => {
  const src = read(LOGO);
  assert.match(src, /for \(const \[k, v\] of Object\.entries\(logoDraftFields\(\{ svg, layers: layersRef\.current\.map\(metaOf\), anim: opening\.anim \}\)\)\) fd\.set\(k, v\);/);
  assert.doesNotMatch(src, /fd\.set\('(?:intent|patch)'|JSON\.stringify\(\{\s*events/, 'a payload is hand-built beside the builder');
  assert.match(src, /const \{ hubDraftAction \} = useLogoActions\(\);/);
  assert.doesNotMatch(src, /from '[^']*hub-draft-actions'/, 'the page imports the real action again (the lab could then reach the database)');
});

test('4 · a refused or dropped save SAYS SO in plain words and is announced as an error — never the database’s words, never as saved', () => {
  for (const s of ['f1_refused', 'f2_thrown']) {
    const e = golden[s]!;
    assert.equal(e.state_after, 'error', `${s}: the page does not show the save as failed`);
    const last = e.says_after[0]!;
    assert.equal(last.state, 'error');
    assert.equal(last.text, LOGO_NOT_SAVED);
    assert.ok(isPlainSentence(last.text!), `${s}: "${last.text}" is not a plain sentence`);
  }
  assert.doesNotMatch(golden.f1_refused!.says_after[0]!.text!, /row-level|violates/);
  assert.match(golden.f1_refused!.says_before[0]!.text!, /row-level security/, 'the golden no longer records what the old page printed');
  const src = read(LOGO);
  assert.match(src, /const text = plainRefusal\(r\.error, LOGO_NOT_SAVED\);/);
  assert.doesNotMatch(src, /text: r\.error|announceMakerSave\(\{ state: 'error', text: r\.error/, 'the server’s own text is printed raw');
});
