/**
 * 🎁 THE GIFT BOX IS THE APPROVED ONE — J7 (owner 15 Nov "GIFT PAGE APPROVED" · "Gift box · APPROVED (confirmed)";
 * contract corpus prototypes/supplier_badges_2026-11-15/gift-box_APPROVED_2026-11-15.html; DECISION_LOG 2026-11-15
 * "THE GIFT HAS NO BUTTONS — A TAP MOVES ON" · "THE GIFT SITS ON ITS BADGE'S BACKGROUND …" · "ONE CLOSE BUTTON FOR
 * EVERY FULL SCREEN" · e5ec685d point 2).
 *
 *   1 · CLAIMING: a badge (or seal) reward is claimed AUTOMATICALLY — its card has NO Redeem and no claiming button;
 *       a couple's Redeem of a supplier's gift KEEPS its press, can be pressed only once while out, and a retry re-sends
 *       the SAME claim (the database key, `a-gift-is-claimed-once.db.test.ts`, makes it count once).
 *   2 · THE ✕: the one full-screen close — 44px round, top LEFT inside the safe area, dark glass, ivory ring, ivory focus
 *       ring — and the gift screen uses it, not a hand-drawn one.
 *   3 · A TAP MOVES ON: the surface opens the wrapped box and closes the open gift; the ✕ and the card's buttons are left
 *       to themselves; nothing says "Done" or "See your gift", and no "1 of 2" counter is drawn.
 *   4 · THE BOX: gold for Setnayan, terracotta for a supplier; the sender's mark on the wax (Setnayan's, or the shop's
 *       own logo, or its initials); the badge's background behind a badge's gift; sparks, not flying pieces.
 *   5 · MOTION + WEIGHT: every curve and length is a token; the art is loaded lazily; the ticket is passed in (the award
 *       kit's drawing), never re-drawn here.
 *
 * Sabotage (2026-11-15): `claimModeFor` answering 'press' for a badge reward turns 1 red; dropping the `inFlight` guard
 * from `press` turns 1 red; `left:` → `right:` in close-x.module.css turns 2 red; a `cubic-bezier(` in gift-box.module.css
 * turns 5 red; a static `import GiftMoment from './gift-moment'` in gift-moments.tsx turns 5 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { badgeRewardMomentView, shopGiftMomentView } from '@/lib/gift-moment';
import { claimModeFor, paperFor, stageFor, GIFT_WORDS } from './gift-moment-rules';
import { LID_END, LID_REST, SPARKS, TICKET_END, WAX_BLOB, boxKeyframes } from './gift-box-geometry';

const HERE = __dirname;
const src = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const popup = src('gift-moment.tsx');
const GLOBALS = readFileSync(join(HERE, '..', '..', 'globals.css'), 'utf8');

const shop = shopGiftMomentView(
  { ref: 'p1', giverName: 'Liwanag Lights & Bar', logoSrc: null, lines: [{ title: 'Papic 1000', kind: 'papic', credits: 1000 }], landedAt: 'a', claimedAt: null },
  'e1',
);
const verified = badgeRewardMomentView({ ref: 'r0', rewardKey: 'verified', badge: 'verified', rewardKind: 'papic', units: 1, landedAt: 'a', claimedAt: null });
const tier = badgeRewardMomentView({ ref: 'r1', rewardKey: 'events:50', badge: 'events', rewardKind: 'event_plus', units: 1, landedAt: 'a', claimedAt: null });

test('1 · 🚨 a badge reward is claimed by itself (no Redeem); a couple\'s Redeem keeps its press and counts once', () => {
  assert.equal(claimModeFor(verified), 'auto');
  assert.equal(claimModeFor(tier), 'auto');
  assert.equal(claimModeFor(shop), 'press', 'a couple\'s gift lost its Redeem press');

  // The auto branch of the card draws a status, never a button.
  const auto = popup.slice(popup.indexOf("mode === 'auto' ? ("), popup.indexOf(') : (', popup.indexOf("mode === 'auto' ? (")));
  assert.ok(auto.length > 0, 'the automatic-claim branch moved — re-aim this guard');
  assert.doesNotMatch(auto, /<button/, 'a badge reward grew a button');
  assert.doesNotMatch(auto, /Redeem|CLAIM_WORDS\.redeem/, 'a badge reward says Redeem');
  assert.match(auto, /role="status"/);

  // The automatic claim is sent once per showing (a ref guard), the press once while out (inFlight), a retry re-sends.
  assert.match(popup, /if \(mode !== 'auto' \|\| view\.claimedAt \|\| autoSent\.current\) return;/);
  assert.match(popup, /if \(inFlight\.current \|\| state === 'claimed'\) return;\s*inFlight\.current = true;/, 'a double tap could send two claims');
  assert.match(popup, /disabled=\{busy\}/, 'the pressed Redeem can be pressed again');
  assert.match(popup, /data-gift-retry=""/, 'no Try again on a lost connection');
  assert.match(popup, /CLAIM_WORDS\.pressed/, 'the press does not say "Claiming…"');

  // An automatic claim only clears the waiting line — it never navigates away or ends the queue.
  const host = src('gift-moments.tsx');
  assert.match(host, /if \(choiceId === 'auto'\) return;\s*setQueue\(\[\]\);/, 'an automatic claim navigates or stops the next gift');
});

test('2 · the ✕ is the one full-screen close: 44px round, top left, dark glass, ivory ring', () => {
  const css = readFileSync(join(HERE, 'close-x.module.css'), 'utf8');
  const x = css.slice(css.indexOf('.x {'), css.indexOf('}', css.indexOf('.x {')));
  assert.match(x, /width: 44px;/);
  assert.match(x, /height: 44px;/);
  assert.match(x, /border-radius: var\(--m-r-full\);/, 'not round');
  assert.match(x, /left: max\(12px, env\(safe-area-inset-left\)\);/, 'not top LEFT');
  assert.match(x, /top: max\(12px, env\(safe-area-inset-top\)\);/, 'not inside the safe area');
  assert.match(x, /right: auto;/);
  // Dark glass: the box's own umber token at 55% (the colour lives in globals.css as a token, never typed here).
  const glass = x.match(/background: color-mix\(in srgb, var\((--sn-gift-[a-z]+-\d+)\) 55%, transparent\);/);
  assert.ok(glass, 'not dark glass');
  assert.match(GLOBALS, new RegExp(`${glass![1]}: #140e08;`), 'the glass is not the approved dark umber');
  const ring = x.match(/border: 1px solid color-mix\(in srgb, var\((--sn-gift-[a-z]+-\d+)\) 35%, transparent\);/);
  assert.ok(ring, 'no ivory ring');
  assert.match(GLOBALS, new RegExp(`${ring![1]}: #fff0d7;`), 'the ring is not the approved ivory');
  const focus = css.match(/\.x:focus-visible \{\s*outline: 2px solid var\((--sn-gift-[a-z]+-\d+)\);/);
  assert.ok(focus, 'no ivory focus ring');
  assert.match(GLOBALS, new RegExp(`${focus![1]}: #f6e7c8;`), 'the focus ring is not the approved ivory');
  assert.match(popup, /<FullscreenClose onClose=\{onLater\} label=\{CLAIM_WORDS\.later\} \/>/, 'the gift screen does not use the one ✕');
  assert.doesNotMatch(popup, /<X aria-hidden/, 'the gift screen draws its own ✕ again');
});

test('3 · a tap moves on; no Done, no See your gift, no counter', () => {
  assert.match(popup, /onClick=\{onSurface\}/, 'the surface does not take the tap');
  assert.match(popup, /if \(phase === 'wrapped'\) \{\s*tap\(\);/, 'a tap anywhere does not open the box');
  assert.match(popup, /if \(phase === 'open' && cardUp && state !== 'pressed'\) onLater\(\);/, 'a tap on the open gift does not close it');
  assert.match(popup, /closest\('\[data-fullscreen-close\],\[data-gift-buttons\]'\)/, 'a tap on the ✕ or Redeem is read as "move on"');
  assert.doesNotMatch(popup, />\s*Done\s*</);
  // "Tap to close" is the words, not a button look — but a real <button>, so a keyboard and a screen reader can close it.
  assert.ok(
    popup.split('<button').slice(1).some((b) => b.slice(0, b.indexOf('</button>')).includes('data-gift-tapon="close"')),
    '"Tap to close" cannot be reached without a pointer',
  );
  assert.doesNotMatch(popup, /See your gift/);
  assert.doesNotMatch(popup, /\{counter\}|data-gift-counter/, 'the "1 of 2" counter is drawn again');
  assert.equal(GIFT_WORDS.tapToClose, 'Tap to close');
});

test('4 · the box: gold for Setnayan, terracotta for a supplier; the sender on the wax; the badge\'s background', () => {
  assert.equal(paperFor(verified.seal), 'setnayan');
  assert.equal(paperFor(shop.seal), 'supplier');
  assert.equal(paperFor({ kind: 'logo', src: 'x', initials: 'LL' }), 'supplier');
  const box = src('gift-box.tsx');
  assert.match(box, /seal\.kind === 'logo' \?[\s\S]*?<img src=\{seal\.src\}/, "a supplier's box is not pressed with its own logo");
  assert.match(box, /seal\.kind === 'setnayan' \?[\s\S]*?<SetnayanMark/, "Setnayan's box lost its mark");
  assert.equal(stageFor(verified), 'verified');
  assert.equal(stageFor(tier), 'tier');
  assert.equal(stageFor(shop), null, "a couple's gift sits on a badge's background");
  assert.equal(SPARKS.length, 14, 'the sparks are not the approved fourteen');
  assert.match(WAX_BLOB, /^M[\d. ]+ C.+Z$/);
  assert.notEqual(LID_REST, LID_END);
  assert.match(boxKeyframes(), /@keyframes gmb-lid\{0%\{transform:translate3d/);
  assert.match(boxKeyframes(), new RegExp(`100%\\{transform:${TICKET_END.replace(/[()]/g, '\\$&')}\\}`));
  assert.doesNotMatch(src('gift-art.tsx'), /SHARDS|WrappedGiftSvg|OpenedGiftSvg/, 'the old flat box or its flying pieces came back');
});

test('5 · motion is tokens only; the art is lazy; the ticket is passed in, never re-drawn here', () => {
  for (const f of readdirSync(HERE).filter((n) => n.endsWith('.css'))) {
    const css = stripComments(readFileSync(join(HERE, f), 'utf8'));
    assert.doesNotMatch(css, /cubic-bezier\(/, `${f}: a typed curve — use --sn-ease / --sn-ease-out / --sn-pill-spring / --sn-ease-rise`);
    for (const decl of css.match(/(?:animation|transition)[^;{}]*;/g) ?? []) {
      assert.doesNotMatch(decl, /(?<![\w.-])\d+(\.\d+)?m?s\b/, `${f}: a typed duration in "${decl.trim()}" — use a motion token`);
      assert.doesNotMatch(decl, /(?<![\w-])(ease|ease-in|ease-out|ease-in-out)(?![-\w])/, `${f}: a bare keyword curve in "${decl.trim()}"`);
    }
  }
  const host = src('gift-moments.tsx');
  assert.match(host, /dynamic\(\(\) => import\('\.\/gift-moment-shown'\)/, 'the popup (and the box art) must load lazily');
  assert.doesNotMatch(host, /from '\.\/gift-box'|from '\.\/gift-moment'|from '\.\/gift-moment-shown'|from '\.\/gift-ticket'|_components\/award/, 'the box art or the ticket art is imported into the first load');
  assert.match(popup, /ticket\?: GiftTicket \| null;/);
  for (const f of readdirSync(HERE).filter((n) => /\.(tsx?|css)$/.test(n) && !n.endsWith('.test.ts'))) {
    assert.doesNotMatch(src(f), /tkSvg|guilloche|TICKET_SPECS\s*=|function ticketSvg/, `${f} re-draws the reward ticket — it is the award kit's`);
    assert.doesNotMatch(src(f), /\bvendor\b/i, `${f} says "vendor"`);
  }
});

/* ── controller audit, 16 Nov ───────────────────────────────────────────────────────────────────────────────────── */

