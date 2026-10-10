/**
 * a-fixed-block-has-its-own-motion.test.ts — ANIMATE FOR THE FIXED BLOCKS A GUEST REALLY SEES.
 *
 * Owner's rule (2026-10-09, verbatim): "there should always be animate and background?" → "yes that is what we are
 * doing. giving the freedom to fix their event hub." Controller's rulings (2026-10-10): the look is kept in
 * `events.style_preferences.block_looks`; absent = today's page; fixed lists only, through one strict reader; a
 * guest's page byte-identical unless something is stored; no new wrapper; the "did this change?" check must count
 * the new key; only the four blocks with ONE real root — the six the canvas draws as SAMPLES stay grey and say why.
 *
 * Held here:
 *   1 · THE READER IS STRICT — four blocks, and only what the Event Hub's own motion reader keeps.
 *   2 · THE RULES ARE THE EVENT HUB'S OWN — inside its two gates, a timed Build in waiting for the page's observer,
 *       a scroll one on the block's own trip; nothing at all when nothing moves.
 *   3 · THE DRAFT CARRIES IT, COUNTS IT AND NAMES IT — and an empty look is no look.
 *   4 · A GUEST'S PAGE — a mark only for a block that has a look, the one style only when there is a rule.
 *   5 · THE TOOLBAR — Animate live on the four; the six samples grey, each naming the thing; E-Gifts only when real.
 *   6 · FIRST LOAD — the files the Maker loads first carry only the key; the reader, the rules and the rows are lazy.
 *
 * Sabotages seen red (each restored): the reader keeping a made-up motion · a sample given a look · the draft
 * dropping the key · a block look not counted as a change · a mark served to every guest · the gate left open · a
 * sample's Animate live.
 *
 * 🪑 2026-10-10 — A SAMPLE MADE REAL: YOUR SEAT (controller: its real block is one root in one place in the page, so
 * the look is kept against THAT and the canvas's sample is addressed by the same rule). Held in §1 (the list), §2
 * (a block Me draws has no chapter, so its timed Build in is bound there too), §3 (counted), §4 (the mark rides with
 * the real block into both of its slots, and stands before the canvas's sample) and §5 (five samples stay grey).
 * Sabotages seen red: the mark left out of the real block · the mark dropped before the sample · the no-chapter arm
 * removed · Your seat put back among the samples.
 *
 * 🎫 2026-10-10 — …AND THE DIGITAL PASS. Each guest's own is `GuestTicket`, first on Me: one root, already named. The
 * mark is made where the ticket is mounted (`app/[slug]/page.tsx`) and handed to the ticket, which puts it before its
 * root only when it draws a TICKET; the canvas's sample stands behind the same mark. ⚓ The door's own lift
 * (`[data-motion='pass']:target`) still plays: the block's motion is written for every moment but that one. Held in
 * §1 · §2 · §3 · §4 · §5. Sabotages seen red: the ticket mounted without its mark · the mark put before the reply
 * button too · the block's motion out-ranking the door's lift · the pass put back among the samples.
 *
 * Lives in `lib/` because node's test glob does not descend into `[eventId]`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import {
  BLOCK_EMPTY_WHY,
  BLOCK_GATE_OPEN,
  BLOCK_LOOKS_MESSAGE,
  BLOCK_LOOKS_PREF_KEY,
  BLOCK_LOOKS_STYLE_ATTR,
  BLOCK_LOOK_BLOCKS,
  BLOCK_MARK_ATTR,
  BLOCK_SAMPLE_WHY,
  blockLooksCss,
  blockLooksWith,
  blockOfCanvas,
  blockSelector,
  readBlockLooks,
} from './block-looks';
import { MAKER_PARTS, makerPartToolWorks, type MakerPartKey } from './maker-parts';
import { hubDraftCountedChanges, mergeHubDraft, planHubDraftApply, sanitizeHubDraft, type HubLiveState } from './hub-draft';

const WEB = join(__dirname, '..');
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const src = (rel: string) => stripComments(raw(rel));
const L = 'app/dashboard/[eventId]/launch/_components';

test('1 · the reader is strict: the real blocks, and only what the Event Hub’s motion reader keeps', () => {
  assert.equal(BLOCK_LOOKS_PREF_KEY, 'block_looks');
  /* 🔁 RE-AIMED 2026-10-10 (a sample made real): Your seat joined the four — each guest's own is ONE root in one
     place in the page (`seatBlock`, §4), so a look kept for it reaches a guest. The claim is the same: only a block
     with one real root is listed. */
  assert.deepEqual([...BLOCK_LOOK_BLOCKS], ['entourage', 'details', 'gifts', 'spotlight', 'find_your_seat', 'pass']);
  assert.equal(blockOfCanvas('f:find_your_seat'), 'find_your_seat');
  assert.equal(blockOfCanvas('f:pass'), 'pass');
  /* Each is a block the Maker frames — and the samples are not among them. */
  const canvases = new Set(Object.values(MAKER_PARTS).map((p) => p.canvas));
  for (const b of BLOCK_LOOK_BLOCKS) assert.ok(canvases.has(`f:${b}`), `${b} is no block of the Maker’s`);
  for (const sample of Object.keys(BLOCK_SAMPLE_WHY)) {
    assert.ok(canvases.has(sample), `${sample} is no part`);
    assert.equal(blockOfCanvas(sample), null, `${sample} is a sample: a look kept for it would never reach a guest`);
  }
  assert.equal(blockOfCanvas('f:entourage'), 'entourage');
  for (const not of ['w:schedule', 'f:hero', 'f:rsvp', 'p:wall', 'entourage', null, undefined]) assert.equal(blockOfCanvas(not), null);

  const read = readBlockLooks({
    qr: { shape: 'dots' },
    block_looks: {
      entourage: { motion: { in: { fade: true, move: 'below' }, speed: 'gentle', delay: 'short' } },
      details: { motion: { in: { fade: 'yes', move: 'sideways' }, during: 'spin', out: { fade: true } } } /* nothing listed; an Out without the scroll is dropped */,
      gifts: { motion: { timeline: 'scroll', in: { blur: true }, out: { fade: true, size: 'grow' }, during: 'drift', animation: 'x 1s; } body{display:none' } },
      spotlight: { motion: 'fast' },
      announcements: { motion: { in: { fade: true } } } /* a sample: not kept */,
      __proto__: { motion: { in: { fade: true } } },
    },
  });
  assert.deepEqual(read, {
    entourage: { motion: { in: { fade: true, move: 'below' }, speed: 'gentle', delay: 'short' } },
    gifts: { motion: { in: { blur: true }, during: 'drift', timeline: 'scroll', out: { fade: true, size: 'grow' } } },
  });
  for (const none of [null, undefined, 'x', [], {}, { block_looks: null }, { block_looks: [] }, { block_looks: { entourage: null } }, { block_looks: { entourage: { motion: {} } } }]) assert.deepEqual(readBlockLooks(none), {});
});

