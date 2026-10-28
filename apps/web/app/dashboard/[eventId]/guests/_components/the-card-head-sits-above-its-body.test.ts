/**
 * the-card-head-sits-above-its-body.test.ts — 🧱 THE GUEST CARD'S PINNED HEADER IS ALWAYS ABOVE ITS BODY (owner, live
 * iPhone 2026-10-26, one word: "Overlap"), and what the owner asked to live in it the same day.
 *
 * What he saw: the card scrolled a little, the ticket row sliding UNDER the sticky "GUEST · BRIDE'S SIDE / name / No reply"
 * header — but its Invite ▾ and ⋯ drawn ON TOP of it, across its hairline. The header was `z-index: 2`; Invite and ⋯ are
 * `relative z-20` (they lift over a phone row's stretched link). Same stacking context, 20 > 2. And the face peeked out
 * ABOVE the header: a sticky box sticks inside its scroller's padding, so it stuck 20px down with the body showing through.
 *
 * Held here:
 *   1. The header rule: sticky, the house sticky layer (`--sn-z-sticky`, not a hand-typed number), an opaque paper fill.
 *   2. The body under it is its OWN stacking context at the base layer (`isolation: isolate`), in both frames — so no
 *      z-index written inside the body, today's 20 or a later 999, can reach above the header. And base < sticky.
 *   3. Flush with the top: the sheet's sticky `top` gives back the sheet's own top padding, the rail's its 20px, and the
 *      panel inside the sheet never takes the `.sn-tile:hover` lift (a tap holds :hover; the lift slid the card 3px under).
 *   4. `InspectorColumn` draws the header BEFORE the body, the face (`lead`) at its LEFT, the pin slot before ✕, and every
 *      child inside the body — the only door from the body into the header is the pin slot.
 *   5. 👤 The face is in the header (owner: "Move profile photo beside the name on the top? Left side"): `GuestCard` hands
 *      `GuestCardAvatar` (photo, else initials) to `lead`, and the body draws it only where there is no header (the page).
 *   6. 📌 The pinned Invite (owner: "Let the invite … button pin to the top when it goes out of screen"): the SAME
 *      `GuestInviteCell` portals a compact copy into the slot only while its own Invite is scrolled up under the header —
 *      an IntersectionObserver decides (`isPinnedUnderHead`, executed below), never a scroll listener — and the copy opens
 *      the same sheet (`invite('head')`, anchored to it). It fades in, and not at all under reduced motion.
 *
 *   7. 📱 On a phone (< 480px) the pinned Invite is a 44px round button — send glyph + ▾, its word hidden, its NAME still
 *      "Invite …" — and the header's spacing tightens, so "Daniel Ramos" and "GUEST · GROOM'S SIDE" both fit at 390
 *      (coordinator review of #6937; measured with scrollWidth vs clientWidth in WebKit). The full pill from 480px up.
 *
 * NOT CLAIMED: the pixels — those are the before/after shots in the PR (`shots-2026-10-26/guest-card-overlap/`), measured
 * with elementFromPoint on the header's hairline (before: the body's Invite / ⋯; after: the header, at every point).
 *
 * SABOTAGE (each seen RED, then restored): the header back to `z-index: 2` · `isolation: isolate` dropped from the body ·
 * the body drawing the face again over the panel · the pinned copy drawn without `pin.pinned` · the phone rule's
 * `.lbl { display: none }` removed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { isPinnedUnderHead } from '@/app/_components/inspector/use-head-pin';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..', '..');
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const read = (rel: string) => stripComments(raw(rel));
const CSS = stripComments(raw('app/globals.css'));
const COLUMN = read('app/_components/inspector/inspector-column.tsx');
const PIN = read('app/_components/inspector/use-head-pin.ts');
const G = 'app/dashboard/[eventId]/guests/_components';
const CARD = read(`${G}/guest-card.tsx`);
const BODY = read(`${G}/guest-card-body.tsx`);
const CELL = read(`${G}/guest-invite-cell.tsx`);

/** The declarations of EVERY rule whose selector list is exactly `selector` (whitespace-insensitive), in file order. */
function rule(selector: string): string {
  const want = selector.replace(/\s+/g, ' ').trim();
  const re = /([^{}]+)\{([^{}]*)\}/g;
  const found: string[] = [];
  for (let m = re.exec(CSS); m; m = re.exec(CSS)) {
    if (m[1]!.replace(/\s+/g, ' ').trim() === want) found.push(m[2]!);
  }
  if (!found.length) assert.fail(`no CSS rule for \`${want}\` in globals.css — the card's header/body rules moved or were removed`);
  return found.join(';');
}
const decl = (body: string, prop: string) => new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(body)?.[1]?.trim() ?? null;
const token = (name: string) => Number(new RegExp(`${name}:\\s*(-?\\d+)\\s*;`).exec(CSS)?.[1]);