// Sabotage: drop `stage=` / `arrive=` from gift-moments.tsx, or `ticket=` from gift-moment-shown.tsx, or let a Papic
// pack map to the wrong ticket → red.
test('6 · the callers hand the box its ticket, its badge background and its drop-in (as drawn)', async () => {
  const host = src('gift-moments.tsx');
  assert.match(host, /stage=\{stageFor\(showing\.view\)\}/, 'the badge background is not passed');
  assert.match(host, /arrive=\{showing\.view\.source === 'badge_reward' && !showing\.startOpen\}/, 'the drop-in is not passed');
  assert.match(src('gift-moment-shown.tsx'), /<GiftMoment \{\.\.\.props\} ticket=\{giftTicketOf\(props\.view\)\} \/>/);
  assert.match(src('gift-ticket.ts'), /import \{ TICKET_SPECS, rimForTier, ticketDataUri \} from '@\/app\/_components\/award\/ticket-svg';/);
  // The ticket is the one the gift names — never typed.
  assert.deepEqual(shop.ticket, { kind: 'papic1000', tier: null });
  assert.deepEqual(tier.ticket?.kind, 'eplus');
  assert.equal(verified.ticket?.kind, 'papic150', 'Verified pays the smallest pack — the ladder\'s Papic 150');
  const gold = badgeRewardMomentView({ ref: 'r2', rewardKey: 'completed_bookings:tier3', badge: 'completed_bookings', rewardKind: 'papic', units: 1, landedAt: 'a', claimedAt: null });
  assert.deepEqual(gold.ticket, { kind: 'papic1000', tier: 3 }, 'Gold pays Papic 1000, framed in Gold');
  const fee = badgeRewardMomentView({ ref: 'r3', rewardKey: 'verified', badge: 'verified', rewardKind: 'fee_waiver', units: 1, landedAt: 'a', claimedAt: null });
  assert.equal(fee.ticket, null, 'a free booking fee has no ticket kind — it must not borrow one');
  const { giftTicketOf } = await import('./gift-ticket');
  const t = giftTicketOf(gold)!;
  assert.ok(t.src.startsWith('data:image/svg+xml'), 'the ticket is not the award kit\'s drawing');
  assert.equal(t.label, gold.detail);
  assert.equal(giftTicketOf(fee), null);
});

