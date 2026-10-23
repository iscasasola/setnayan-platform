/**
 * GUARD — MEMORIES JOINS THE EVENT BAR, AND HOME CARRIES ONE ⚙ SETTINGS (owner 2026-10-23, "Yes", on
 * `prototypes/event_bar_memories_tab_2026-10-23.html`, corpus 984518d7).
 *
 *   1. The fifth tab is Memories, after Hub, opening `/memories`, wearing the account bar's Memories glyph.
 *   2. The page is this event's photos on the shared edge-to-edge grid: no frame around it, the columns from the
 *      zoom (never a fixed count), the shipped lightbox on a tap, and a refused read said as one.
 *   3. Home's header carries ONE button — "Settings", the Event Details door — and Home grows no segmented tabs
 *      (the 23 Oct Papic prototype's Overview · Gallery · Settings pill is superseded).
 *   4. Papic's "See N photos" on Home opens the Memories tab.
 *   5. ONE STEP PER GESTURE (owner, trying the prototype: *"The pinch changes too fast"*): mid-gesture the grid only
 *      scales; the columns change only where a gesture ENDS, through the one threshold (`gestureStep`).
 *
 *   6. REVIEW (#6851): the count uses the grid's own filters (`countGalleryFrames`); ANY refused read is said as
 *      "couldn't load" (`status.refused`); a non-couple fails closed on the hidden-suppliers read (`viewerIsCouple`);
 *      ⌃-wheel is heard on the window; a frame with no compressed copy is a "Processing" tile, never blank.
 *
 * Sabotage (2026-10-23): the tab's href → `/galleries` (1 red); the grid's `gridTemplateColumns` → a fixed
 * `repeat(3, …)` (2 red); the cover's label → "Event Details" (3 red); the See-photos door → `?gallery=open` (4 red).
 * Each restored → green.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCustomerMenuTree, EVENT_MENU_ICONS } from '@/lib/customer-menu';
import { stripComments } from '@/lib/strip-comments';

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');
const code = (f: string) => stripComments(read(f));

const PAGE = 'app/dashboard/[eventId]/memories/page.tsx';
const GALLERY = 'app/_components/memories/event-memories-gallery.tsx';
const PINCH = 'app/_components/memories/use-grid-pinch.ts';
const COVER = 'app/dashboard/[eventId]/_components/home-cover-band.tsx';
const HOME = 'app/dashboard/[eventId]/_components/home-first-screen.tsx';
const ACCOUNT_BAR = 'app/dashboard/(launcher)/_components/account-bottom-nav.tsx';

test('1 · the fifth tab is Memories, after Hub, opening this event’s Memories, in the account bar’s glyph', () => {
  for (const phase of ['plan', 'dayof', 'after'] as const) {
    for (const storeShell of [false, true]) {
      const bar = buildCustomerMenuTree('ev', { phase, websiteEnabled: true, storeShell });
      assert.deepEqual(bar.map((m) => m.label), ['Home', 'Guests', 'Suppliers', 'Hub', 'Memories'], `${phase} · ${storeShell ? 'app' : 'web'}`);
      const mem = bar.at(-1)!;
      assert.equal(mem.href, '/dashboard/ev/memories');
      assert.ok((mem.activeMatch as string[]).includes('/dashboard/ev/memories'), 'the Memories page lights no tab');
    }
  }
  // The account bar's Memories glyph — read from that bar, never restated here.
  const account = code(ACCOUNT_BAR);
  const at = account.indexOf("label: 'Memories'");
  assert.ok(at > 0, 'premise: the account bar has a Memories tab');
  const icon = account.slice(at, at + 200).match(/icon:\s*(\w+)/)?.[1];
  assert.ok(icon, 'premise: the account bar’s Memories tab names its icon');
  const tab = buildCustomerMenuTree('ev', { websiteEnabled: true }).at(-1)!;
  assert.equal((tab.icon as { displayName?: string }).displayName ?? tab.icon.name, icon, 'the event bar’s Memories wears another glyph');
  assert.equal(EVENT_MENU_ICONS.memories, tab.icon);
});

test('2 · the page is the shared, frameless, zoomable grid — and a refused read is said', () => {
  const page = code(PAGE);
  assert.match(page, /<EventMemoriesGallery\b/, 'the page does not draw the shared Memories grid');
  assert.match(page, /memoriesUnreadable\(/, 'the page decides "empty" without the count beside it');
  assert.match(page, /readEventMemories\(/, 'the page does not read this event’s photos (every album, one read)');

  const g = code(GALLERY);
  // Columns from the zoom state — never a fixed number.
  // One wrapper carries the zoom as \`--mem-cols\`; every grid under it (moments, challenges) reads it.
  assert.match(g, /'--mem-cols' as string\]:\s*String\(cols\)/, 'the grid’s columns no longer follow the zoom');
  assert.match(g, /repeat\(var\(--mem-cols\),minmax\(0,1fr\)\)/, 'a grid does not read the zoom');
  assert.doesNotMatch(g, /grid-cols-\d/, 'a fixed column count crept in');
  // Edge to edge: the grid cancels the layout gutter, and nothing frames it.
  assert.match(g, /data-memories-grid=""[\s\S]{0,200}-mx-4[^"]*sm:-mx-6[^"]*lg:-mx-8/, 'the grid sits inside the gutter');
  assert.doesNotMatch(g, /\bsn-tile\b|\bsn-card\b|rounded-2xl[^"]*ring-/, 'the grid is inside a frame');
  // Pinch, the trackpad and the remembered zoom.
  assert.match(g, /useGridPinch\(/, 'the grid no longer answers a pinch');
  const pinch = code(PINCH);
  for (const ev of ["'touchstart'", "'touchmove'", "'touchend'", "'wheel'"]) assert.ok(pinch.includes(ev), `no ${ev} on the grid`);
  assert.match(g, /localStorage\.(getItem|setItem)/, 'the zoom is not remembered on the device');
  // The shipped lightbox, and the shared thumb row.
  assert.match(g, /<PapicLightbox\b/, 'a tap no longer opens the shipped lightbox');
  assert.match(g, /<ThumbRow\b/, 'the thumb row is not the shared one');
  assert.match(g, /couldn’t load/, 'a refused read has no words');
});

test('3 · Home’s header carries one Settings button — the Event Details door — and Home has no tabs', () => {
  const cover = code(COVER);
  const count = cover.match(/<ActionButton\b/g)?.length ?? 0;
  assert.equal(count, 1, `the cover carries ${count} buttons, not one`);
  const btn = cover.match(/<ActionButton\b[\s\S]*?className="home-cover-ab"\s*\/>/g) ?? [];
  assert.equal(btn.length, 1, 'premise: the cover button is drawn whole on one element');
  assert.match(btn[0]!, /href=\{`\/dashboard\/\$\{eventId\}\/details`\}/, 'the cover button is not the Event Details door');
  assert.match(btn[0]!, /label="Settings"/, 'the cover button does not say Settings');
  assert.match(btn[0]!, /icon=\{<Settings\b/, 'the cover button does not wear the gear');
  const home = code(HOME);
  assert.doesNotMatch(home, /['">]Overview['"<]/, 'Home grew an Overview tab — the 23 Oct ruling has Home with no tabs');
  assert.doesNotMatch(home, /role="tablist"/, 'Home grew a tab list');
});

test('4 · Papic’s See N photos on Home opens the Memories tab', () => {
  const home = code(HOME);
  const see = home.match(/<PapicSeePhotos\b[^>]*\/>/g) ?? [];
  assert.ok(see.length > 0, 'premise: Home draws a See photos door');
  for (const s of see) assert.match(s, /href=\{`\/dashboard\/\$\{eventId\}\/memories`\}/, `a See photos door goes elsewhere: ${s}`);
});

test('5 · one step per gesture — the columns change only where a gesture ends', () => {
  const pinch = code(PINCH);
  const body = (name: string) => {
    const at = pinch.indexOf(`const ${name} = `);
    assert.ok(at > 0, `premise: ${name} is in the hook`);
    const rest = pinch.slice(at + 1);
    // Each handler is an arrow at four spaces' depth; its body ends at the first closing brace at that depth.
    const end = rest.indexOf('\n    };');
    assert.ok(end > 0, `premise: ${name}'s body ends`);
    return rest.slice(0, end);
  };
  // While the fingers / the wheel move: a transform only — never a step.
  for (const moving of ['onMove', 'onWheel']) {
    const b = body(moving);
    assert.doesNotMatch(b, /\bcommit\(|\bsetCols\(|\bstepFrom\(/, `${moving} changes the columns mid-gesture`);
    assert.match(b, /\blive\(/, `${moving} does not scale the grid live`);
  }
  // Where a gesture ends: one verdict, one commit.
  for (const ending of ['onEnd', 'endWheel']) {
    const b = body(ending);
    assert.match(b, /gestureStep\(/, `${ending} does not ask the one threshold`);
    assert.equal(b.match(/\bcommit\(/g)?.length ?? 0, 1, `${ending} can step more than once`);
  }
  // The wheel's gesture is its run of events, not each event.
  assert.match(body('onWheel'), /WHEEL_GESTURE_GAP_MS/, 'a wheel event is treated as a whole gesture');
  // The snap honours reduced motion.
  assert.match(pinch, /prefers-reduced-motion: reduce/, 'the snap animates under reduced motion');
});

test('6 · the count matches the grid, a refused read is said, and a missing copy reads Processing', () => {
  const page = code(PAGE);
  assert.match(page, /countGalleryFrames\(supabase,\s*eventId\)/, 'the count is not the grid-filtered count');
  assert.doesNotMatch(page, /countPapicCaptures/, 'the count counts hidden or blocked frames the grid never draws');
  assert.match(page, /status\.refused\.length\s*>\s*0\s*\|\|/, 'a refused read can render as a smaller gallery');
  assert.match(page, /viewerIsCouple:\s*isCouple/, 'a non-couple viewer does not fail closed on the hidden-suppliers read');
  const lib = code('lib/papic-gallery.ts');
  assert.match(lib, /hiddenSuppliersFailClosed\s*\?\s*\[\]|hiddenSuppliersFailClosed \? \[\]/, 'a failed hidden-suppliers read still shows supplier shots');
  const lib2 = code('lib/papic-gallery.ts');
  assert.match(lib2, /\.neq\('moderation_state',\s*'nsfw_blocked'\)[\s\S]*\.is\('hidden_at',\s*null\)|\.is\('hidden_at',\s*null\)[\s\S]*\.neq\('moderation_state',\s*'nsfw_blocked'\)/);
  assert.match(code(PINCH), /window\.addEventListener\('wheel'/, '⌃-wheel is only heard over the tiles');
  assert.match(code(GALLERY), /data-tile-processing=""[\s\S]{0,200}Processing/, 'a frame with no compressed copy draws a blank square');
});
