/**
 * 📱 THE EVENT HUB'S FIRST ROW NEVER SITS UNDER THE IPHONE'S CLOCK (owner, live on the iPhone app 2026-10-30:
 * "event hub's first row in conflict with the iphone's signals row").
 *
 * The app runs `viewportFit: 'cover'` (app/layout.tsx), so y=0 is under the status bar and the Dynamic Island, and
 * nothing pads `<body>` — every bar clears the inset itself (the app's own top bar does, `.fd-topwrap`). The guest tree
 * (`/[slug]`) is not under that bar, so each of its top-pinned rows must carry the inset: the page's pinned band on
 * every stage that has one (Invitation · RSVP · The Day · Post Event) and its loading frame, the coordinator's
 * announcement (the layout mounts it above every page), the supplier's ribbon (the Save-the-Date phase's first row),
 * the story clock, and the guest camera's ✕ row (`/papic/guest`, full screen).
 *
 * The property, read from source (comments stripped): every one of those elements' className names
 * `env(safe-area-inset-top` — as its own top padding (a row in flow at the page top) or as its sticky `top`.
 *
 * And the sweep: no `sticky top-0` / `fixed top-0` element anywhere in the guest tree or the camera may appear
 * without the inset in the same className — a new top row fixes itself, it is not added to a list.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The className string (static or template) on the line carrying `anchor`, in `rel`. */
function classOf(rel: string, anchor: RegExp): string {
  const src = read(rel);
  const line = src.split('\n').find((l) => anchor.test(l));
  assert.ok(line, `${rel}: the element (${anchor}) was not found — the guard cannot see it; re-read this guard`);
  const m = line.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/);
  assert.ok(m, `${rel}: no className on the element's line — the guard cannot see it`);
  return m[1] ?? m[2] ?? '';
}

const INSET = /env\(safe-area-inset-top/;

const ROWS: Array<{ rel: string; anchor: RegExp; what: string }> = [
  { rel: 'app/[slug]/_components/invitation-shell.tsx', anchor: /<header data-sticky-top/, what: "the page's pinned band" },
  { rel: 'app/[slug]/_components/invitation-skeleton.tsx', anchor: /<header data-sticky-top/, what: "the loading frame's band" },
  { rel: 'app/[slug]/_components/day-of-announcement.tsx', anchor: /<div data-safe-x="" className=/, what: "the coordinator's announcement" },
  { rel: 'app/[slug]/_components/story/story-clock.tsx', anchor: /className="sticky top-\[/, what: 'the story clock' },
  { rel: 'app/papic/guest/_components/papic-guest-capture.tsx', anchor: /<header className=\{`flex items-center/, what: "the camera's ✕ row" },
];

for (const { rel, anchor, what } of ROWS) {
  test(`${what} clears the iPhone's status bar (${rel})`, () => {
    const cls = classOf(rel, anchor);
    assert.match(cls, INSET, `${what} is "${cls}" — on an iPhone its row draws under the clock and the Dynamic Island`);
  });
}

test("the supplier's ribbon clears the iPhone's status bar", () => {
  const src = read('app/[slug]/_components/supplier-ribbon.tsx');
  const m = src.match(/aria-label="Your booking"\s*className="([^"]*)"/);
  assert.ok(m, 'the ribbon was not found — the guard cannot see it');
  assert.match(m[1] ?? '', INSET, `the ribbon is "${m[1]}" — the Save-the-Date phase's first row sits under the clock`);
});

/** Files whose `top-0` row pins inside a box that never reaches the screen's top edge — each with why. */
const INSIDE_A_BOX = new Map<string, string>([
  [
    'app/[slug]/_components/rsvp-sheet.tsx',
    "the reply sheet's head pins to the top of the sheet, a bottom sheet capped at 78dvh — it never reaches the status bar",
  ],
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, out);
    else if (/\.tsx$/.test(e.name)) out.push(rel);
  }
  return out;
}

test('no sticky/fixed top-0 row in the guest tree or the camera leaves the inset out', () => {
  const files = [...walk('app/[slug]'), ...walk('app/papic/guest')];
  assert.ok(files.length > 50, `only ${files.length} files walked — the sweep is not looking at the guest tree`);
  const bad: string[] = [];
  let seen = 0;
  for (const rel of files) {
    for (const m of read(rel).matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const cls = m[1] ?? m[2] ?? '';
      if (!/\b(?:sticky|fixed)\b/.test(cls) || !/(?:^|\s)top-0(?:\s|$)/.test(cls)) continue;
      seen++;
      if (!INSET.test(cls) && !INSIDE_A_BOX.has(rel)) bad.push(`${relative(WEB, join(WEB, rel))}: "${cls}"`);
    }
  }
  assert.ok(seen >= 3, `only ${seen} top-0 rows seen — the sweep's pattern no longer matches the tree`);
  assert.deepEqual(bad, [], `a top-pinned row without env(safe-area-inset-top) — it draws under the iPhone's clock:\n${bad.join('\n')}`);
});