// Sabotage: put `{autoLine}` back as the auto branch's only line, or set 'claimed' before the answer → red.
test('7 · an automatic claim says ✓ only once it is confirmed; a failed one says so (never a success tick)', () => {
  const auto = popup.slice(popup.indexOf("mode === 'auto' ? ("), popup.indexOf(') : (\n              <>', popup.indexOf("mode === 'auto' ? (")));
  assert.match(auto, /^mode === 'auto' \? \(\s*claimed \? \(/, 'the tick is not gated on a confirmed claim');
  assert.match(auto, /state === 'offline' \? \([\s\S]*?\{CLAIM_WORDS\.offline\}/, 'a lost claim is not shown');
  assert.match(auto, /state === 'refused' \? \([\s\S]*?\{CLAIM_WORDS\.refused\}/, 'a refused claim is not shown');
  assert.match(auto, /\{CLAIM_WORDS\.pressed\}/, 'no neutral "Claiming…" while the claim is out');
  assert.equal((auto.match(/\{autoLine\}/g) ?? []).length, 1, 'the success line is drawn outside the confirmed branch');
  const effect = popup.slice(popup.indexOf("if (mode !== 'auto' || view.claimedAt || autoSent.current) return;"));
  assert.match(effect, /^[\s\S]{0,200}setState\('pressed'\);\s*void send\('auto'\)\.then\(\(next\) => \{\s*inFlight\.current = false;\s*setState\(next\);/, 'the auto claim does not record its real answer');
});

// Sabotage: type a hex back into gift-box.module.css, or delete a --sn-gift-* token (or its dark pair) from globals.css → red.
test('8 · the box\'s colours are tokens: no typed colour in its CSS, every --sn-gift-* it uses is defined, with its dark pair', () => {
  for (const f of ['gift-box.module.css', 'close-x.module.css']) {
    const css = stripComments(readFileSync(join(HERE, f), 'utf8'));
    assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/, `${f}: a typed colour — use a --sn-gift-* token`);
    for (const tok of new Set(css.match(/--sn-gift-[a-z]+(?:-\d+)?/g) ?? [])) {
      // Once at :root and once, unchanged, in its html.dark pair (art: the same in every theme).
      const values = [...GLOBALS.matchAll(new RegExp(`^\\s*${tok}: (#[0-9a-f]{6});`, 'gm'))].map((m) => m[1]);
      assert.equal(values.length, 2, `${tok} is not defined once at :root and once in its dark pair`);
      assert.equal(values[0], values[1], `${tok} changes in dark — the box is the same object in every theme`);
    }
  }
});
