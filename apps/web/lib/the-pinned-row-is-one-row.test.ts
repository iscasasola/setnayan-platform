/**
 * the-pinned-row-is-one-row.test.ts — 🔒 ON SCROLL, EACH MENU PINS ONE ROW, AND THE ROW KEEPS ITS SELECTOR.
 *
 * Owner 2026-10-27 (DECISION_LOG "PINNED ROWS ON SCROLL — ONE ROW PER MENU (Guests B · Home A · Suppliers A)" and
 * "PINNED ROWS KEEP THEIR SELECTORS — SIMPLIFIED"; verbatim "pinned approve", "On the pinned the selectors should stay
 * but simplified"; prototype `prototypes/guests_pinned_row_2026-10-27/`):
 *
 *   · GUESTS — the sticky block is ONE 44-px row. Its pinned face is `List · Map` (the shipped pill, small, words only —
 *     no Settings) · the three reply doors (the SAME `data-reply-filter` doors as the strip) · `Invite N ›` (the SAME
 *     `/guests/send` door). The Replies strip (%, bar, +1s, Excel, ⓘ) is OUT of the sticky block — it scrolls. The
 *     summary face lies over the full pill (absolute), so the block's in-flow height never changes.
 *   · GUESTS, AMENDED (owner 2026-10-27, "APPROVED — GUESTS CAROUSEL STYLE A": "Pinned row: List · Map · ✓ ✕ ? · ⚙
 *     (no Invite), pins once"): at rest the first row is NOT sticky — it scrolls away with the summary carousel under it;
 *     once the carousel has gone the block pins (fixed, in a holder that keeps its height). No Invite in the pinned row.
 *   · HOME — the cover band pins with a NEGATIVE top; stuck, one line `<names> · <date> · ⚙`. No selector; the ⚙
 *     (Event Settings) is its one control — ONE mount at the band's right end, drawn AT REST too (owner 2026-10-29,
 *     *"keep it there"*), the pinned line leaving it room.
 *
 * ⚙ EVERY PINNED ROW ENDS WITH ITS MENU'S ⚙ (owner 2026-10-27, "EVERY MENU'S ⚙ RIDES ITS PINNED ROW TOO" and "THE
 * PINNED ROW IS THE APP-WIDE TEMPLATE": selector or name line · counts · one action · ⚙). Guests' ⚙ is ONE mounted
 * button both faces show (the summary face stops short of it), so `every-menu-has-one-settings-button` still counts one.
 * Suppliers' ⚙ is the same mounted button at rest and pinned (the row IS the pinned row).
 *
 * Sabotage (2026-10-27, ⚙ ends, each reverted): Guests ⚙ moved before the pill · `data-has-gear` dropped · the face's
 * `right: 52px` → 0 · Home's ⚙ removed · a second control in Home's line · Suppliers ⚙ removed · a control after
 * Suppliers ⚙ — each red.
 *   · SUPPLIERS — only `Find · Build · Booked · ⚙` pins; the date · place line is plain content above it and scrolls away.
 *
 * Sabotage (2026-10-28, pins once — each reverted): `.stick.pinned` sticky again at rest on the List · an Invite link put
 * back in the summary face · the swap read off the pill instead of the carousel — each red.
 * Sabotage (2026-10-27, each reverted): the counts strip moved back inside `data-guests-stick` → Guests test red;
 * `pinSeg('share', 'Settings')` added to the pinned face → Guests test red; `pinSeg('map', …)` removed → red;
 * `{factsSlot}` moved back inside `data-suppliers-stick` → Suppliers test red; a `<button>` added to the Home pin → red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';
import { guestRow, renderGuestsScreen } from '@/app/dashboard/[eventId]/guests/_components/render-guests-screen';

const APP = join(process.cwd(), 'app', 'dashboard', '[eventId]');
const read = (...p: string[]) => stripComments(readFileSync(join(APP, ...p), 'utf8'));
const count = (s: string, needle: string | RegExp) =>
  typeof needle === 'string' ? s.split(needle).length - 1 : (s.match(needle) ?? []).length;

test('Guests — one row, pinned ONCE: the one menu · ✓ ✕ ? · ⚙, no Invite; the carousel scrolls; the block is not sticky at rest', async () => {
  const guests = [
    guestRow({ role: 'bride', rsvp_status: 'attending', custom_tags: [] } as never),
    guestRow({ role: 'groom', side: 'groom', rsvp_status: 'attending', custom_tags: [] } as never),
    ...Array.from({ length: 5 }, (_, i) => guestRow({ first_name: `Ask${i}`, invitation_sent_at: null, custom_tags: [] } as never)),
  ];
  const html = await renderGuestsScreen({ guests, setup: React.createElement('p', null, 'the sheet rows') });
  const at = html.indexOf('data-guests-stick=""');
  const stripAt = html.indexOf('data-roster-counts');
  assert.ok(at > -1 && stripAt > at, 'the pinned block or the summary carousel is gone');
  const stick = html.slice(at, stripAt);
  // The block sits in its holder (the holder keeps its height in the flow while the block is pinned).
  assert.ok(html.lastIndexOf('data-guests-stick-hold=""', at) > -1, 'the pinned block lost its holder — pinning would move the list');

  // ONE ROW: nothing of the carousel rides in the pinned block — and no Invite (it lives on the To invite card).
  for (const piece of ['data-replied-ring', 'data-plus-filter', 'gs-replied-pct', 'data-snap-carousel', 'data-requests-door', 'Excel']) {
    assert.equal(count(stick, piece), 0, `"${piece}" is pinned again — the pinned block is one row`);
  }
  assert.equal(count(stick, 'guests/send'), 0, 'Invite rides in the pinned row — the approved row is List · Map · ✓ ✕ ? · ⚙');
  assert.equal(count(stick, 'data-roster-to-invite'), 0, 'a to-invite door rides in the pinned row');

  // The summary face (🎚 owner 2026-10-29, v14: "pinned row = LEFT one menu, page + mode in one dropdown"): ONE menu
  // ("Guests · List ▾" — the shared PickMenu, no pill), the three reply doors, nothing else pressable; no Settings.
  const faceAt = stick.indexOf('data-guests-pin-face="summary"');
  const fullAt = stick.indexOf('data-guests-segmented=""', faceAt + 1);
  assert.ok(faceAt > -1 && fullAt > faceAt, 'the pinned summary face is gone (or drawn after the full pill)');
  const face = stick.slice(faceAt, stick.lastIndexOf('<nav', fullAt));
  assert.equal(count(face, 'data-guests-pin-menu=""'), 1, 'the pinned row is not ONE menu');
  assert.match(face, /data-guests-pin-menu=""[^>]*>[^]*?Guests · List/, 'the pinned menu does not say where you are ("Guests · List")');
  assert.equal(count(face, /<nav\b/g), 0, 'the pinned face draws a pill selector again — it is one dropdown');
  assert.doesNotMatch(face, />Settings<|data-guests-seg="share"/, 'Settings rides in the pinned row');
  const doors = [...face.matchAll(/data-reply-filter="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(doors, ['attending', 'declined', 'none'], 'the pinned row lost a reply door (or grew one)');
  assert.equal(count(face, /<(a|button)\b/g), 1 + doors.length, 'the pinned face holds a control besides its menu and ✓ ✕ ?');

  // The full pill — the top row (Guests ▾ · Seats ▾ · March, as the type offers; Settings became the ⚙, 27 Oct) — is
  // still the face at rest. This list offers List · Map only, so it is Guests alone.
  const fullEnd = stick.indexOf('</nav>', fullAt);
  const full = stick.slice(fullAt, fullEnd);
  assert.deepEqual([...full.matchAll(/data-guests-seg="(\w+)"/g)].map((m) => m[1]), ['guests']);

  // ⚙ THE ROW ENDS WITH ITS ⚙ — ONE mounted button that BOTH faces show: exactly one in the pinned block, not in the
  // summary face, right after the full pill's </nav> as the first row's last child, and nothing pressable after it.
  assert.equal(count(stick, 'data-menu-settings="guests"'), 1, 'the Guests pinned block does not hold exactly one ⚙');
  assert.equal(count(face, 'data-menu-settings'), 0, 'the summary face mounts its own ⚙ — two buttons for one door');
  const gearAt = stick.indexOf('data-menu-settings="guests"');
  assert.ok(gearAt > fullEnd, 'the ⚙ is not after the selector — the row does not end with it');
  const firstRow = stick.slice(stick.lastIndexOf('data-first-row', fullAt));
  const afterGear = firstRow.slice(firstRow.indexOf('data-menu-settings="guests"'));
  assert.ok(/^[^]*?<\/button><\/span><\/div>/.test(afterGear), 'something sits after the ⚙ in the first row');
  assert.equal(count(afterGear.slice(0, afterGear.search(/<\/button><\/span><\/div>/)), /<(a|button)\b/g), 1, 'the ⚙ is not the row\'s last control');
  assert.ok(stick.indexOf('data-has-gear') > -1, 'the pinned block does not say it holds a ⚙ — the summary face would cover it');

  // Same box: the face is laid OVER the pill's 44 px; the block pads 8 / 8.
  const css = readFileSync(join(APP, 'guests', '_components', 'guests-screen.module.css'), 'utf8');
  assert.match(css, /\.stick\.pinned \{\s*padding: 8px 0;/, 'the pinned block is not 8 + 44 + 8');
  assert.match(css, /\.face \{\s*position: absolute;[^}]*height: 44px;/, 'the summary face is not laid over the pill — the swap would move the list');
  assert.match(css, /\.stick\.pinned\[data-has-gear\] \.face \{\s*right: calc\(52px \+ var\(--gs-rounds-w, 0px\)\);/, 'the summary face covers the ⚙ (or the view’s rounds) when pinned');
  assert.match(css, /\.stick\.pinned\[data-collapsed\] \[data-first-row\] > \[data-guests-segmented\] \{\s*opacity: 0;/, 'pinned, the full pill no longer fades (or the whole first row — ⚙ included — does)');
  assert.doesNotMatch(css, /\[data-collapsed\][^{]*\[data-first-row\]\s*\{|\[data-collapsed\][^{]*\[data-menu-settings/, 'pinned, the ⚙ is faded out');

  // 📌 PINS ONCE (owner 2026-10-27: "the selector double pins. we want them to pin only the new way and not the first
  // pin it does"): on the List the block is NOT sticky at rest; it pins (fixed) only when collapsed, and its holder
  // keeps the block's height so nothing moves. The Map keeps its shipped sticky row.
  assert.match(css, /\.screen\[data-guests-screen='list'\] \.stick\.pinned \{\s*position: relative;/, 'the List’s first row is sticky at rest — it pins twice');
  assert.match(
    css,
    /\.screen\[data-guests-screen='list'\] \.stick\.pinned\[data-collapsed\] \{\s*position: fixed;\s*top: var\(--gs-top, 0px\);/,
    'scrolled past the carousel, the row does not pin under the bar',
  );
  assert.match(css, /\.stickHold \{\s*min-height: var\(--gs-stick-h/, 'the holder does not keep the pinned block’s height');
  // The swap is decided by the CAROUSEL's bottom edge — not the pill's: the row appears only once the carousel is gone.
  const screen = read('guests', '_components', 'guests-screen.tsx');
  assert.match(screen, /const on = strip\.getBoundingClientRect\(\)\.bottom <= bar \+ st\.offsetHeight \+ 2;/, 'the row pins on something other than the carousel leaving');
  assert.match(screen, /<div className=\{`\$\{styles\.summary\} \$\{styles\.rise\}`\} ref=\{stripRef\}/, 'the edge the row watches is not the carousel');
});

test('Suppliers — only Find · Build · Booked · ⚙ pins; the date · place line scrolls away above it', () => {
  const src = read('vendors', '_components', 'services-takeover.tsx');
  const at = src.indexOf('data-suppliers-stick=""');
  assert.ok(at > -1, 'the pinned row is gone');
  const open = src.lastIndexOf('<div', at);
  const close = src.indexOf('</ISegmented>', at);
  assert.ok(close > at, 'the pinned row lost its selector');
  const stick = src.slice(open, close);
  assert.match(stick, /className="[^"]*\bsticky\b/, 'the selector row is not sticky');
  assert.equal(count(stick, /<ISegmented\b/g), 1, 'the pinned row holds one selector');
  assert.match(stick, /SUPPLIERS_MODES\.map\(/, 'the pinned selector is not Find · Build · Booked');
  assert.equal(count(stick, '{factsSlot}'), 0, 'the date · place line is pinned again — two rows');
  const facts = src.indexOf('{factsSlot}');
  assert.ok(facts > -1 && facts < open, 'the date · place line must sit above the pinned row, as plain content');

  // ⚙ The row ENDS with Suppliers ⚙ (owner 2026-10-27, "SUPPLIERS GETS ITS ⚙" + "EVERY MENU'S ⚙ RIDES ITS PINNED ROW
  // TOO"): the row is the menu's first row, and after the selector comes its ONE ⚙ and nothing else before </div>.
  const rowEnd = src.indexOf('</div>', close);
  const tail = src.slice(close + '</ISegmented>'.length, rowEnd);
  assert.match(src.slice(open, at + 400), /data-first-row=""/, 'the pinned row is not marked as the menu’s first row');
  assert.equal(count(tail, /<MenuSettingsButton\b[^>]*\bmenu="suppliers"/g), 1, 'the pinned row does not end with Suppliers ⚙');
  assert.equal(count(tail, /<(?!\/|MenuSettingsButton\b)[A-Za-z]/g), 0, 'something besides the ⚙ is drawn after the selector');
});

test('Home — the cover pins as one line: names · date · ⚙, the ⚙ its one control, drawn at rest too', async () => {
  const band = read('_components', 'home-cover-band.tsx');
  assert.match(band, /\bsticky top-\[calc\(var\(--home-bar\)-var\(--home-band-h\)\+52px\)\]/, 'the cover band does not pin with a negative top');
  assert.match(band, /<HomeCoverPin name=\{cover\.name\} date=\{cover\.shortDate\} gear=\{gear\} \/>/);
  assert.match(read('_components', 'home-first-screen.tsx'), /<HomeCoverBand [^>]*settingsFor=\{eventSettings \? eventId : undefined\}/, 'the Home does not hand its band the ⚙');
  const pin = read('_components', 'home-cover-pin.tsx');
  assert.doesNotMatch(pin, /<button\b|<Link\b|<select\b|<nav\b|<a\b|ActionButton|MenuSettingsButton/, 'the Home pin grew a control — its ⚙ is the band’s one mount');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HomeCoverBand } = await import('@/app/dashboard/[eventId]/_components/home-cover-band');
  const html = renderToStaticMarkup(
    React.createElement(HomeCoverBand, { cover: { name: 'Cale & Ice', eyebrow: 'Wedding · 5 Dec 2026', shortDate: 'Dec 5' }, settingsFor: 'e1' }),
  );
  assert.match(html, /<span data-home-cover-pin=""[^>]*\bh-\[52px\]/, 'the pinned line is not one 52-px line');
  // <names> · <date>, then room for the ⚙ — the line itself holds no control.
  const line = /<span data-home-cover-pin="[^"]*"[^>]*>(.*?)<\/span><\/span>/.exec(html);
  assert.ok(line, 'no pinned line drawn');
  assert.match(line![1]!, /Cale &amp; Ice<\/span><span[^>]*>Dec 5$/, 'the pinned line is not <names> · <date>');
  assert.match(line![0], /^<span data-home-cover-pin=""[^>]*\bpr-\[54px\]/, 'the pinned line runs under the ⚙ — it leaves it no room');
  // ⚙ ONE control in the band, the LAST thing drawn (its right end), and NEVER hidden at rest (owner 2026-10-29).
  assert.equal(count(html, /<(a|button)\b/g), 1, 'the band holds another control besides its ⚙');
  assert.equal(count(html, /data-menu-settings="home"/g), 1, 'the band does not draw Home’s ⚙ exactly once');
  const gear = /<span data-home-settings-gear="" class="([^"]*)">(.*)<\/span><\/div>$/.exec(html);
  assert.ok(gear, 'Home’s ⚙ is not the band’s last element — it is not at the right end');
  assert.match(gear![1]!, /\babsolute\b[^"]*\bbottom-1\b[^"]*\bright-4\b/, 'the ⚙ is not on the pinned line’s spot (bottom 52 px, right end)');
  assert.doesNotMatch(gear![1]!, /\binvisible\b|\bhidden\b|opacity-0/, 'Home’s ⚙ is hidden at rest — the owner asked to keep it there');
  assert.match(gear![2]!, /<button[^>]*aria-label="Event settings"/, 'the ⚙ is not named "Event settings"');
  // The loading screen's band (no event to open) draws no ⚙ and leaves no room for one.
  const loading = renderToStaticMarkup(React.createElement(HomeCoverBand, { cover: { name: 'Cale & Ice', eyebrow: 'Wedding', shortDate: 'Dec 5' } }));
  assert.equal(count(loading, /<(a|button)\b/g), 0, 'the loading band draws a control');
  assert.doesNotMatch(loading, /pr-\[54px\]/, 'the loading band leaves room for a ⚙ it does not draw');
});

/*
 * 📌 THE SHARED PINNED ROW (owner 2026-10-28 — People first, "People and Groups approved"; part 2 mounts the SAME
 * component on Events, Memories and Discover). `app/_components/pinned-row/pinned-row.tsx` is the one row: picker ▾ ·
 * count doors · ONE action · ⚙. ONE LINE AT 390: the row is a 44-px box that never wraps — the doors are the part that
 * gives (they shrink and clip, never push the action or the ⚙ to a second line). The Playwright walk in
 * `/dev/people-lab` measures the same at 375 and 390 (the row's box is 44 px tall, its action and ⚙ on its line).
 *
 * Sabotage (2026-10-28, each reverted): the action's `iconOnly={tight}` removed → red; `flex-wrap: wrap` on `.pin` → red; `height: 44px` → `min-height` → red; the
 * doors' `min-width: 0` dropped → red; People drawing its own row instead of `<PinnedRow` → red.
 */
