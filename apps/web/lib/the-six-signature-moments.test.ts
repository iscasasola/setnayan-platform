/**
 * the-six-signature-moments.test.ts — 🕯 THE SIX SIGNATURE MOMENTS (motion standard 18 Nov 2026, § 9; owner, verbatim:
 * *"Ghost + all six"*; un-parked 19 Nov: *"animations build the rest"*). Visual contract: prototype
 * `motion_standard_2026-11-18_fable.html` Part I.
 *
 * ONE GUARD PER MOMENT, and each holds the same three things about its own moment:
 *   a · TRANSFORM AND OPACITY ONLY — every `sn-sig-<moment>-*` keyframe names no other property; every animation that
 *       plays one is gated on `[data-sig-play]`, reads tokens only (no raw time, no curve), fills `backwards` (never
 *       `both` / `forwards`), never loops, and no keyframe carries a `var()` timing;
 *   b · A REDUCED-MOTION STILL — each animated part of the moment is switched off by name inside a
 *       `prefers-reduced-motion: reduce` block, and the still the prototype asks for is stated there;
 *   c · ONCE ONLY — the rule in `lib/signature-moments.ts` plays the first time and never again, never plays without
 *       storage or with storage that throws, and the shipped part asks that rule through `useMoment` (once per mount).
 * A seventh test holds what they share: the stylesheet is loaded, the one stagger is one number in both copies, every
 * moment hangs on its shipped screen, and no moment adds a server write.
 *
 * Seen RED once each (2026-11-19), then restored — the table is in `changelog.d/claude-motion-signature.md`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { MOTION_TABLE } from '@/lib/motion-table';
import {
  FOIL_ARM,
  SIGNATURE_MOMENTS,
  SIGNATURE_RULES,
  armFoil,
  capizPlays,
  claimOnce,
  dayTurns,
  foilPlays,
  goLiveKind,
  replyArrives,
  tieFromList,
  tiePlays,
  type MomentStore,
  type SignatureMoment,
} from '@/lib/signature-moments';

const WEB = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const css = read('app/signature-moments.css');

/* ── a device's storage, and the two ways it can be missing ───────────────────────────────────────────────────── */
function store(): MomentStore & { size(): number } {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), size: () => m.size };
}
const THROWS: MomentStore = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};
/** Reads fine, silently keeps nothing (a full or read-only store). */
const FORGETS: MomentStore = { getItem: () => null, setItem: () => undefined };

/* ── reading the stylesheet ────────────────────────────────────────────────────────────────────────────────────── */
type Block = { head: string; body: string };
/** Top-level blocks of `src` (braces counted). */
function blocks(src: string): Block[] {
  const out: Block[] = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open < 0) break;
    let depth = 1;
    let j = open + 1;
    for (; j < src.length && depth > 0; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') depth--;
    }
    out.push({ head: src.slice(i, open).trim(), body: src.slice(open + 1, j - 1) });
    i = j;
  }
  return out;
}
const TOP = blocks(css);
const KEYFRAMES = TOP.filter((b) => b.head.startsWith('@keyframes')).map((b) => ({ name: b.head.replace('@keyframes', '').trim(), body: b.body }));
const RULES = TOP.filter((b) => !b.head.startsWith('@'));
const REDUCED = TOP.filter((b) => /^@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(b.head)).flatMap((b) => blocks(b.body));
const RAW_TIME = /(?<![\w.$-])(?:\d+(?:\.\d+)?|\.\d+)(?:ms|s)(?![\w-])/;

