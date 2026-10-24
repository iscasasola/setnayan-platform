/**
 * a-search-pins-its-first-result.test.ts — 📌 A BOTTOM SEARCH SHOWS ITS FIRST RESULT, AND THE PAGE MAKES ROOM FOR ITS BAND.
 *
 * Owner, 2026-10-24, live on Guests: *"When we search something on their respective search bars, it does not pin up to
 * the first search result … there is a result but I need to scroll up to find them."* · *"When the search bars peek
 * upward, it overlaps with the content under it and does not look smooth."* · and a no-match ("Jsjdbd") showed
 * "0 of 235 shown" over an empty strip: the "＋ Add “Jsjdbd” as a guest" button sat behind the band and the keyboard.
 *
 * Measured in the lab before the fix (WebKit 390 × 844, `/dev/guests-lab?part=screen&many=210`, a 300 px stand-in
 * keyboard, the list scrolled to its foot first): "Rosa" → the hit's row half under its sticky section head; "Jsjdbd"
 * → the Add button at 500–544 with the band's top at 446 (hidden). After: the hit's row whole under the head, the Add
 * button's foot at 436 (10 px over the band). The row rose in ONE jump (726 → 490 between two 40 ms samples); after, it
 * glides (534 · 505 · 496 · 491 · 490). Frames: `shots-2026-10-24/search-pin/`.
 *
 * ── What is proven ────────────────────────────────────────────────────────────────────────────────────────────────
 *   1 · THE ARITHMETIC (executed): a result's top lands just under the chrome; an Add row's foot lands just above the
 *       band, and a box taller than the strip shows its top; a pin waits for words and for the hand to be off the page.
 *   2 · THE PIN (executed, on a stand-in page): with no result, the Add row is what the pin brings up — above the band —
 *       and with a result, the result wins and sits under the chrome.
 *   3 · ONE MECHANISM (source): the one riding row (`useRidingRow`) mounts `useSearchPin` and pokes it on every input;
 *       ThumbRow hands its field seats that handler; every bottom search surface marks its results (or its add).
 *   4 · THE ROOM (source): while the band is up the page's foot gains the keyboard's height plus the band's, and it is
 *       given back when the band goes.
 *   5 · THE RISE (executed + source): a riding host glides on `transform` only, the keyboard's 250 ms ease-out, never
 *       on a pan, never under `prefers-reduced-motion`; the Maker's own band is not a rider.
 *   6 · THE FLOAT (source): the thumb row's seats wear the house float token and the band's plate its upward twin, each
 *       with a dark pair; the shared `.sn-glass-row` stays shadowless (Rule 7 is untouched).
 *
 * Sabotage (2026-10-24): `pinDelta`'s bottom edge returned `byTop` (1 + 2 red); `useRidingRow` lost its `pin.poke`
 * (3 red); the reserve rule removed from globals.css (4 red); the glide's `cause === 'scroll'` check dropped (5 red).
 * Each restored → green.
 *
 * ── Caveats ───────────────────────────────────────────────────────────────────────────────────────────────────────
 *   · No browser runs here; § 2 drives the real `pinFirstResult` over a stand-in DOM (rects are given, not laid out).
 *     The lab walk is WebKit with a stand-in keyboard, not a real iPhone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { PIN_GAP, PIN_IDLE_MS, PIN_HANDS_OFF_MS, PIN_ORDER, mayPin, pinDelta, pinFirstResult } from './search-pin';
import { RIDE_EASE, RIDE_MS, riseKeyframes } from './keyboard-ride';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('1 · the arithmetic: a result under the chrome, an Add row over the band, a pin only on still words', () => {
  const clear = { top: 290, bottom: 446 };
  // A result far below (the page kept its scroll) → scroll down so its top sits a gap under the chrome.
  assert.equal(pinDelta({ top: 900, bottom: 970 }, clear, 'top'), 900 - 290 - PIN_GAP);
  // A result above the screen (the list shrank under the reader) → scroll UP to it.
  assert.equal(pinDelta({ top: -400, bottom: -330 }, clear, 'top'), -400 - 290 - PIN_GAP);
  // The Add row behind the band (the owner's "Jsjdbd": 500–544 under a band at 446) → its foot a gap above the band.
  const by = pinDelta({ top: 500, bottom: 544 }, clear, 'bottom');
  assert.equal(544 - by, clear.bottom - PIN_GAP, 'the Add row is not brought above the band');
  // …and a box taller than the strip shows its top, never slides under the chrome.
  const tall = pinDelta({ top: 600, bottom: 1000 }, clear, 'bottom');
  assert.equal(600 - tall, clear.top + PIN_GAP);
  // The order a page's marks are looked for: a result, the results' box, then the add.
  assert.deepEqual(
    PIN_ORDER.map((o) => [o.selector, o.edge]),
    [
      ['[data-search-result]', 'top'],
      ['[data-search-results]', 'top'],
      ['[data-search-add]', 'bottom'],
      ['[data-search-none]', 'bottom'],
    ],
  );
  // Debounced: not on every key, and not so late the reader waits.
  assert.ok(PIN_IDLE_MS >= 100 && PIN_IDLE_MS <= 300, `the pin waits ${PIN_IDLE_MS} ms`);
  assert.equal(mayPin({ words: 'Rosa', now: 10_000, handAt: 0, touching: false }), true);
  assert.equal(mayPin({ words: '  ', now: 10_000, handAt: 0, touching: false }), false, 'an empty box pinned');
  assert.equal(mayPin({ words: 'Rosa', now: 10_000, handAt: 10_000 - PIN_HANDS_OFF_MS / 2, touching: false }), false, 'pinned while the reader scrolls');
  assert.equal(mayPin({ words: 'Rosa', now: 10_000, handAt: 0, touching: true }), false, 'pinned under a finger');
});

/* ── a stand-in page for § 2 ──────────────────────────────────────────────────────────────────────────────────── */
type Box = { sel: string[]; top: number; bottom: number; style?: Record<string, string> };
function standIn(boxes: Box[], vh = 844) {
  let scrollY = 0;
  const els = boxes.map((b) => ({
    b,
    parentElement: null,
    // A fixed box (the band) stays where it is; the page's boxes move with the scroll.
    getBoundingClientRect: () => {
      const y = b.style?.position === 'fixed' ? 0 : scrollY;
      return { top: b.top - y, bottom: b.bottom - y, height: b.bottom - b.top, width: 390, left: 0, right: 390 };
    },
    contains: (o: unknown) => o === undefined,
  }));
  const doc = {
    body: {},
    activeElement: null,
    documentElement: { style: { setProperty() {}, removeProperty() {} }, setAttribute() {}, removeAttribute() {} },
    querySelectorAll: (sel: string) => {
      const want = sel.split(',').map((s) => s.trim());
      return els.filter((e) => e.b.sel.some((s) => want.includes(s)));
    },
    elementsFromPoint: () => [],
  };
  const win = {
    innerHeight: vh,
    innerWidth: 390,
    get scrollY() {
      return scrollY;
    },
    visualViewport: { height: vh - 300, offsetTop: 0, scale: 1 },
    scrollBy: ({ top }: { top: number }) => {
      scrollY += top;
    },
  };
  Object.assign(globalThis, {
    window: win,
    document: doc,
    getComputedStyle: (el: { b?: Box }) => ({ position: 'static', overflowY: 'visible', visibility: 'visible', ...(el.b?.style ?? {}) }),
  });
  return { scrolled: () => scrollY, rect: (i: number) => els[i]!.getBoundingClientRect() };
}

