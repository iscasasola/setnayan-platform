/**
 * ⬇ A PAGE WITH A FLOATING THUMB ROW LEAVES ROOM FOR IT — AND NO PAGE LOCK OUTLIVES ITS POP-UP.
 *
 * Owner 2026-10-25, live, the event's Suppliers page on his computer: *"the suppliers page does not scroll up anymore so
 * i can add more categories. what happened?"* — "Need something else? ＋ Add to your event" stayed under the floating
 * ⇕ · Search suppliers · ＋ row; *"we already used to have these both working"*.
 *
 * The breaking change: `a7a91422e2` (PR #6858, 2026-10-23) stretched the computer's row across the whole body column,
 * while the page's room for it was still a PER-PAGE, PHONE-ONLY number (`max-tab:pb-16` on Find's body) and the event
 * column reserves nothing from 701. The fix (`lib/thumb-room.ts`): every floating row publishes what it covers as
 * `--sn-thumb-room`, and every page column pads by `max(its dock clearance, --sn-thumb-room)` at every width.
 *
 *   1  the arithmetic — what a fixed, bottom-anchored row covers, plus the breath
 *   2  the ONE row component (and Build's bar, which is not one) publishes it — no host has to remember
 *   3  the event column reads it below AND from 701 (the width the owner was on)
 *   4  the account, launcher, Discover and supplier columns read it at both widths
 *   5  no per-page number for the row comes back (the thing that went stale)
 *   6  the Suppliers lab wears the real column's padding — its `pb-28` hid this from every walk
 *   7  the page lock: lock → unlock gives the body back exactly, nested pop-ups release on the LAST close
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { THUMB_ROOM_BREATH, THUMB_ROOM_VAR, thumbRoomPx } from '@/lib/thumb-room';

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const CSS = stripComments(read('app/globals.css'));

/** Every rule body whose selector list holds exactly `selector`, with its @media (if any) — the dock guard's reader. */
function rulesFor(selector: string): { media: string | null; body: string }[] {
  const out: { media: string | null; body: string }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS))) {
    const sels = m[1]!.split(',').map((x) => x.trim());
    if (!sels.includes(selector)) continue;
    const before = CSS.slice(0, m.index);
    let depth = 0;
    let media: string | null = null;
    for (let i = before.length - 1; i >= 0; i--) {
      const ch = before[i];
      if (ch === '}') depth++;
      else if (ch === '{') {
        if (depth === 0) {
          const head = before.slice(before.lastIndexOf('}', i) + 1, i).trim();
          if (head.startsWith('@media')) media = head;
          break;
        }
        depth--;
      }
    }
    out.push({ media, body: m[2]! });
  }
  return out;
}
const pbOf = (body: string) => /padding-bottom\s*:\s*([^;]+);/.exec(body)?.[1]?.trim() ?? '';

test('1 · a fixed row covers its host’s bottom offset plus itself and the host’s foot padding, plus the breath', () => {
  // Find on a computer: `tab:bottom-7` (28) + a 44-px row + the host's `py-2.5` foot (10) → 82 covered.
  assert.equal(thumbRoomPx({ cssBottom: 28, hostBottom: 772, rowTop: 718 }), 82 + THUMB_ROOM_BREATH);
  // On a phone the row stands on the dock (bottom = the dock's height), so the room counts the dock too.
  assert.equal(thumbRoomPx({ cssBottom: 64, hostBottom: 780, rowTop: 726 }), 118 + THUMB_ROOM_BREATH);
  // Mid-slide the transform moves host and row together — same room.
  assert.equal(thumbRoomPx({ cssBottom: 28, hostBottom: 772 + 90, rowTop: 718 + 90 }), 82 + THUMB_ROOM_BREATH);
  // Nothing covered → no room (never a negative padding).
  assert.equal(thumbRoomPx({ cssBottom: 0, hostBottom: 0, rowTop: 0 }), 0);
  assert.equal(THUMB_ROOM_VAR, '--sn-thumb-room');
});