test('1 · the card header is sticky, on the house sticky layer, with an opaque paper fill', () => {
  const head = rule('.sn-inspector-shell--card .sn-inspector-head, .sn-inspector-sheet .sn-inspector-head');
  assert.equal(decl(head, 'position'), 'sticky');
  assert.equal(decl(head, 'z-index'), 'var(--sn-z-sticky)', 'the header must take the sticky layer token — it was a bare `2`, under the body’s z-20 controls');
  const bg = decl(head, 'background') ?? '';
  assert.match(bg, /^var\(--sn-paper\b/, 'the header lost its paper fill — the body would show through it');
  assert.doesNotMatch(bg, /transparent|rgba|\/\s*0?\.\d|color-mix/, 'the header fill must be opaque');
});

test('2 · the body under the header is its own stacking context at the base layer, in both frames', () => {
  const body = rule('.sn-inspector-shell--card .sn-inspector-body, .sn-inspector-sheet .sn-inspector-body');
  assert.equal(decl(body, 'isolation'), 'isolate', 'without isolation, any z-index inside the body (Invite / ⋯ are z-20) paints over the header');
  assert.equal(decl(body, 'position'), 'relative');
  assert.equal(decl(body, 'z-index'), 'var(--sn-z-base)');
  const base = token('--sn-z-base');
  const sticky = token('--sn-z-sticky');
  assert.ok(Number.isFinite(base) && Number.isFinite(sticky), 'the z-index tokens are not readable from :root');
  assert.ok(sticky > base, `--sn-z-sticky (${sticky}) must sit above --sn-z-base (${base})`);
});

test('3 · the header sits flush with the top edge — the scroller’s padding given back, no hover lift', () => {
  const sheet = rule('.sn-inspector-sheet');
  assert.match(sheet, /padding:\s*max\(1\.25rem, env\(safe-area-inset-top\)\)/, 'the sheet’s top padding changed — re-derive the header’s `top` below from it');
  const top = decl(rule('.sn-inspector-sheet .sn-inspector-head'), 'top');
  assert.equal(top, 'calc(env(safe-area-inset-top, 0px) - max(1.25rem, env(safe-area-inset-top, 0px)))');
  assert.match(CSS, /\.sn-inspector-shell--card \.sn-inspector-panel > \.sn-inspector-head \{\s*top:\s*-20px;/, 'the rail’s header must give back the panel’s 20px');
  const panel = rule('.sn-inspector-sheet .sn-inspector-panel');
  assert.equal(decl(panel, 'transform'), 'none', 'the panel inside the sheet must not take `.sn-tile:hover`’s lift');
});

test('4 · InspectorColumn: header first, the face at its left, the pin slot before ✕, every child inside the body', () => {
  const fn = COLUMN.slice(COLUMN.indexOf('export function InspectorColumn('));
  const head = fn.indexOf('<header');
  const headEnd = fn.indexOf('</header>');
  const body = fn.indexOf('className="sn-lens-swap sn-inspector-body"');
  assert.ok(head > 0 && headEnd > head && body > headEnd, 'the header must be drawn before the body, as a sibling');
  const header = fn.slice(head, headEnd);
  const lead = header.indexOf('data-inspector-lead');
  const text = header.indexOf('sn-inspector-title');
  const slot = header.indexOf('data-inspector-pin-slot');
  const close = header.indexOf('sn-inspector-close');
  assert.ok(lead > 0 && lead < text, 'the face (`lead`) must sit LEFT of the eyebrow · name · reply');
  assert.ok(slot > text && slot < close, 'the pin slot must sit after the name, before ✕');
  assert.match(fn.slice(body, fn.indexOf('</aside>')), /\{children\}/, 'the body must hold the children');
  assert.equal((fn.match(/\{children\}/g) ?? []).length, 1, 'children are drawn once — inside the body, never in the header');
});

test('5 · the face is in the header over the panel, and only on the page in the body', () => {
  assert.match(CARD, /lead=\{<GuestCardAvatar guest=\{guest\} photoDisplayUrl=\{photoDisplayUrl\} size="head" \/>\}/);
  assert.match(CARD, /\bpinSlot\b/, 'GuestCard must open the header’s pin slot');
  assert.match(BODY, /\{headerShown \? null : <GuestCardAvatar guest=\{guest\} photoDisplayUrl=\{photoDisplayUrl\} \/>\}/, 'over the panel the body must not draw the face a second time');
  assert.equal((BODY.match(/<GuestCardAvatar\b/g) ?? []).length, 1, 'the body draws the face in one place');
  const HEAD = read(`${G}/guest-card-head.tsx`);
  const av = HEAD.slice(HEAD.indexOf('export function GuestCardAvatar('));
  assert.match(av.slice(0, 1400), /photoDisplayUrl \?[\s\S]*<img src=\{photoDisplayUrl\}[\s\S]*guestInitials\(guest\)/, 'the face is their photo, else their initials');
  assert.match(av.slice(0, 1400), /size === 'head' \? 'h-11 w-11'/, 'the header’s face is 44px');
});

test('6a · pinned ⇔ scrolled up under the header (the one decision, executed)', () => {
  const root = { top: 80 };
  assert.equal(isPinnedUnderHead({ isIntersecting: true, boundingClientRect: { top: 60 }, rootBounds: root }), false, 'still partly visible → stays in the body');
  assert.equal(isPinnedUnderHead({ isIntersecting: false, boundingClientRect: { top: -20 }, rootBounds: root }), true, 'gone up under the header → pinned');
  assert.equal(isPinnedUnderHead({ isIntersecting: false, boundingClientRect: { top: 900 }, rootBounds: root }), false, 'below the fold → not pinned');
  assert.equal(isPinnedUnderHead({ isIntersecting: false, boundingClientRect: { top: -20 }, rootBounds: null }), false, 'nothing to measure against → not pinned');
});

test('6b · the pin is an IntersectionObserver under the header — no scroll listener, no scroll math', () => {
  assert.match(PIN, /new IntersectionObserver\(/);
  assert.match(PIN, /rootMargin: `-\$\{next\}px 0px 0px 0px`/, 'the root’s top must be pulled down to the header’s bottom');
  assert.match(PIN, /setPinned\(isPinnedUnderHead\(entry\)\)/, 'the observer must use the one decision');
  assert.doesNotMatch(PIN, /addEventListener\(\s*['"]scroll|scrollTop|onscroll/, 'the pin must not read the scroll position');
});

test('6c · the pinned Invite is the SAME cell’s button, drawn only while its own is out of view, opening the same sheet', () => {
  assert.match(CELL, /useHeadPin\(ref, layout === 'card'\)/, 'only the card’s Invite pins, observed on the body button itself');
  const portal = CELL.slice(CELL.indexOf('createPortal(') - 40, CELL.indexOf('pin.slot,') + 9);
  assert.match(portal, /^[\s\S]*\{pin\.pinned && pin\.slot\s*\?\s*createPortal\(/, 'the copy must be drawn ONLY while pinned');
  // 🎟 Since 2026-10-28 the card's send is the ONE Share (ticket row: Share · NFC · New QR) — the copy runs the same rowShare().
  assert.match(portal, /onClick=\{\(\) => void rowShare\('head'\)\}/, 'the copy must run the same rowShare()');
  assert.match(portal, /icon=\{Share\}/, 'the copy is the Share icon');
  assert.equal((CELL.match(/createPortal\(/g) ?? []).length, 1, 'one portal — the header copy');
  assert.match(CELL, /<Popover anchorRef=\{from === 'head' && pin\.pinned \? pinRef : ref\}/, 'the sheet opens under whichever Invite was pressed');
  const pin = rule('.sn-inspector-pin');
  assert.match(decl(pin, 'animation') ?? '', /^sn-pin-in /, 'it fades in');
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\) \{\s*\.sn-inspector-pin \{ animation: none; \}/, 'no fade under reduced motion');
  assert.equal(decl(rule('.sn-inspector-pin-slot:empty'), 'display'), 'none', 'an empty slot takes no room beside the name');
});

test('7 · on a phone the pinned Invite is a 44px round button (glyph + ▾), named in full — the full pill from 480px', () => {
  const m = /@media \(max-width: 479\.98px\) \{([\s\S]*?)\n\}/.exec(CSS);
  assert.ok(m, 'the phone rule for the pinned Invite is gone');
  const phone = m![1]!;
  assert.match(phone, /\.sn-inspector-pin \.ab \{ width: 44px; min-width: 44px; height: 44px; padding: 0; gap: 0; \}/, 'a 44px round button');
  assert.match(phone, /\.sn-inspector-pin \.ab \.lbl \{ display: none; \}/, 'the word is hidden on a phone');
  // (The ▾ rule stays in the CSS for any caret button; the pinned Share has none — it is one icon.)
  assert.match(phone, /\.sn-inspector-sheet \.sn-inspector-head \{ gap: 8px; \}/, 'the header’s spacing tightens on a phone');
  // The SAME button: it keeps its word for its name, and its caret.
  const portal = CELL.slice(CELL.indexOf('createPortal(') - 40, CELL.indexOf('pin.slot,') + 9);
  assert.match(portal, /name=\{shareName\}/, 'its name still says who it is for');
  assert.match(CELL, /const shareName = sentAt \? `Share \$\{guest\.fullName\}’s invitation — sent \$\{sentDay\}` : `Share \$\{guest\.fullName\}’s invitation`;/);
  assert.match(portal, /label="Share"/);
});