test('2 · the pin: no result → the Add row stands above the band; a result → it sits at the top', () => {
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = { window: g.window, document: g.document, getComputedStyle: g.getComputedStyle };
  try {
    // The owner's no-match: the Add row (500–544) under the band (446) and the keyboard (544).
    const none = standIn([
      { sel: ['[data-search-none]'], top: 500, bottom: 544 },
      { sel: ['[data-ride-band]'], top: 446, bottom: 544, style: { position: 'fixed' } },
    ]);
    pinFirstResult();
    const add = none.rect(0);
    assert.ok(add.bottom <= 446, `the Add row's foot is at ${add.bottom}, under the band's top 446`);
    assert.equal(add.bottom, 446 - PIN_GAP);

    // A hit deep in the page wins over the Add row, and lands at the top of the strip.
    const hit = standIn([
      { sel: ['[data-search-add]'], top: 2100, bottom: 2144 },
      { sel: ['[data-search-result]'], top: 1800, bottom: 1870 },
      { sel: ['[data-ride-band]'], top: 446, bottom: 544, style: { position: 'fixed' } },
    ]);
    pinFirstResult();
    assert.equal(hit.rect(1).top, PIN_GAP, 'the first result is not pinned to the top');
  } finally {
    Object.assign(globalThis, saved);
  }
});

