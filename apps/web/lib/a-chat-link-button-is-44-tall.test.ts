/**
 * GUARD — a chat control that is a LINK wearing the shared button class is still 44 px tall.
 *
 * `.ab` (actionButtonClass) is 40 px. The 44 px floor in `globals.css` (@layer base) covers `button`,
 * `[role=button]`, `a.button` and `input[type=submit]` only, so a `<Link>` / `<a>` drawn with `actionButtonClass`
 * renders 40 tall unless it carries `min-h-11` itself. Main fixed the chat's hand-made links to `min-h-11` (W1, the
 * 44 px press floor); the template wave (#7632) moved them onto `actionButtonClass`, and this keeps the floor.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd();
const FILE = 'app/_components/chat-message-stream.tsx';

/** Every `<Link …>` / `<a …>` opening tag (up to its closing `>` line) that uses actionButtonClass. */
function linkButtons(src: string): string[] {
  const out: string[] = [];
  const open = /<(?:Link|a)\b/g;
  let m: RegExpExecArray | null;
  while ((m = open.exec(src))) {
    const rest = src.slice(m.index);
    const end = rest.search(/\n\s*>|\/>|>\s*\{|>\s*\n\s*[^\s<{]/);
    const tag = rest.slice(0, end < 0 ? 800 : end);
    if (/actionButtonClass\(/.test(tag)) out.push(tag);
  }
  return out;
}

test('every chat link drawn with actionButtonClass carries min-h-11 (the 44 px floor `.ab` does not give a link)', () => {
  // The matcher sees the shape it guards.
  const sample = `<Link\n  href="/x"\n  className={actionButtonClass('brand')}\n>\n  Go\n</Link>`;
  assert.equal(linkButtons(sample).length, 1, 'the matcher misses a link button');
  const tags = linkButtons(stripComments(readFileSync(join(WEB, FILE), 'utf8')));
  assert.ok(tags.length >= 4, `only ${tags.length} link buttons found in the chat — the matcher is broken`);
  const short = tags.filter((t) => !/min-h-11/.test(t));
  assert.deepEqual(short, [], 'a chat link button is 40 px tall — add `extra: \'min-h-11\'`');
});