test('2 · the rules are the Event Hub’s own: both gates, a timed Build in waits for the observer, nothing when still', () => {
  assert.equal(blockLooksCss({}), '');
  assert.equal(blockLooksCss(readBlockLooks({ block_looks: { entourage: {} } })), '');
  /* The gate is the Event Hub's, word for word — an engine that fails either shows every block at rest. */
  assert.ok(raw('lib/element-style.ts').includes(`const GATE_OPEN = '${BLOCK_GATE_OPEN}';`), 'the block’s gate is not the Event Hub’s own');
  assert.equal(BLOCK_GATE_OPEN, '@supports (animation-timeline: view()){@media (prefers-reduced-motion: no-preference){');

  const timed = blockLooksCss(readBlockLooks({ block_looks: { entourage: { motion: { in: { fade: true, move: 'below' }, speed: 'gentle' } } } }));
  assert.ok(timed.startsWith(`${BLOCK_GATE_OPEN}\n`) && timed.endsWith('\n}}'), 'a rule is written outside the gates');
  const at = blockSelector('entourage');
  assert.equal(at, ':is([data-block-mark="entourage"] + :not([data-maker-section]), [data-block-mark="entourage"] + [data-maker-section] + *)');
  const lines = timed.split('\n').slice(1, -1);
  assert.equal(lines.length, 2);
  /* Until the guest gets there the block RESTS, visible (a `0s none none` slot — never a hidden first frame)… */
  assert.ok(lines[0]!.startsWith(`${at}:not(#el-own){animation:0s none none,`), lines[0]);
  /* …and plays once the page's one observer marks the chapter it sits in. */
  assert.ok(lines[1]!.startsWith(`.pahina-in ${at}:not(#el-own),.pahina-in${at}:not(#el-own){animation:1.8s cubic-bezier(0.22, 0.61, 0.36, 1) 0s none el-in-rise,`), lines[1]);

  /* 👤 A BLOCK ME DRAWS HAS NO CHAPTER (Your seat, where a guest's bar has Me): Me is a sibling of the chapters
     article, and the page's one observer marks chapters and scenes only — so the timed rule is bound there as well,
     or the Build in would be seen in the Maker and never by a guest. Inside a chapter it still waits for the mark. */
  const seat = blockLooksCss(readBlockLooks({ block_looks: { find_your_seat: { motion: { in: { fade: true, move: 'below' }, speed: 'gentle' } } } })).split('\n').slice(1, -1);
  const seatAt = `${blockSelector('find_your_seat')}:not(#el-own)`;
  assert.equal(seat.length, 2);
  assert.ok(seat[0]!.startsWith(`${seatAt}{animation:0s none none,`), seat[0]);
  assert.ok(seat[1]!.startsWith(`.pahina-in ${seatAt},.pahina-in${seatAt},${seatAt}:not([data-pahina-chapters] *){animation:1.8s cubic-bezier(0.22, 0.61, 0.36, 1) 0s none el-in-rise,`), seat[1]);
  /* The two facts that arm leans on: Me is filed with no chapters, and the observer marks nothing else. */
  const PAGE = src('app/[slug]/_components/site-body.tsx');
  const me = PAGE.slice(PAGE.indexOf("group('me', ("), PAGE.indexOf("group('me', (") + 200);
  assert.match(me, /^group\('me', \(\s*<div data-me-stage=""/, 'Me is no longer filed where this test looks');
  assert.match(PAGE, /<div data-me-stage=""[\s\S]*?\{tableOnMe \? seatBlock : null\}[\s\S]*?<\/div>\s*\)\) : null\}/, 'Me became a chapter (or the seat left it): re-walk the no-chapter arm');
  const OBSERVER = raw('app/[slug]/_components/pahina-motion.tsx');
  assert.ok(OBSERVER.includes("var sel='.sn-editorial [data-pahina-chapters] > *';") && OBSERVER.includes("var hsel='.hub-canvas, style[data-hub-els]';"), 'the observer marks something new — a block in Me may no longer need its own arm');

  /* 🎫 THE PASS is Me's too (no chapter: the same arm) — and ⚓ THE DOOR'S OWN LIFT STAYS: when the day's "Show your
     ticket" lands on `#site-pass`, `[data-motion='pass']:target` lifts the ticket so it reads as the thing to show at
     the door. A block's rule would out-rank that one (an id's worth of specificity), so every arm of the pass's motion
     is written for every moment BUT that one. */
  const pass = blockLooksCss(readBlockLooks({ block_looks: { pass: { motion: { in: { fade: true, move: 'below' }, speed: 'gentle' } } } })).split('\n').slice(1, -1);
  const passAt = `${blockSelector('pass')}:not(#el-own):not(:target)`;
  assert.equal(pass.length, 2);
  assert.ok(pass[0]!.startsWith(`${passAt}{animation:0s none none,`), pass[0]);
  assert.ok(pass[1]!.startsWith(`.pahina-in ${passAt},.pahina-in${passAt},${passAt}:not([data-pahina-chapters] *){animation:1.8s cubic-bezier(0.22, 0.61, 0.36, 1) 0s none el-in-rise,`), pass[1]);
  for (const line of pass) assert.equal(line.split('{')[0]!.split(':not(:target)').length - 1, line.split('{')[0]!.split(':not(#el-own)').length - 1, 'an arm of the pass’s motion reaches the pass while the address points at it');
  assert.match(raw('app/globals.css'), /\[data-motion='pass'\]:target \{\s*animation: sn-pass-lift var\(--sn-dur-enter\) var\(--sn-ease-out\) backwards;\s*\}/, 'the door’s lift is gone (or renamed): the pass’s `:not(:target)` guards nothing');
  /* No other block is kept from its target (none is one). */
  assert.doesNotMatch(blockLooksCss(readBlockLooks({ block_looks: { entourage: { motion: { in: { fade: true } } }, find_your_seat: { motion: { in: { fade: true } } } } })), /:target/);

  /* Following the scroll: the block's own trip across the screen, in and out, and Drift between. */
  const scroll = blockLooksCss(readBlockLooks({ block_looks: { details: { motion: { timeline: 'scroll', in: { fade: true, move: 'left' }, out: { fade: true }, during: 'drift' } } } }));
  assert.match(scroll, /animation-timeline:view\(\), auto, view\(\);animation-range:entry 0% cover 30%, normal, exit 0% exit 100%/);
  assert.match(scroll, /el-during-drift/);
  /* ↔ A block that travels sideways must not widen the page. */
  assert.match(scroll, /^:has\(> \[data-block-mark="details"\]\)\{overflow-x:clip\}$/m);
  assert.doesNotMatch(timed, /overflow-x/);
  /* Nothing a person typed can be in it: the declarations are the Event Hub's closed sets. */
  const evil = blockLooksCss(readBlockLooks({ block_looks: { gifts: { motion: { in: { fade: true }, speed: '1s; } body{display:none} .x{', delay: 'url(x)' } } } }));
  assert.doesNotMatch(evil, /display:none|url\(/);
});