/** a + b for one moment: what moves, how, and what it is under reduced motion. Returns the animated part classes. */
function holdsTheMotionRules(m: SignatureMoment, still: Array<{ part: string; decl: RegExp; why: string }> = []): string[] {
  const frames = KEYFRAMES.filter((k) => k.name.startsWith(`sn-sig-${m}-`));
  assert.ok(frames.length > 0, `${m}: no sn-sig-${m}-* keyframes — the moment has no motion to guard`);
  for (const k of frames) {
    const props = [...k.body.matchAll(/([a-z-]+)\s*:/g)].map((x) => x[1]!);
    assert.ok(props.length > 0, `${k.name}: an empty keyframe`);
    const other = [...new Set(props.filter((p) => p !== 'transform' && p !== 'opacity'))];
    assert.deepEqual(other, [], `${k.name} animates ${other.join(', ')} — a signature moment moves by transform and opacity only`);
    assert.ok(!/var\(/.test(k.body), `${k.name} carries var() inside the keyframe (§ 3.7: Chrome then runs it linear)`);
  }
  const names = new Set(frames.map((k) => k.name));
  const moving = RULES.filter((r) => /(?<![\w-])animation\s*:/.test(r.body) && r.head.includes(`.sn-sig-${m}`));
  assert.ok(moving.length > 0, `${m}: nothing plays its keyframes`);
  const parts: string[] = [];
  const played = new Set<string>();
  for (const r of moving) {
    assert.match(r.head, new RegExp(`^\\.sn-sig-${m}\\[data-sig-play\\]`), `${r.head}: plays without [data-sig-play] — it would replay on every render`);
    const value = /(?<![\w-])animation\s*:\s*([^;]+);/.exec(r.body)![1]!.trim();
    const name = value.split(/\s+/)[0]!;
    assert.ok(names.has(name), `${r.head} plays ${name}, which is not one of ${m}'s own keyframes`);
    played.add(name);
    assert.match(value, /\sbackwards$/, `${r.head}: fill is not backwards ("${value}")`);
    assert.ok(!/\b(both|forwards|infinite|alternate)\b/.test(value), `${r.head}: "${value}" holds or loops`);
    assert.ok(!RAW_TIME.test(value) && !/cubic-bezier\(|linear\(/.test(value), `${r.head}: a raw time or curve in "${value}" — read the --sn-m-* tokens`);
    const timings = value.match(/var\(--sn-m-[a-z-]+\)/g) ?? [];
    assert.ok(timings.length >= 2, `${r.head}: "${value}" does not read a speed and an easing token`);
    parts.push(r.head.split(/\s+/).pop()!);
  }
  assert.deepEqual([...names].filter((n) => !played.has(n)), [], `${m}: a keyframe nothing plays`);
  // b · the still.
  for (const part of parts) {
    const off = REDUCED.find((r) => r.head.split(',').some((s) => s.trim().startsWith(`.sn-sig-${m}[data-sig-play]`) && s.trim().endsWith(part)) && /animation\s*:\s*none/.test(r.body));
    assert.ok(off, `${m}: ${part} has no reduced-motion rule that switches its animation off`);
  }
  for (const s of still) {
    const rule = REDUCED.find((r) => r.head.split(',').some((h) => h.trim().endsWith(s.part)) && s.decl.test(r.body));
    assert.ok(rule, `${m}: the reduced-motion still is missing — ${s.why}`);
  }
  assert.ok(SIGNATURE_RULES[m].reduced.length > 0 && SIGNATURE_RULES[m].once.length > 0);
  return parts;
}

/** c · the shipped part asks its rule through `useMoment`, and never reaches for storage or a timer by itself. */
function partAsksOnce(file: string, rule: string) {
  const src = read(`app/_components/signature/${file}`);
  assert.match(src, new RegExp(`useMoment(?:<[^>]+>)?\\(\\(\\) => \\(?${rule}\\(`), `${file} does not ask ${rule} through useMoment`);
  assert.ok(!/localStorage|sessionStorage|setTimeout|setInterval|fetch\(/.test(src), `${file} reaches for storage, a timer or the network itself`);
}

const NOON_BEFORE = new Date(2026, 10, 19, 9, 0, 0);
const DAY = '2026-11-19';

test('① The Tie — transform/opacity only · thread and seal at once when reduced · once per booking', () => {
  const parts = holdsTheMotionRules('tie');
  assert.deepEqual(parts.sort(), ['.sn-sig-tie-ring', '.sn-sig-tie-seal', '.sn-sig-tie-thread', '.sn-sig-tie-word']);
  // The rest state IS the finished picture: nothing hides the thread or the seal outside the animation.
  const rest = (cls: string) => RULES.filter((r) => r.head.split(',').some((h) => h.trim() === cls)).map((r) => r.body).join(';');
  assert.ok(!/opacity\s*:\s*0|scaleX\(0\)/.test(rest('.sn-sig-tie-thread') + rest('.sn-sig-tie-seal') + rest('.sn-sig-tie-word')), 'the thread, seal or word is hidden at rest — reduced motion would show nothing');

  const local = store();
  assert.equal(tiePlays(local, 'b1'), true);
  assert.equal(tiePlays(local, 'b1'), false, 'The Tie played twice for one booking');
  assert.equal(tiePlays(local, 'b2'), true, 'a second booking did not get its own tie');
  assert.equal(tiePlays(null, 'b3'), false);
  assert.equal(tiePlays(THROWS, 'b3'), false);
  assert.equal(tiePlays(FORGETS, 'b3'), false, 'a mark that did not stick still played — it would replay forever');
  // The couple's list: the first look is only remembered; later, ONE new booking ties and all are marked.
  const phone = store();
  assert.equal(tieFromList(phone, 'ev', ['a', 'b']), null, 'old bookings were tied on the first look at the list');
  assert.equal(tieFromList(phone, 'ev', ['a', 'b']), null);
  assert.equal(tieFromList(phone, 'ev', ['a', 'b', 'c', 'd']), 'c');
  assert.equal(tieFromList(phone, 'ev', ['a', 'b', 'c', 'd']), null, 'the list tied again on the next open');
  assert.equal(tieFromList(THROWS, 'ev', ['a']), null);
  partAsksOnce('the-tie.tsx', 'tiePlays');
  assert.match(read('app/_components/signature/the-tie.tsx'), /useMoment\(\(\) => tieFromList\(/);
});

test('② Foil glint — transform/opacity only · no glint when reduced · created once, the morning once', () => {
  const parts = holdsTheMotionRules('foil', [{ part: '.sn-sig-foil-light', decl: /opacity\s*:\s*0/, why: 'no glint: the light stays invisible' }]);
  assert.deepEqual(parts, ['.sn-sig-foil-light']);
  const light = RULES.find((r) => r.head === '.sn-sig-foil-light')!;
  assert.match(light.body, /opacity\s*:\s*0/, 'the light is visible at rest — the monogram would wear a stripe');

  const local = store();
  const session = store();
  const later = { eventDate: '2027-02-14', now: NOON_BEFORE };
  assert.equal(foilPlays(local, session, 'old', later), null, 'an event glinted with no create-event visit');
  armFoil(session);
  assert.equal(foilPlays(local, session, 'old', later), null, 'an event this device already knew glinted as "created"');
  assert.equal(foilPlays(local, session, 'new', later), 'created');
  assert.equal(session.getItem(FOIL_ARM), '0', 'the create mark was not spent');
  assert.equal(foilPlays(local, session, 'new', later), null, 'created glinted twice');
  assert.equal(foilPlays(local, session, 'newer', later), null, 'one create-event visit glinted two events');
  // The morning of the day: before noon, on the day, once.
  const morning = { eventDate: `${DAY}T00:00:00+08:00`, now: NOON_BEFORE };
  assert.equal(foilPlays(local, session, 'new', morning), 'morning');
  assert.equal(foilPlays(local, session, 'new', morning), null, 'the morning glinted twice');
  assert.equal(foilPlays(store(), store(), 'x', { eventDate: DAY, now: new Date(2026, 10, 19, 14, 0, 0) }), null, 'it glinted in the afternoon');
  assert.equal(foilPlays(store(), store(), 'x', { eventDate: '2026-11-20', now: NOON_BEFORE }), null, 'it glinted on another day');
  assert.equal(foilPlays(null, null, 'x', morning), null);
  assert.equal(foilPlays(THROWS, THROWS, 'x', morning), null);
  partAsksOnce('foil-glint.tsx', 'foilPlays');
  assert.match(read('app/_components/signature/foil-glint.tsx'), /\{play \? <i className="sn-sig-foil-light"/, 'the light is in the page when nothing plays');
});

test('③ Go live — transform/opacity only · only the chip when reduced · the whole moment on first publish only', () => {
  const parts = holdsTheMotionRules('live', [
    { part: '.sn-sig-live-card', decl: /transform\s*:\s*none/, why: 'no lift' },
    { part: '.sn-sig-live-glow', decl: /opacity\s*:\s*0/, why: 'no glow' },
  ]);
  assert.deepEqual([...new Set(parts)].sort(), ['.sn-sig-live-card', '.sn-sig-live-chip', '.sn-sig-live-dim', '.sn-sig-live-glow']);
  // A re-publish moves the chip and nothing else.
  const chipOnly = RULES.filter((r) => r.head.includes("[data-sig-kind='chip']") && /animation\s*:/.test(r.body)).map((r) => r.head.split(/\s+/).pop());
  assert.deepEqual(chipOnly, ['.sn-sig-live-chip'], 'a re-publish plays more than the chip');

  const local = store();
  assert.equal(goLiveKind(local, 'ev'), 'first');
  assert.equal(goLiveKind(local, 'ev'), 'chip', 'the whole Go live played on a re-publish');
  assert.equal(goLiveKind(local, 'other'), 'first');
  assert.equal(goLiveKind(null, 'ev'), 'chip');
  assert.equal(goLiveKind(THROWS, 'ev'), 'chip');
  assert.equal(goLiveKind(FORGETS, 'ev'), 'chip');
  partAsksOnce('go-live.tsx', 'goLiveKind');
});

test('④ Reply arrives — transform/opacity only · envelope shut when reduced · once per visit', () => {
  const parts = holdsTheMotionRules('reply', [
    { part: '.sn-sig-reply-flap', decl: /transform\s*:\s*none/, why: 'the envelope stays shut' },
    { part: '.sn-sig-reply-note', decl: /opacity\s*:\s*0/, why: 'no note rises out of a shut envelope' },
  ]);
  assert.deepEqual(parts.sort(), ['.sn-sig-reply-flap', '.sn-sig-reply-new', '.sn-sig-reply-note', '.sn-sig-reply-old']);

  const local = store();
  const visit = store();
  assert.equal(replyArrives(local, visit, 'ev', 86), null, 'a first look played as if replies had arrived');
  assert.equal(replyArrives(local, visit, 'ev', 86), null, 'no new reply, and it played');
  assert.deepEqual(replyArrives(local, visit, 'ev', 89), { from: 86 }, 'three new replies did not play once, from the count last seen');
  assert.equal(replyArrives(local, visit, 'ev', 90), null, 'it played twice in one visit');
  assert.deepEqual(replyArrives(local, store(), 'ev', 91), { from: 90 }, 'the next visit did not start from the number last seen');
  assert.equal(replyArrives(local, store(), 'ev', 80), null, 'a count that fell played');
  assert.equal(replyArrives(null, null, 'ev', 5), null);
  assert.equal(replyArrives(THROWS, THROWS, 'ev', 5), null);
  const noVisit = store();
  replyArrives(noVisit, null, 'ev', 1);
  assert.equal(replyArrives(noVisit, null, 'ev', 2), null, 'with no session storage it would play on every render');
  partAsksOnce('reply-arrives.tsx', 'replyArrives');
  assert.match(read('app/_components/signature/reply-arrives.tsx'), /if \(!news\) return <>\{children\}<\/>;/, 'with no news it draws more than the shipped figure');
});

test('⑤ Day turns — transform/opacity only · the number at once when reduced · once a day', () => {
  const parts = holdsTheMotionRules('day');
  assert.deepEqual(parts.sort(), ['.sn-sig-day-new', '.sn-sig-day-old']);
  const old = RULES.find((r) => r.head === '.sn-sig-day-old')!;
  assert.match(old.body, /opacity\s*:\s*0/, 'yesterday’s number is visible at rest — reduced motion would show two numbers');

  const local = store();
  const d1 = new Date(2026, 10, 19, 8, 0, 0);
  const d1late = new Date(2026, 10, 19, 22, 0, 0);
  const d2 = new Date(2026, 10, 20, 7, 0, 0);
  assert.equal(dayTurns(local, 'ev', 12, d1), null, 'a first look turned the page');
  assert.equal(dayTurns(local, 'ev', 12, d1late), null, 'it turned twice in one day');
  assert.deepEqual(dayTurns(local, 'ev', 11, d2), { from: 12 });
  assert.equal(dayTurns(local, 'ev', 11, d2), null, 'it turned twice in one day');
  assert.equal(dayTurns(local, 'ev', null, new Date(2026, 10, 21)), null, 'a countdown that is a word turned');
  assert.equal(dayTurns(null, 'ev', 5, d2), null);
  assert.equal(dayTurns(THROWS, 'ev', 5, d2), null);
  assert.equal(dayTurns(FORGETS, 'ev', 5, d2), null);
  partAsksOnce('day-turns.tsx', 'dayTurns');
  assert.match(read('app/_components/signature/day-turns.tsx'), /if \(!turn \|\| days === null\) return <>\{children\}<\/>;/, 'on an ordinary open it draws more than the shipped figure');
});

test('⑥ Capiz light — opacity only · a still window when reduced · once, when the plan unlocks', () => {
  const parts = holdsTheMotionRules('capiz', [{ part: '.sn-sig-capiz-pane', decl: /opacity\s*:\s*0?\.3/, why: 'a still window, no light' }]);
  assert.deepEqual(parts, ['.sn-sig-capiz-pane']);
  const pane = RULES.find((r) => r.head.endsWith('[data-sig-play] .sn-sig-capiz-pane'))!;
  assert.match(pane.body, /calc\(var\(--sn-m-sig-step\) \* var\(--sn-sig-i, 0\)\)/, 'the panes are not one token step apart');

  const local = store();
  assert.equal(capizPlays(local, 'event:1', null), false);
  assert.equal(capizPlays(local, 'event:1', 'pro'), true);
  assert.equal(capizPlays(local, 'event:1', 'pro'), false, 'the light crossed twice for one unlock');
  assert.equal(capizPlays(local, 'event:1', 'ultra'), true, 'a higher plan did not get its own light');
  assert.equal(capizPlays(local, 'event:1', null), false, 'a plan that ended played');
  assert.equal(capizPlays(store(), 'shop:9', 'pro'), false, 'a plan already on, first seen on a new device, played as an unlock');
  assert.equal(capizPlays(store(), 'shop:9', 'pro', true), true, 'the page was told the plan just went on, and nothing played');
  assert.equal(capizPlays(null, 'shop:9', 'pro', true), false);
  assert.equal(capizPlays(THROWS, 'shop:9', 'pro', true), false);
  assert.equal(capizPlays(FORGETS, 'shop:9', 'pro', true), false);
  partAsksOnce('capiz-light.tsx', 'capizPlays');
  assert.match(read('app/_components/signature/capiz-light.tsx'), /if \(!play\) return null;/, 'the window is drawn when nothing unlocked');
});

test('what the six share — loaded once, one stagger, each on its shipped screen, no server write', () => {
  assert.deepEqual([...SIGNATURE_MOMENTS], ['tie', 'foil', 'live', 'reply', 'day', 'capiz']);
  assert.equal(KEYFRAMES.filter((k) => !SIGNATURE_MOMENTS.some((m) => k.name.startsWith(`sn-sig-${m}-`))).length, 0, 'a keyframe in signature-moments.css belongs to no moment — no guard reads it');
  assert.match(read('app/layout.tsx'), /import '\.\/signature-moments\.css';/);
  const token = /--sn-m-sig-step:\s*(\d+)ms;/.exec(read('app/globals.css'));
  assert.equal(Number(token?.[1]), MOTION_TABLE.sigPaneStepMs, '--sn-m-sig-step and MOTION_TABLE.sigPaneStepMs disagree');
  // claimOnce is the one "once": first true, then never.
  const s = store();
  assert.deepEqual([claimOnce(s, 'k'), claimOnce(s, 'k'), claimOnce(null, 'k'), claimOnce(THROWS, 'k')], [true, false, false, false]);
  // Each moment hangs on its shipped screen.
  const mounts: Array<[string, RegExp]> = [
    ['app/dashboard/[eventId]/vendors/_components/booked-body.tsx', /<BookedTie eventId=\{eventId\}/],
    ['app/dashboard/[eventId]/vendors/_components/booked-tie.tsx', /<TheTieForList /],
    ['app/vendor-dashboard/clients/[eventId]/page.tsx', /search\.lock_agree === 'ok' && lockNotice\?\.tone === 'ok' \? \([\s\S]{0,200}<TheTie\b/],
    ['app/dashboard/[eventId]/_components/event-rail-context.tsx', /<FoilGlint eventId=\{eventId\}[^>]*>\s*<EventMonogram /],
    ['app/dashboard/(account)/create-event/page.tsx', /<FoilArm \/>/],
    ['app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx', /outcome\.kind === 'live' \? <MakerGoLive /],
    ['app/dashboard/[eventId]/_components/home-control-row.tsx', /<ReplyArrives eventId=\{.+?\} coming=\{g\.coming\}><Count value=\{g\.coming\}/],
    ['app/dashboard/[eventId]/_components/home-tile.tsx', /face\.id === 'guests-coming' && face\.count\) \{\s*return \(\s*<ReplyArrives eventId=\{`tile:/],
    ['app/dashboard/[eventId]/_components/home-cover-band.tsx', /<DayTurns eventId=\{countdown\.turnFor\} days=\{countdown\.days\}><Count value=\{countdown\.days\} id="home-count" \/><\/DayTurns>/],
    ['app/vendor-dashboard/subscription/_components/plan-screen.tsx', /<CapizLight\s+subject=\{`shop:/],
    ['app/dashboard/[eventId]/studio/website-pro/page.tsx', /<CapizLight subject=\{`event:\$\{eventId\}`\}/],
  ];
  for (const [file, re] of mounts) assert.match(read(file), re, `${file} no longer mounts its signature moment`);
  // No server write, no request: the rules and the parts never name a server door.
  for (const f of ['lib/signature-moments.ts', ...['use-moment.ts', 'the-tie.tsx', 'foil-glint.tsx', 'go-live.tsx', 'reply-arrives.tsx', 'day-turns.tsx', 'capiz-light.tsx'].map((x) => `app/_components/signature/${x}`)]) {
    const src = read(f);
    assert.ok(!/'use server'|supabase|fetch\(|\.rpc\(|actions'/.test(src), `${f} reaches the server — a moment never adds a write or a read`);
  }
});