test('2b · a section head that will stick over the first hit: the hit lands under its foot, stuck yet or not', () => {
  // Owner 2026-10-25, live: *"Search is still not showing the first search result properly"* — the first "Buanhog"
  // sat under the sticky "VIP · 2" head. The head was in the flow above its row, so the hit-test saw nothing stuck,
  // the row went to the top, the head then stuck over it.
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = { window: g.window, document: g.document, getComputedStyle: g.getComputedStyle };
  try {
    let scrollY = 0;
    type El = { top: number; bottom: number; style: Record<string, string>; sel: string[]; parentElement: El | null; children: El[] };
    const mk = (top: number, bottom: number, style: Record<string, string> = {}, sel: string[] = []): El => ({
      top, bottom, style, sel, parentElement: null, children: [],
    });
    const body = mk(0, 0);
    const screen = mk(0, 3000);
    const stick = mk(0, 200, { position: 'sticky', top: '0px' }); // List · Map · Setup, counts, meter
    const sec = mk(600, 760);
    const head = mk(600, 660, { position: 'sticky', top: '200px' }); // "VIP · 2"
    const row = mk(660, 760, {}, ['[data-search-result]']); // the first hit
    const link = (p: El, kids: El[]) => {
      p.children = kids;
      for (const k of kids) k.parentElement = p;
    };
    link(body, [screen]);
    link(screen, [stick, sec]);
    link(sec, [head, row]);
    const rect = (e: El) => {
      // A sticky box rests at its `top` once the page has scrolled past it.
      const stuckAt = e.style.position === 'sticky' ? parseFloat(e.style.top ?? '') : -Infinity;
      const top = Math.max(e.top - scrollY, stuckAt);
      return { top, bottom: top + (e.bottom - e.top), height: e.bottom - e.top, width: 390, left: 0, right: 390 };
    };
    const all = [screen, stick, sec, head, row];
    for (const e of all) Object.assign(e, { getBoundingClientRect: () => rect(e), contains: (o: unknown) => o === e });
    Object.assign(globalThis, {
      window: {
        innerHeight: 844,
        innerWidth: 390,
        get scrollY() {
          return scrollY;
        },
        visualViewport: { height: 544, offsetTop: 0, scale: 1 },
        scrollBy: ({ top }: { top: number }) => {
          scrollY += top;
        },
      },
      document: {
        body,
        activeElement: null,
        documentElement: { style: { setProperty() {}, removeProperty() {} }, setAttribute() {}, removeAttribute() {} },
        querySelectorAll: (sel: string) => {
          const want = sel.split(',').map((x) => x.trim());
          return all.filter((e) => e.sel.some((x) => want.includes(x)));
        },
        elementsFromPoint: () => [],
      },
      getComputedStyle: (e: El) => ({ position: 'static', overflowY: 'visible', visibility: 'visible', top: 'auto', ...e.style }),
    });
    pinFirstResult();
    const r = rect(row);
    const h = rect(head);
    assert.ok(r.top >= h.bottom, `the first hit's top ${r.top} is under the section head, whose foot is ${h.bottom}`);
    assert.equal(r.top, 260 + PIN_GAP, 'the first hit does not sit a gap under the section head');
  } finally {
    Object.assign(globalThis, saved);
  }
});

test('3 · one mechanism: the riding row pins on every input, ThumbRow hands it its field, every surface marks', () => {
  const band = read('app/_components/typing-band.tsx');
  assert.match(band, /const pin = useSearchPin\(rowRef\);/, 'the one riding row does not mount the pin');
  assert.match(band, /pin\.poke\(t\.value\)/, 'an input does not poke the pin');
  assert.match(band, /rowProps: \{[^}]*\bonInput\b[^}]*\}/, 'the riding row does not hand out its input handler');
  const row = read('components/thumb-row.tsx');
  assert.match(row, /const onFieldInput = ride\.rowProps\.onInput;/);
  assert.equal((row.match(/onInput=\{onFieldInput\}/g) ?? []).length, 2, 'both field seats (input and node) must pin');
  // Every bottom search surface marks where its results draw — or its add when nothing matches.
  const MARKS: Array<[string, RegExp]> = [
    ['app/dashboard/[eventId]/guests/_components/guests-screen.tsx', /data-plus-one-of=\{plusWords\?\.hostId\}\s+data-search-result=""/],
    ['app/dashboard/[eventId]/guests/_components/guests-screen.tsx', /data-fit-acts="" data-search-none=""/],
    ['app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx', /data-search-result=\{searching \? '' : undefined\}/],
    ['components/search-add-row.tsx', /data-search-add=""/],
    ['app/_components/memories/event-memories-gallery.tsx', /data-memories-grid=""[\s\S]{0,400}?data-search-results=""/],
    ['app/dashboard/(account)/people/_components/people-roster-view.tsx', /data-people-search="" data-search-results=""/],
    ['app/_components/frontdoor/front-door.tsx', /data-discover-results="" data-search-results=""/],
    ['app/dashboard/[eventId]/budget/_components/budget-screen.tsx', /data-budget-list=""[^>]*data-search-results=""/],
    ['app/(shell)/explore/page.tsx', /grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-search-results=""/],
  ];
  for (const [f, re] of MARKS) assert.match(read(f), re, `${f}: its search results are not marked for the pin`);
});