test('3 · the draft carries it, counts it and names it; an empty look is no look', () => {
  const look = { entourage: { motion: { in: { fade: true } } }, later: { g: 'frost' } };
  const part = sanitizeHubDraft({ events: { style_preferences: { [BLOCK_LOOKS_PREF_KEY]: look, anything_else: 1 } } });
  assert.deepEqual(part?.events.style_preferences, { [BLOCK_LOOKS_PREF_KEY]: look }, 'the draft’s cleaner drops the blocks’ looks (or keeps a key that is not the Maker’s)');
  for (const bad of ['x', 3, null, [1]]) assert.equal(sanitizeHubDraft({ events: { style_preferences: { [BLOCK_LOOKS_PREF_KEY]: bad } } })?.events.style_preferences, undefined);
  /* A QR or camera save laid over it keeps it (the part is merged key by key). */
  const merged = mergeHubDraft(part!, sanitizeHubDraft({ events: { style_preferences: { camera_look: 'film' } } })!);
  assert.deepEqual((merged.events.style_preferences as Record<string, unknown>)[BLOCK_LOOKS_PREF_KEY], look);

  /* COUNTED: a block look that differs from live is one change in the Apply count… */
  const live = { events: { style_preferences: {} }, widgets: {} } as unknown as HubLiveState;
  const counted = (draft: ReturnType<typeof sanitizeHubDraft>) => hubDraftCountedChanges(planHubDraftApply(draft, live, false));
  const moved = counted(part!);
  assert.equal(moved.length, 1, 'a block’s look does not move the Apply count');
  assert.equal(moved[0]!.held, false, 'a block’s look is held as if it were Pro — it is free');
  /* …and so is a look for a sample made real (Your seat): one change, free. */
  const seated = counted(sanitizeHubDraft({ events: { style_preferences: { [BLOCK_LOOKS_PREF_KEY]: { find_your_seat: { motion: { in: { fade: true } } } } } } }));
  assert.equal(seated.length, 1, 'Your seat’s look does not move the Apply count');
  assert.equal(seated[0]!.held, false);
  const ticketed = counted(sanitizeHubDraft({ events: { style_preferences: { [BLOCK_LOOKS_PREF_KEY]: { pass: { motion: { in: { fade: true } } } } } } }));
  assert.equal(ticketed.length, 1, 'the pass’s look does not move the Apply count');
  assert.equal(ticketed[0]!.held, false);
  /* …and a look put back to nothing (an empty object over none) is not. */
  const still = sanitizeHubDraft({ events: { style_preferences: { [BLOCK_LOOKS_PREF_KEY]: {} } } });
  assert.equal(still ? counted(still).length : 0, 0, 'an empty look counts as a change');
  /* NAMED for what it is — never "Your QR code". */
  assert.match(src('lib/hub-draft.ts'), /!\(QR_STYLE_PREF_KEY in item\.value\) && item\.value\.block_looks\) return 'How your blocks look';/);
  assert.match(src('lib/hub-draft-change-lines.ts'), /if \(!qrMoved && isPlainObjectValue\(item\.value\) && 'block_looks' in item\.value\) return \{ place: 'Event Hub', what: 'How a block looks' \};/);

  /* THE SAVE keeps what it does not know, and "still" leaves no motion behind. */
  const prefs = { [BLOCK_LOOKS_PREF_KEY]: look };
  assert.deepEqual(blockLooksWith(prefs, 'details', { in: { blur: true } }), { ...look, details: { motion: { in: { blur: true } } } });
  assert.deepEqual(blockLooksWith(prefs, 'entourage', null), { later: { g: 'frost' } });
  assert.deepEqual(blockLooksWith({}, 'gifts', null), {});
  assert.deepEqual(blockLooksWith({ [BLOCK_LOOKS_PREF_KEY]: { gifts: { g: 'frost', motion: { in: { fade: true } } } } }, 'gifts', null), { gifts: { g: 'frost' } });
});

