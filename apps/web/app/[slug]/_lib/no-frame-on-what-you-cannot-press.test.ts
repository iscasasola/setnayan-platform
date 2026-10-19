/**
 * A FRAME ONLY ON WHAT YOU PRESS (owner rule, 2026-10-11 — "a frame only on something pressable, dividers between
 * topics"; sweep 2026-10-19 · row C6). The Everyone page's two notes were dashed boxes and /our-story's three eras and
 * four "kept" items were boxed cards — none of them pressed anything.
 *
 * The property, per file: any element that draws a four-sided frame (a `border` / `border-dashed` class, the `m-card`
 * class, or an inline `border:` style) is something you press (`<a>`, `<button>`, `<Link>`, `<label>`) — a one-sided
 * rule (`border-t`, `borderTop`) is a divider and is welcome.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '../..');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));

const PRESSABLE = /^(a|button|Link|label)$/;
const FRAME_CLASS = /(?:^|\s)(?:border|border-dashed|border-dotted|m-card)(?:\s|$)/;

/** Every opening JSX tag with its name and its attribute text. */
function tags(src: string): { name: string; attrs: string }[] {
  const out: { name: string; attrs: string }[] = [];
  const re = /<([A-Za-z][\w.]*)\b((?:[^<>{}]|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*)>/g;
  for (let m = re.exec(src); m; m = re.exec(src)) out.push({ name: m[1] ?? '', attrs: m[2] ?? '' });
  return out;
}

function framesOnUnpressables(src: string): string[] {
  const bad: string[] = [];
  for (const { name, attrs } of tags(src)) {
    if (PRESSABLE.test(name)) continue;
    const cls = [...attrs.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) => m[1] ?? m[2] ?? '').join(' ');
    const framedByClass = FRAME_CLASS.test(cls);
    const framedByStyle = /[{,]\s*border:\s*['"`]/.test(attrs);
    if (framedByClass || framedByStyle) bad.push(`<${name} ${attrs.trim().slice(0, 140)}>`);
  }
  return bad;
}

for (const rel of ['[slug]/everyone/page.tsx', '_components/marketing/OurStory.tsx']) {
  test(`${rel} · no frame on anything you cannot press`, () => {
    const src = read(rel);
    assert.ok(tags(src).length > 8, `${rel}: the tag reader found almost nothing — it is reading the wrong file`);
    const bad = framesOnUnpressables(src);
    assert.deepEqual(bad, [], `${rel} frames something nobody can press:\n  ${bad.join('\n  ')}`);
  });
}

test('the reader sees a frame when there is one (it is not blind)', () => {
  assert.equal(framesOnUnpressables('<p className="mt-4 rounded-2xl border border-dashed border-ink/20">x</p>').length, 1);
  assert.equal(framesOnUnpressables(`<div className="m-card h-full" style={{ display: 'flex' }}>x</div>`).length, 1);
  assert.equal(framesOnUnpressables(`<div style={{ background: 'x', border: '1px solid red' }}>x</div>`).length, 1);
  assert.equal(framesOnUnpressables('<Link className="rounded-full border px-4">x</Link>').length, 0);
  assert.equal(framesOnUnpressables(`<div style={{ borderTop: '1px solid red' }} className="border-t">x</div>`).length, 0);
});