test('4 · the room: while the band is up the page ends above it, and gets its foot back after', () => {
  const css = read('app/globals.css');
  assert.match(
    css,
    /html\[data-ride-reserve\] body \{ padding-bottom: calc\(var\(--sn-keyboard-h, 0px\) \+ var\(--sn-ride-band-h, 0px\)\); \}/,
    'the page does not make room for the keyboard and the band',
  );
  const band = read('app/_components/typing-band.tsx');
  // Written while riding (from the band's top over the row down to the host's foot), removed with the band.
  assert.match(band, /root\.style\.setProperty\('--sn-ride-band-h', `\$\{Math\.max\(0, Math\.round\(foot - \(r\.top - above\)\)\)\}px`\);/);
  assert.match(band, /root\.setAttribute\('data-ride-reserve', ''\);/);
  assert.match(band, /root\.removeAttribute\('data-ride-reserve'\);\s*root\.style\.removeProperty\('--sn-ride-band-h'\);/, 'the room outlives the band');
  assert.match(band, /if \(!riding\) return setOver\(null\);/, 'the room is made without the band being up');
});

test('5 · the rise: transform only, the keyboard’s timing, still on a pan and under reduced motion', () => {
  assert.equal(RIDE_MS, 250);
  assert.match(RIDE_EASE, /^cubic-bezier\(0\.2, 0\.8, 0\.2, 1\)$/, 'not an ease-out');
  const kf = riseKeyframes(236);
  assert.deepEqual(kf, [{ transform: 'translateY(236px)' }, { transform: 'translateY(0px)' }]);
  for (const k of kf) assert.deepEqual(Object.keys(k), ['transform'], 'the glide animates something other than transform');
  const kb = read('lib/keyboard-ride.ts');
  assert.match(kb, /publish\(snapshot\);\s*glide\(cause\);/, 'the glide does not follow the published move');
  assert.match(kb, /const still = cause === 'scroll' \|\| reducedMotion\(\);/, 'a pan or reduced motion glides');
  assert.match(kb, /\(prefers-reduced-motion: reduce\)/);
  assert.match(kb, /el\.animate\(riseKeyframes\(moved \+ residual\), \{ duration: RIDE_MS, easing: RIDE_EASE, composite: 'add' \}\)/);
  assert.match(read('app/_components/typing-band.tsx'), /return layer \? rideSmoothly\(layer\) : undefined;/, 'the riding row’s host does not glide');
  // The Maker's own band (in flow / fixed) is not a rider: only `useRidingRow` registers one.
  const riders = raw('app/_components/typing-band.tsx').match(/rideSmoothly\(layer\)/g)?.length ?? 0;
  assert.equal(riders, 1, 'something but the one riding row registers a glide in typing-band.tsx');
});

test('6 · the float: the thumb row’s seats and the band’s plate wear the house tokens, light and dark', () => {
  const css = read('components/thumb-row.module.css');
  assert.match(css, /\.row\[data-thumb-row\] > :global\(\.sn-glass-row\) \{ -webkit-mask-image: none; mask-image: none; box-shadow: var\(--sn-sh-float\); \}/);
  assert.match(css, /\.row\[data-thumb-row\] > \.round:global\(\.sn-glass-row\) \{ box-shadow: inset 0 0 0 1px var\(--sn-glass-line\), var\(--sn-sh-float\); \}/);
  assert.match(css, /\.row\[data-thumb-row\] > \[data-thumb-seat='action'\] \{ box-shadow: var\(--sn-sh-float\); \}/);
  assert.match(read('app/_components/typing-band.tsx'), /bg-\[var\(--tb-plate\)\] shadow-\[var\(--sn-sh-rise\)\]/, 'the band’s plate does not float');
  const g = read('app/globals.css');
  assert.equal((g.match(/--sn-sh-float:/g) ?? []).length, 2, 'the float token lost its light/dark pair');
  assert.equal((g.match(/--sn-sh-rise:/g) ?? []).length, 2, 'the rise token has no light/dark pair');
});