test('4 · a guest’s page: a mark only for a block that has a look, and the one <style> only when there is a rule', () => {
  const BODY = src('app/[slug]/_components/site-body.tsx');
  assert.match(BODY, /const blockLooks = readBlockLooks\(\(event as \{ style_preferences\?: unknown \}\)\.style_preferences\);/);
  /* The mark: on the Maker's canvas always; for a guest ONLY when that block has a look — so a page with none is
     byte-identical to before. `hidden`, like the Maker's own marker: out of layout and out of the rhythm. */
  assert.match(BODY, /const blockMark = \(block: BlockLookBlock\) => \(isEditorCanvas \|\| blockLooks\[block\] \? <span hidden \{\.\.\.\{ \[BLOCK_MARK_ATTR\]: block \}\} \/> : null\);/);
  assert.match(BODY, /\{blockCss \|\| isEditorCanvas \? <style \{\.\.\.\{ \[BLOCK_LOOKS_STYLE_ATTR\]: '' \}\}>\{blockCss\}<\/style> : null\}/);
  /* Each of the four is marked right BEFORE it — and before the Maker's own marker, which must stay next to the block
     (`sectionAfter` frames the element right after it). */
  assert.match(BODY, /\{blockMark\('details'\)\}\s*\{makerMark\('f:details'\)\}\s*<PublicEventDetails/);
  assert.match(BODY, /<>\{stageShowsEntourage\(pageStage\) \? blockMark\('entourage'\) : null\}\{stageShowsEntourage\(pageStage\) \? <EntourageSection groups=\{entourage\} id="site-entourage"/);
  /* 🪑 YOUR SEAT — the mark rides WITH the real block (one const), so it is right before the block's root in both of
     its slots (Welcome's group, or inside Me — never both), and absent when there is no table to draw. */
  assert.match(BODY, /const seatBlock = seatMap \? \(\s*<>\s*\{blockMark\('find_your_seat'\)\}\s*<YourSeatBlock\s/);
  assert.match(BODY, /\{seatOnMe \? null : group\(seatTab, seatBlock, \{ chapters: true, className: 'space-y-12' \}\)\}/);
  assert.match(BODY, /\{tableOnMe \? seatBlock : null\}/);
  assert.equal((BODY.match(/<YourSeatBlock\s/g) ?? []).length, 1, 'the seat is drawn from a second place: its look would not reach it');
  /* …and the canvas's SAMPLE of it stands behind the same mark (before the Maker's own marker, which stays next to
     the sample), so the look is drawn there by the rules that draw it for a guest. */
  assert.match(BODY, /const sampleBlockMark = \(key: string\) => \{\s*const block = blockOfCanvas\(key\);\s*return block \? blockMark\(block\) : null;\s*\};/);
  assert.match(BODY, /\{sampleBlockMark\(`f:\$\{part\}`\)\}\s*\{makerMark\(`f:\$\{part\}`\)\}\s*<MakerDayPartStandIn/);
  /* 🎫 THE DIGITAL PASS — mounted by the page (`page.tsx`), not by SiteBody: the mark is made THERE by the same rule
     (the canvas always; a guest only when a look is kept), and handed to every mount of the ticket… */
  const PAGE = src('app/[slug]/page.tsx');
  assert.match(PAGE, /const passBlockMark =\s*isEditorCanvas \|\| readBlockLooks\(\(event as \{ style_preferences\?: unknown \}\)\.style_preferences\)\.pass \? <span hidden \{\.\.\.\{ \[BLOCK_MARK_ATTR\]: 'pass' \}\} \/> : null;/);
  const tickets = (PAGE.match(/<GuestTicket\s/g) ?? []).length;
  assert.equal(tickets, 2, 'anti-vacuity: the ticket’s mounts were found (a guest’s, and the Maker’s sample guest’s)');
  assert.equal((PAGE.match(/<GuestTicket\s[^>]*?\smark=\{passBlockMark\}\s*\/>/g) ?? []).length, tickets, 'a ticket is mounted without its mark: its look would not reach those guests');
  const parts = readdirSync(join(WEB, 'app/[slug]/_components')).filter((f) => f.endsWith('.tsx'));
  assert.ok(parts.length > 100 && parts.includes('guest-ticket.tsx'), `anti-vacuity: walked ${parts.length} files`);
  for (const file of parts) assert.doesNotMatch(src(`app/[slug]/_components/${file}`), /<GuestTicket\s/, `${file} mounts the ticket itself: it would have no mark`);
  /* …and THE TICKET puts it right before its own root, only when it draws a ticket: the reply button (not replied
     yet) and the one line (cannot come) are not a pass, and take no mark. */
  const TICKET = src('app/[slug]/_components/guest-ticket.tsx');
  assert.match(TICKET, /<>\s*\{mark\}\s*<section\s+id=\{PASS_ANCHOR\}\s+data-motion="pass"\s+data-guest-ticket=\{state\}/);
  assert.equal((TICKET.match(/\{mark\}/g) ?? []).length, 1, 'the mark stands before something that is not a ticket');
  assert.equal((TICKET.match(/data-motion="pass"/g) ?? []).length, 1);
  /* THE CANVAS'S SAMPLE of it stands behind the same mark: the block's, then the Maker's marker, then the sample. */
  assert.match(BODY, /const guestSceneMark = \(key: string\) => \(\s*<>\s*\{sampleBlockMark\(key\)\}\s*\{makerMark\(key\)\}\s*<\/>\s*\);/);
  const passSamples = (BODY.match(/<MakerGuestScenes\s[^>]*?pass: (?:true|plan\.qrCardShouldRender)[\s\S]*?\/>/g) ?? []);
  assert.equal(passSamples.length, 2, 'anti-vacuity: the two mounts that can draw the pass’s sample were found');
  for (const mount of passSamples) assert.match(mount, /mark=\{guestSceneMark\}/, 'a sample of the pass is drawn with no block mark: a look picked in the Maker would not show');
  assert.match(src('app/[slug]/_components/maker-guest-scenes.tsx'), /\{mark\('f:pass'\)\}\s*<section className="flex flex-col items-center gap-2 text-center" data-maker-guest-scene="pass">/);
  /* Happening now is drawn in TWO places (never both at once): the look reaches both. */
  assert.equal((BODY.match(/blockMark\('spotlight'\) : null\}\s*\{plan\.spotlight[^}]*makerMark\('f:spotlight'\) : null\}/g) ?? []).length, 2, 'Happening now is marked in one of its two places only');
  /* E-Gifts is drawn by the welcome block, which takes its marker as a prop — in every tree that can show a gift link. */
  assert.match(BODY, /const giftsBlockMark = \(key: string\) => \(key === 'f:gifts' \? blockMark\('gifts'\) : null\);/);
  const gifted = (BODY.match(/giftHref=\{doorways\.pabuya\}/g) ?? []).length;
  assert.ok(gifted >= 2, 'anti-vacuity: the welcome block’s mounts were found');
  assert.equal((BODY.match(/giftHref=\{doorways\.pabuya\}\s*mark=\{(?:giftsBlockMark|\(key\) => <>\{giftsBlockMark\(key\)\}\{makerMark\(key\)\}<\/>)\}/g) ?? []).length, gifted, 'a tree shows E-Gifts with no mark: its look would not reach those guests');
  assert.match(src('app/[slug]/_components/guest-welcome.tsx'), /\{mark\('f:gifts'\)\}\s*<WelcomeGifts /);
  assert.equal(BLOCK_MARK_ATTR, 'data-block-mark');
  /* THE CANVAS redraws the one style from the strict reader, fetched on that message only — the two names are said
     outright there so a guest's bundle never carries the module. */
  const BRIDGE = src('app/[slug]/_components/editor-bridge.tsx');
  assert.equal(BLOCK_LOOKS_MESSAGE, 'blockLooks');
  assert.equal(BLOCK_LOOKS_STYLE_ATTR, 'data-block-looks');
  assert.match(BRIDGE, /data\.t === 'blockLooks'\) \{\s*const looks = \(data as \{ looks\?: unknown \}\)\.looks;\s*void import\('@\/lib\/block-looks'\)\.then\(\(\{ blockLooksCss, readBlockLooks \}\) => \{\s*const css = blockLooksCss\(readBlockLooks\(\{ block_looks: looks \}\)\);[\s\S]{0,60}document\.querySelectorAll<HTMLElement>\('style\[data-block-looks\]'\)/);
  /* …and a changed look is shown at once: each marked block is told it was just reached (the observer's own mark),
     found from its mark — never by a selector taken out of the CSS text. */
  assert.match(BRIDGE, /document\.querySelectorAll\('\[data-block-mark\]'\)\.forEach\(\(mark\) => \{\s*const after = mark\.nextElementSibling;\s*const block = after\?\.hasAttribute\('data-maker-section'\) \? after\.nextElementSibling : after;/);
  assert.doesNotMatch(BRIDGE, /^import [^;]*from '@\/lib\/block-looks';/m, 'the blocks’ reader is in every guest’s bundle');
});

test('5 · the toolbar: Animate is live on the real blocks; the samples stay grey and each names the thing', () => {
  const TOOLS = src(`${L}/stage-tools.tsx`);
  assert.match(TOOLS, /const blockAt = !rsvpOpen && picked \? blockOfCanvas\(makerPartCanvasOn\(stageKey, picked\)\) : null;/);
  /* E-Gifts only while the canvas draws the REAL block (with no gift details a guest sees nothing there). */
  assert.match(TOOLS, /if \(blockAt !== 'gifts'\) return setBlockIsReal\(true\);[\s\S]{0,200}findMakerSection\(doc, 'f:gifts'\)\?\.hasAttribute\('data-welcome-gifts'\)/);
  assert.match(src('app/[slug]/_components/guest-doorway-strip.tsx'), /<section className="space-y-3" data-welcome-gifts=""/, 'the real E-Gifts block no longer says it is one');
  assert.match(TOOLS, /const block = blockAt && blockIsReal \? blockAt : null;/);
  /* 🔁 RE-AIMED 2026-10-10 (Background for the four blocks — owner: "there should always be animate and background?"
     → "yes"): a block's own tools are now TWO, Background beside Animate, so the clause names both. The claim this pin
     holds — a tool is live on a block only when the block is one of the four AND is really drawn (`block`) — is the
     same; what Background does there is held by `a-fixed-block-has-its-own-background.test.ts`. */
  assert.match(TOOLS, /const ownTool = \(t: MakerPartTool\) => \(rsvpLooks && \(t === 'bg' \|\| t === 'animate'\)\) \|\| \(block !== null && \(t === 'bg' \|\| t === 'animate'\)\);/);
  /* 🔁 RE-AIMED 2026-10-10 (toolbar consistency — owner: "please make Edit | Style | Background | Animate Consistent in
     design"): the part rule is as it was, and one clause is added to it — a tool whose rows would be EMPTY on the
     picked thing is grey too (`emptyHere`: on the reply pages Style has a row only for a line with a look and for the
     When-yes card). The claim this pin holds — a live tool is one with something to set — is the same, and stricter. */
  assert.match(TOOLS, /const toolWorks = \(t: MakerPartTool\) => !picked \|\| ownTool\(t\) \|\| \(\(t === 'edit' \|\| t === 'style' \|\| !styleOnly\) && makerPartToolWorks\(picked, t\) && !emptyHere\(t\)\);/);
  /* Its rows are the toolbar's own, and the work area's tool stands aside for them. */
  assert.match(TOOLS, /const blockRows = open && block !== null && shownTool === 'animate';/);
  assert.match(TOOLS, /\{blockRows && block \? <BlockAnimateRows key=\{block\} block=\{block\} \/> : null\}/);
  assert.match(TOOLS, /\[data-maker-shell\]:has\(\[data-stage-tools\]\[data-stage-own-rows\]\) \[data-phone-chrome="panel"\]\{visibility:hidden;pointer-events:none\}/);
  assert.match(src(`${L}/details-lazy.tsx`), /export const BlockAnimateRows = dynamic\(\(\) => import\(\s*'\.\/stage-panel\/block-animate'\)/, 'the block’s Animate is in the first load');
  /* It IS the cover line's Animate — every phase, Plays, Delay — on the block's own save through the one draft door. */
  const ROWS = src(`${L}/stage-panel/block-animate.tsx`);
  assert.match(ROWS, /<StageAnimate\s+pending=\{pending\}\s+error=\{error\}/);
  for (const prop of ['plays=', 'inFx=', 'outFx=', 'delay=', 'does=']) assert.ok(ROWS.includes(prop), `the block’s Animate lost ${prop}`);
  assert.doesNotMatch(ROWS, /only="in"|leaves=/, 'a block is not a one-screen page, and it hands over to nothing');
  assert.match(ROWS, /fd\.set\('patch', JSON\.stringify\(\{ events: \{ style_preferences: \{ \[BLOCK_LOOKS_PREF_KEY\]: looks \} \} \}\)\);\s*const door = draftDoor\(\);\s*const r = await makerSave\(\(\) => door\(eventId, fd\), \(\) => router\.refresh\(\)\);/);
  /* …through the work area's own draft door (the Camera look's): `hubDraftAction` on a real event, the lab's stand-in
     on the lab — the server action itself sent the lab to the sign-in page (seen 2026-10-10). */
  assert.match(ROWS, /return \(got as MakerPartRaw \| null\)\?\.elementEditing\?\.draftAction \?\? hubDraftAction;/);

  /* THE SAMPLES: no look, by the part rule AND by the block list — and each says why, naming the thing.
     🔁 RE-AIMED 2026-10-10 (a sample made real): Your seat left this list when its real block took the look — the
     toolbar's `block` now names it (`blockOfCanvas`), so `ownTool` lights Background and Animate there through the
     very lines pinned above, and no line of the toolbar changed. The claim is the same: a part still listed here
     has no real root a look could reach, stays grey, and says so. */
  assert.deepEqual(Object.keys(BLOCK_SAMPLE_WHY).sort(), ['f:announcements', 'f:live_hub', 'f:look', 'f:photos_of_you']);
  /* The part rule itself is as it was (a first-load file, not edited): the two tools of Your seat and of the pass are
     the BLOCK's. (The pass is also a line of the reply's thank-you page — there the toolbar asks no block: `!rsvpOpen`.) */
  for (const canvas of ['f:find_your_seat', 'f:pass']) {
    for (const tool of ['bg', 'animate'] as const) assert.equal(makerPartToolWorks((Object.keys(MAKER_PARTS) as MakerPartKey[]).find((k) => MAKER_PARTS[k].canvas === canvas)!, tool), false);
  }
  for (const [canvas, why] of Object.entries(BLOCK_SAMPLE_WHY)) {
    assert.match(why, /^This is a sample\. /, `${canvas}: ${why}`);
    const part = (Object.keys(MAKER_PARTS) as MakerPartKey[]).find((k) => MAKER_PARTS[k].canvas === canvas)!;
    for (const tool of ['bg', 'animate'] as const) assert.equal(makerPartToolWorks(part, tool), false, `${part} › ${tool} is live on a sample`);
  }
  assert.equal(new Set(Object.values(BLOCK_SAMPLE_WHY)).size, 4, 'two samples say the same thing');
  assert.match(TOOLS, /const sample = picked && \(t === 'bg' \|\| t === 'animate'\) \? BLOCK_SAMPLE_WHY\[makerPartCanvasOn\(stageKey, picked\) \?\? ''\] : undefined;/);
  /* 🔁 RE-AIMED 2026-10-10 (same change): E-Gifts with nothing for a guest to see says so for Background too — it
     would otherwise answer "edit it in Studio", which is no longer where a block's background is. */
  assert.match(TOOLS, /const empty = blockAt && !blockIsReal && \(t === 'bg' \|\| t === 'animate'\) \? BLOCK_EMPTY_WHY : undefined;\s*return sample \?\? empty \?\? makerPartToolWhy\(picked, t\);/);
  assert.match(TOOLS, /if \(!toolWorks\(t\)\) return setWhy\(\(w\) => \(\{ words: whyNot\(t\), n: \(w\?\.n \?\? 0\) \+ 1 \}\)\);/);
  assert.match(BLOCK_EMPTY_WHY, /^Guests see nothing here until /);
  /* Nothing a couple reads here says "celebration". */
  for (const words of [...Object.values(BLOCK_SAMPLE_WHY), BLOCK_EMPTY_WHY]) assert.doesNotMatch(words, /celebration/i);
});

test('6 · first load: the files the Maker loads first carry only the KEY — never the reader, the rules or the rows', () => {
  /* The Maker's first load has about 0.1 KB to spare (a real build, 2026-10-10). What this work adds there is three
     short lines in `lib/hub-draft.ts` (carry the key · count it · name it), paid for by moving
     `rsvpAskConfigOnGoingPublic` out of `lib/rsvp-ask.ts` — measured single-file gz, hub-draft +67 B, rsvp-ask −77 B.
     Held as a property, not a number (a byte count pinned here would break on the next honest edit of either file):
     no first-load file may reach the reader, the motion builder or the rows — they load with the toolbar. */
  for (const file of ['lib/hub-draft.ts', 'lib/maker-parts.ts', 'lib/rsvp-ask.ts', 'lib/hub-canvas.ts', 'lib/hub-scenes.ts', `${L}/maker-shell.tsx`, `${L}/details-workspace.tsx`]) {
    assert.doesNotMatch(src(file), /from '(?:@\/lib|\.)\/(?:block-looks|rsvp-look|rsvp-form-words)'|stage-panel\/block-animate|rsvp-line-look/, `${file} is in the Maker’s first load and reaches a lazy module`);
  }
  /* The key is said outright in the draft's cleaner (no import to carry) — and it is the module's own. */
  const DRAFT = src('lib/hub-draft.ts');
  assert.match(DRAFT, /if \(isPlainObject\(raw\.block_looks\)\) out\.block_looks = raw\.block_looks;/);
  assert.equal(BLOCK_LOOKS_PREF_KEY, 'block_looks');
  /* What paid for it stays out: the going-public rule lives beside its draft half, and only server code asks it. */
  assert.doesNotMatch(src('lib/rsvp-ask.ts'), /rsvpAskConfigOnGoingPublic|RSVP_WORD_LINES|rsvpAskConfigFits/, 'a give-back came back into the first-load file');
  assert.match(src('lib/going-public.ts'), /export function rsvpAskConfigOnGoingPublic\(/);
  assert.match(src('app/dashboard/[eventId]/website/privacy/actions.ts'), /import \{ rsvpAskConfigOnGoingPublic \} from '@\/lib\/going-public';/);
});
