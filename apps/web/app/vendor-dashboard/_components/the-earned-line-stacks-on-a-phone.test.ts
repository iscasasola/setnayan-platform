/**
 * 📱 THE EARNED LINE STACKS ON A PHONE — owner 2026-10-28, live shot of Today at 390 px (*"mobile view does not look
 * nice"*): the badge pill, "You earned SETNAYAN Verified ✓ — your tarp and card can show it", Save to print and Got it
 * shared ONE row, so the sentence was crushed into a 20–35-px column, 12–13 lines tall. Owner 2026-10-29: *"always
 * maximize the screen use"*.
 *
 * What is held (`badge-earned-line.tsx` + `newlyEarned` in `lib/shop-badges.ts`):
 *   1 · THE VISIBLE SENTENCE IS ONE SHORT LINE for EVERY badge it can announce — no "— your tarp…" tail, no em dash;
 *       the reason lives in `detail`, behind the ⓘ (title + one short line visible, the rest in the ⓘ).
 *   2 · BELOW 768 THE ACTIONS HAVE THEIR OWN ROW: the line's root is a block until `md:` (no bare flex/grid), and the
 *       actions are a SIBLING of the pill-and-sentence row — not inside it — so they can only sit under it.
 *   3 · Save to print and Got it are both in that actions row; the sentence is the ⓘ's label and `detail` its body.
 *
 * Measured on the lab (`/dev/supplier-lab?s=clear&earned=verified`), Chromium + WebKit, 375/390: the sentence is 1
 * line, 194 px wide (it was 20–35 px and 12–13 lines).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import type { ShopBadgeFacts } from '@/lib/shop-badges';

// `lib/spotlight-awards.ts` reaches a `server-only` module — stubbed, then imported dynamically.
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const SRC = stripComments(readFileSync(join(import.meta.dirname, 'badge-earned-line.tsx'), 'utf8'));
const base: ShopBadgeFacts = { verified: false, completedEvents: 0, trusted: null, inBusinessSinceYear: null, awards: [], nowYear: 2026 };

/** At 14 px the line beside the pill holds ~36 characters at 375 px; a longer one wraps UNDER the pill at full width. */
const SHORT = 40;

test('1 · every sentence the line can say is one short line — the reason is in the ⓘ', async () => {
  const { newlyEarned } = await import('@/lib/shop-badges');
  const { MILESTONE_THRESHOLDS } = await import('@/lib/service-card-record');
  const { AWARD_LABELS } = await import('@/lib/spotlight-awards');
  const cases: ShopBadgeFacts[] = [
    { ...base, verified: true },
    ...MILESTONE_THRESHOLDS.map((n) => ({ ...base, completedEvents: n })),
    ...Object.values(AWARD_LABELS).map((a) => ({ ...base, awards: [a] })),
  ];
  let seen = 0;
  for (const f of cases) {
    const n = newlyEarned(f, []);
    assert.ok(n, `anti-vacuity: nothing announced for ${JSON.stringify(f)}`);
    seen += 1;
    assert.ok(n.sentence.length <= SHORT, `"${n.sentence}" is ${n.sentence.length} chars — not one short line`);
    assert.doesNotMatch(n.sentence, /—|tarp|card/i, `"${n.sentence}" carries the detail again — it belongs in the ⓘ`);
    assert.ok(n.detail.trim().length > 0, 'the ⓘ has nothing to say');
  }
  assert.ok(seen >= 1 + MILESTONE_THRESHOLDS.length + 3, `anti-vacuity: only ${seen} badges checked`);
});

/** The opening tag that carries `attr`, and its className. */
function tagWith(attr: string): { at: number; cls: string } {
  const at = SRC.indexOf(attr);
  assert.ok(at > 0, `${attr} is gone from the earned line`);
  const open = SRC.lastIndexOf('<', at);
  const tag = SRC.slice(open, SRC.indexOf('>', at) + 1);
  const cls = /className="([^"]*)"/.exec(tag)?.[1];
  assert.ok(cls !== undefined, `${attr}: no static className to read`);
  return { at: open, cls };
}

test('2 · below 768 the actions sit on their own row, under the pill and the sentence', () => {
  const root = tagWith('data-badge-earned={');
  const bare = root.cls.split(/\s+/).filter((c) => /^(flex|inline-flex|grid|inline-grid|flex-row|flex-nowrap)$/.test(c));
  assert.deepEqual(bare, [], `the line's root is laid out as one row on a phone (${bare.join(' ')}) — the sentence gets squeezed`);
  assert.match(root.cls, /\bmd:flex\b/, 'from 768 the line no longer shares one row');

  const head = tagWith('data-badge-earned-head');
  const actions = tagWith('data-badge-earned-actions');
  assert.ok(head.at < actions.at, 'the actions come before the sentence');
  // A sibling, not a child: every <div opened from the head row up to the actions row is closed again.
  const between = SRC.slice(head.at, actions.at);
  const opened = (between.match(/<div\b/g) ?? []).length;
  const closed = (between.match(/<\/div>/g) ?? []).length;
  assert.equal(opened, closed, 'the actions are inside the sentence row — on a phone they would crush it again');
  assert.match(actions.cls, /\bjustify-end\b/, 'the actions row is no longer right-aligned');

  // 3 · both actions live in the actions row; the sentence is the ⓘ's label, the detail its body.
  const tail = SRC.slice(actions.at);
  assert.ok(tail.includes('data-badge-earned-save') && tail.includes('data-badge-earned-dismiss'), 'Save to print or Got it left the actions row');
  const headRow = SRC.slice(head.at, actions.at);
  assert.match(headRow, /<InfoTip\b[^>]*label=\{n\.sentence\}[^>]*>\s*\{n\.detail\}\s*<\/InfoTip>/, 'the sentence is not the ⓘ label with the detail behind it');
});