test('the shared pinned row is ONE line — 44 px, never wraps, the doors give way — and People wears it', () => {
  const css = readFileSync(join(process.cwd(), 'app', '_components', 'pinned-row', 'pinned-row.module.css'), 'utf8');
  const rule = (sel: string) => {
    const m = new RegExp(`(?:^|\\n)${sel.replace('.', '\\.')} \\{([^}]*)\\}`).exec(css);
    assert.ok(m, `${sel} is gone from the shared row's stylesheet`);
    return m[1]!;
  };
  const pin = rule('.pin');
  assert.match(pin, /\bheight: 44px;/, 'the pinned row is not a 44-px box');
  assert.doesNotMatch(pin, /min-height/, 'the pinned row may grow past 44 px');
  assert.match(pin, /flex-wrap: nowrap;/, 'the pinned row may wrap to a second line');
  assert.match(pin, /white-space: nowrap;/);
  const doors = rule('.pinDoors');
  assert.match(doors, /min-width: 0;/, 'the doors cannot shrink — they push the action and the ⚙ off the line');
  assert.match(doors, /overflow: hidden;/);
  assert.match(rule('.pinAct'), /flex: 0 0 auto;/, 'the action can be squeezed');
  assert.match(rule('.pinPick'), /flex: 0 0 auto;/, 'the picker can be squeezed');
  // 📏 The fit pass (measured 2026-10-28: at 375 "1 asking you" was cut to "1 asl" beside a worded Invite): when the
  // doors overflow, the action drops to its icon — before paint — and tries the word again once the row grows.
  const row = stripComments(readFileSync(join(process.cwd(), 'app', '_components', 'pinned-row', 'pinned-row.tsx'), 'utf8'));
  assert.match(row, /useLayoutEffect\(/, 'the fit pass does not run before paint');
  assert.match(row, /box\.scrollWidth > box\.clientWidth/, 'the fit pass does not measure the doors overflowing');
  assert.equal((row.match(/iconOnly=\{tight\}/g) ?? []).length, 2, 'the action does not drop to its icon when the doors overflow');
  const people = stripComments(readFileSync(join(process.cwd(), 'app', 'dashboard', '(account)', 'people', '_components', 'people-pinned-row.tsx'), 'utf8'));
  assert.match(people, /<PinnedRow\b/, 'People draws its own pinned row instead of the shared one');
  assert.doesNotMatch(people, /className=\{?[^>]*\bpin(Door|Act|Doors)\b/, 'People re-draws a piece of the shared row');
});
