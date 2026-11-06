/**
 * GUARD — Memories' sheets (+ Add photos above all) are drawn into <body>, so they sit over the event bar and inside
 * the screen at every width (owner 2026-10-25, live: *"adding photos on event memories is not fixed"* — the ADD PHOTOS
 * sheet's lower part ran behind the event bar and off the bottom of the screen; nothing under the drop zone could be
 * reached).
 *
 * 🔑 WHY IT HAPPENED. The event layout's `<main>` is `.sn-vt-page`, which carries a `view-transition-name`. That makes
 * it a STACKING CONTEXT and a CONTAINING BLOCK for `position: fixed` — so a `<Sheet>` (`fixed inset-0 z-50 h-[100dvh]`)
 * rendered inside the page is positioned against `<main>`, not the screen: it starts where `<main>` starts (under the
 * top bar) and runs a full screen-height from there, so its bottom lands below the screen; and its `z-50` only counts
 * inside the page, so the bar (`z-30`, outside the page) paints over it. The earlier fixes padded the sheet's body by
 * the dock's height (`pb-[calc(var(--sn-bottomdock-h)…)]`) — that moved the content up by the bar but not by the
 * top-bar offset, and from 701 it dropped to 16 px (`lg:pb-4`, and the couple tree's line is `tab:` not `lg:`). The
 * gallery's own thumb row was already portalled for exactly this reason ("the dashboard's page wrapper captures
 * `position: fixed`"); its sheet was not.
 *
 * ✅ THE FIX. Each of the gallery's three sheets renders through `OnBody` (a portal into `<body>`) — the same pattern as
 * `PapicBuySheet` and the iap sheets. At the root, the Sheet's `z-50` is above the dock's `z-30`, and `fixed` means
 * the screen.
 *
 * Every number is READ from its file; comments are stripped first (this fix's own notes quote the old classes).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const GALLERY = read('app/_components/memories/event-memories-gallery.tsx');
/** The ⚙ settings sheet moved into the shared menu door (2026-10-27, settings per menu) — same OnBody rule there. */
const MENU_DOOR = read('app/_components/menu-settings-button.tsx');
const SHEET = read('app/_components/sheet.tsx');
const NAV = read('app/_components/nav/bottom-nav.tsx');
const CSS = read('app/globals.css');

/** Each `<Sheet …>…</Sheet>` in the gallery, with the 200 characters before it (where its wrapper opens). */
function sheets(src: string): { before: string; body: string; title: string }[] {
  const out: { before: string; body: string; title: string }[] = [];
  const re = /<Sheet\b([\s\S]*?)<\/Sheet>/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const t = /\btitle=(?:"([^"]*)"|\{(\w+)\})/.exec(m[1]!.slice(0, 240));
    out.push({ before: src.slice(Math.max(0, m.index - 200), m.index), body: m[1]!, title: t?.[1] ?? t?.[2] ?? '?' });
  }
  return out;
}

test('the reason holds: the page is a containing block for `fixed` (it carries a view-transition-name)', () => {
  assert.match(
    /(?:^|\n)\.sn-vt-page\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '',
    /view-transition-name:\s*sn-page/,
    'the page no longer carries its transition name — re-check whether the portal is still needed (do not just delete this test)',
  );
});

test('OnBody is a real portal into <body>, not a pass-through', () => {
  for (const src of [GALLERY, MENU_DOOR]) {
    const fn = /function OnBody\([\s\S]*?\n\}/.exec(src)?.[0] ?? '';
    assert.ok(fn, 'OnBody is gone — the sheets are back inside the page');
    assert.match(fn, /setHost\(document\.body\)/, 'OnBody no longer targets document.body');
    assert.match(fn, /createPortal\(children, host\)/, 'OnBody no longer portals its children');
  }
});

test('🔒 every Sheet in the gallery — + Add photos first — is drawn through OnBody', () => {
  const all = sheets(GALLERY);
  const titles = all.map((s) => s.title);
  assert.ok(titles.includes('Add photos'), `the + Add photos sheet is gone from the gallery (found: ${titles.join(', ')})`);
  // (2026-10-30: the photo's own sheet became the shared viewer — `memories-photo-viewer.tsx` — whose Share · Tag ·
  //  confirm panels rise INSIDE the viewer, which stands above the bar at z-80; so Add photos is the gallery's sheet.)
  assert.ok(all.length >= 1, `expected the gallery's own sheet (Add photos), found ${all.length}`);
  // The ⚙ sheet is the shared menu door's now — the gallery mounts the door, the door draws the sheet.
  assert.match(GALLERY, /<MenuSettingsButton\b[^>]*menu="memories"/, 'the gallery no longer mounts the shared ⚙ door — where did its settings sheet go?');
  const door = sheets(MENU_DOOR);
  assert.equal(door.length, 1, 'the shared ⚙ door draws other than one sheet');
  for (const [src, list] of [[GALLERY, all], [MENU_DOOR, door]] as const) {
    for (const s of list) {
      assert.match(s.before, /<OnBody>\s*$/, `the "${s.title}" sheet is rendered inside the page — its bottom runs off the screen and under the bar`);
    }
    // …and every OnBody closes right after its Sheet (a wrapper left open around the page would portal the page).
    assert.equal((src.match(/<OnBody>/g) ?? []).length, list.length, 'an OnBody wraps something other than one Sheet');
    assert.equal((src.match(/<\/Sheet>\s*<\/OnBody>/g) ?? []).length, list.length, 'an OnBody does not close right after its Sheet');
  }
});

test('🔒 at the root the sheet is ABOVE the bar — read from the Sheet and the dock, both boundaries', () => {
  const sheetZ = [...SHEET.matchAll(/root:\s*'fixed inset-0 z-(\d+)\b/g)].map((m) => Number(m[1]));
  assert.equal(sheetZ.length, 2, 'the Sheet’s two root geometries (lg · tab) are no longer readable here');
  const dockZ = [...NAV.matchAll(/'fixed inset-x-0 bottom-0 z-(\d+) flex flex-col backdrop-blur (?:tab|lg):hidden'/g)].map((m) => Number(m[1]));
  assert.equal(dockZ.length, 2, 'the dock’s two classes (tab · lg) are no longer readable here');
  for (const s of sheetZ) for (const d of dockZ) assert.ok(s > d, `the Sheet (z ${s}) is not above the bar (z ${d})`);
  const rowZ = Number(/data-memories-thumb=""[\s\S]{0,400}?\bz-\[(\d+)\]/.exec(GALLERY)?.[1]);
  assert.ok(Number.isFinite(rowZ), 'the thumb row’s layer is no longer readable here');
  for (const s of sheetZ) assert.ok(s > rowZ, `the Sheet (z ${s}) is not above the thumb row (z ${rowZ})`);
});

test('no sheet body pads itself by the bar any more — a portalled sheet covers the bar; the pad was the old workaround', () => {
  for (const s of sheets(GALLERY)) {
    assert.doesNotMatch(s.body, /--sn-bottomdock-h/, `the "${s.title}" sheet still pads by the dock — dead space under its last control`);
  }
});