test('2 · the one ThumbRow publishes its room itself, and so does Build’s bar (it is not a ThumbRow)', () => {
  const row = stripComments(read('components/thumb-row.tsx'));
  assert.match(row, /import \{ useThumbRoom \} from '@\/lib\/thumb-room';/);
  assert.match(row, /useThumbRoom\(rowRef\);/, 'ThumbRow no longer publishes its room — every floating row is back to a per-page number');
  assert.match(row, /<div ref=\{rowRef\}[^>]*data-thumb-row=\{name\}/, 'the measured element is not the row');
  const build = stripComments(read('app/dashboard/[eventId]/vendors/_components/build-body.tsx'));
  const bar = build.slice(build.indexOf('function BarButtons('));
  assert.match(bar, /useThumbRoom\(rowRef\);/, 'Build’s bar covers the page’s foot without leaving room for itself');
  const lib = stripComments(read('lib/thumb-room.ts'));
  assert.match(lib, /setProperty\(THUMB_ROOM_VAR,/, 'the room is never published');
  assert.match(lib, /removeProperty\(THUMB_ROOM_VAR\)/, 'a page with no row keeps the last page’s room');
  assert.match(lib, /new ResizeObserver\(/, 'measured once and never again');
});

test('3 · the event column pads by max(the dock, the row) below 701 — and by the row FROM 701, where the owner was', () => {
  const base = rulesFor('[data-shell-main]').filter((r) => r.media === null);
  assert.equal(base.length, 1);
  const pb = pbOf(base[0]!.body);
  assert.match(pb, /^max\(\s*calc\(var\(--sn-bottomdock-h,/, `the phone column no longer clears the dock first: ${pb}`);
  assert.match(pb, /,\s*var\(--sn-thumb-room,\s*0px\)\s*\)$/, `the phone column ignores the thumb row: ${pb}`);
  const docked = rulesFor('html.guests-subnav-docked [data-shell-main]').filter((r) => r.media === null);
  assert.equal(docked.length, 1);
  assert.match(pbOf(docked[0]!.body), /var\(--sn-thumb-room,\s*0px\)\s*\)$/, 'the docked Guests column ignores the thumb row');
  const wide = rulesFor('[data-shell-main]').filter((r) => /min-width:\s*701px/.test(r.media ?? ''));
  assert.equal(wide.length, 1);
  assert.equal(
    pbOf(wide[0]!.body),
    'var(--sn-thumb-room, 0px)',
    'from 701 the column reserves nothing — the row covers the last ~80 px of every page with a thumb row (the 2026-10-25 bug)',
  );
});

test('4 · the account, launcher, Discover and supplier columns pad by the row at both widths', () => {
  const cols: [string, RegExp][] = [
    ['app/dashboard/(account)/layout.tsx', /<main\s+className="([^"]+)"/],
    ['app/dashboard/(launcher)/layout.tsx', /<main\s+className="([^"]+)"/],
    ['app/vendor-dashboard/layout.tsx', /<div className="(pb-\[[^"]+)">\s*\{\/\* Live vendor deal/],
    ['app/_components/frontdoor/front-door.tsx', /\? '(sn-vt-page pb-\[[^']+)'/],
  ];
  for (const [file, re] of cols) {
    const cls = re.exec(read(file))?.[1] ?? '';
    assert.ok(cls, `${file}: the page column is gone`);
    const narrow = /(?:^|\s)pb-\[([^\]]+)\]/.exec(cls)?.[1] ?? '';
    assert.match(narrow, /^max\(.*,var\(--sn-thumb-room,0px\)\)$/, `${file}: the phone column ignores the thumb row: ${narrow}`);
    assert.match(cls, /(?:^|\s)(?:lg|tab):pb-\[var\(--sn-thumb-room,0px\)\]/, `${file}: the wide column ignores the thumb row`);
  }
});

test('5 · no page adds a number of its own for the row (it went stale the day the row changed width)', () => {
  const shell = stripComments(read('app/dashboard/[eventId]/vendors/_components/services-takeover.tsx'));
  const find = shell.slice(shell.indexOf('data-suppliers-body="find"'), shell.indexOf('data-suppliers-body="build"'));
  // The body's first box is where the room used to be added by hand (`max-tab:pb-16`).
  const first = /<div\b([^>]*)>/.exec(find.slice(find.indexOf('>') + 1))?.[1] ?? '';
  assert.doesNotMatch(first, /(?:^|[\s"])(?:[\w-]+:)*pb-/, `Find’s body pads for its row by hand again: <div${first}>`);
});

test('6 · the Suppliers lab wears the real event column’s padding, so a walk sees what the owner sees', () => {
  const real = /<div data-shell-main>\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)*<div className="([^"]+)">/.exec(read('app/dashboard/[eventId]/layout.tsx'))?.[1];
  const lab = /<div data-shell-main>\s*<div className="([^"]+)">/.exec(read('app/dev/suppliers-lab/lab-stage.tsx'))?.[1];
  assert.ok(real && lab);
  const pb = (c: string) => c.split(/\s+/).filter((t) => /^(?:\w+:)?pb-/.test(t)).join(' ');
  assert.equal(pb(lab!), pb(real!), 'the lab pads more than the real page — its old pb-28 hid this bug from every walk');
});

test('7 · the page lock gives the body back exactly, and only on the LAST pop-up’s close', async () => {
  const style: Record<string, string> = { position: 'relative', top: '', left: '', right: '', width: '', overflow: '', overscrollBehavior: '' };
  const htmlStyle: Record<string, string> = { overscrollBehavior: '' };
  const dataset: Record<string, string> = {};
  let scrolledTo: unknown = null;
  const g = globalThis as Record<string, unknown>;
  const saved = { document: g.document, window: g.window };
  g.document = { body: { style }, documentElement: { style: htmlStyle, dataset } };
  g.window = { scrollY: 640, scrollX: 0, scrollTo: (o: unknown) => (scrolledTo = o) };
  try {
    const { lockPageScroll, unlockPageScroll } = await import('@/lib/overlay-lock');
    lockPageScroll(); // a sheet
    lockPageScroll(); // a list inside it
    assert.equal(style.position, 'fixed');
    assert.equal(style.top, '-640px');
    unlockPageScroll(); // the list closes — the sheet is still up
    assert.equal(style.position, 'fixed', 'the page came loose under a still-open sheet');
    unlockPageScroll(); // the sheet closes
    assert.equal(style.position, 'relative', 'the page lock outlived its pop-up — the page cannot scroll');
    assert.equal(style.overflow, '');
    assert.equal(style.top, '');
    assert.equal('overlayLocked' in dataset, false);
    assert.deepEqual(scrolledTo, { top: 640, left: 0, behavior: 'instant' });
    unlockPageScroll(); // an extra close never drives the count below zero…
    lockPageScroll(); // …so the next pop-up still locks
    assert.equal(style.position, 'fixed');
    unlockPageScroll();
    assert.equal(style.position, 'relative');
  } finally {
    g.document = saved.document;
    g.window = saved.window;
  }
});
