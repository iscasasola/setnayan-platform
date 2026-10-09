/**
 * the-play-button-previews.test.ts — ▶ IN THE TOOLS ROW (owner 2026-10-09, verbatim: *"preview button allow preview the
 * animate on where they are"* · *"long press will preview that whole page (they can scroll, tap around, and an exit
 * preview button should show)"*).
 *
 *   (1) A TAP PLAYS WHERE THEY ARE — EXECUTED on the sequence the canvas builds: in Animate the phase on screen plays
 *       ALONE (Build in, the Action or Build out); a Build in that plays on arrival runs for the page's own seconds
 *       (the Movement picked); an end that follows the scroll is shown on a clock and SAYS so; a phase with nothing
 *       says so; under "reduce motion" nothing plays and that is said. Sabotage: `only` ignored → red.
 *   (2) THE TOOLBAR ASKS FOR THAT PHASE only while Animate's rows are on screen — any other tool plays the part's
 *       whole life, as before. Sabotage: the phase sent from every tool → red.
 *   (3) A HOLD IS THE WHOLE PAGE AS A GUEST — the press starts a timer, a release before it is a tap, the release
 *       after it is NOT a tap; entering lets go of nothing (the part and the tool are kept) and the toolbar, the
 *       frame and the work area's tool step aside; "Exit preview" is the one ActionButton, clear of the safe area
 *       and of the guests' bar; leaving gives the canvas its taps back and returns to the page and the part held.
 *       The hold has a twin: the first tap says it. Sabotage: the release of a hold also playing → red.
 *   (4) IN THE PREVIEW THE CANVAS TAKES NO TAP — the page's own buttons answer; a link that LEAVES the page and a
 *       form being sent are refused and said (EXECUTED for the link rule). Nothing of the editor is drawn.
 *       Sabotage: the canvas still taking the tap first → red; a link to another route followed → red.
 *   (5) NOTHING NEW LOADS FIRST — the preview's pieces are imported by the canvas bridge and the lazy toolbar alone.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { guestLinkLeaves } from '../app/[slug]/_components/guest-in-canvas';
import { SEQ_MS, SEQ_ON_A_CLOCK, SEQ_STILL, playSequence, sequenceOf } from '../app/[slug]/_components/play-sequence';

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));

/* ── a page small enough to execute the sequence on ──────────────────────── */
type Fake = { style: { setProperty(k: string, v: string): void; removeProperty(k: string): void }; set: string[]; offsetWidth: number; classList: { contains(c: string): boolean }; querySelector(): null; scrollIntoView(): void; cs: Record<string, string> };
function node(cs: Record<string, string>, classes: string[] = []): Fake {
  const set: string[] = [];
  return {
    set,
    cs,
    offsetWidth: 1,
    style: { setProperty: (_k, v) => void set.push(v), removeProperty: () => void set.push('(removed)') },
    classList: { contains: (c) => classes.includes(c) },
    querySelector: () => null,
    scrollIntoView: () => {},
  };
}
const g = globalThis as unknown as { getComputedStyle: unknown; window: unknown };
g.getComputedStyle = (n: Fake) => ({ ...n.cs, animationName: n.cs.animationName ?? 'none', getPropertyValue: (k: string) => n.cs[k] ?? '' });
const el = (n: Fake) => n as unknown as HTMLElement;
const scene = (over: Record<string, string> = {}, classes = ['hub-tl-time']) => node({ '--hub-in-kf': 'hub-in-movefade-left', '--hub-out-kf': 'hub-out-settle', '--hub-duration': '1.8s', ...over }, classes);
const part = (over: Record<string, string> = {}) => node({ animationName: 'el-in-mix, el-during-drift, el-out-fade', animationDuration: '0.6s, 7s, 1s', animationTimeline: 'auto, auto, view()', ...over });

test('(1) a tap plays where they are — one phase, at the page’s own tempo, and it says what it could not do', () => {
  /* The whole life, as before. */
  assert.deepEqual(sequenceOf(el(scene()), true).steps.map((s) => s.phase), ['in', 'out']);
  assert.deepEqual(sequenceOf(el(part()), false).steps.map((s) => s.phase), ['in', 'act', 'out']);
  /* ONE PHASE. */
  for (const only of ['in', 'act', 'out'] as const) {
    assert.deepEqual(sequenceOf(el(part()), false, only).steps.map((s) => s.phase), [only], `▶ on ${only} played more than ${only}`);
  }
  assert.deepEqual(sequenceOf(el(scene()), true, 'in').steps.map((s) => s.phase), ['in']);
  /* …and a phase with nothing says so — only its own line. */
  const none = sequenceOf(el(scene()), true, 'act');
  assert.deepEqual(none.steps, []);
  assert.deepEqual(none.skipped, ['Action: none']);
  assert.deepEqual(sequenceOf(el(scene({ '--hub-in-kf': 'none' })), true, 'in'), { steps: [], skipped: ['Build in: none'] });
  /* 🎚 ON ARRIVAL: the page's own seconds — the Movement picked. */
  for (const [dur, ms] of [['0.6s', 600], ['1.1s', 1100], ['1.8s', 1800]] as const) {
    const s = sequenceOf(el(scene({ '--hub-duration': dur })), true, 'in');
    assert.equal(s.steps[0]!.ms, ms);
    assert.match(s.steps[0]!.animation, new RegExp(`^hub-in-movefade-left ${ms}ms `));
    assert.deepEqual(s.skipped, [], 'a timed Build in is not a stand-in');
  }
  assert.equal(sequenceOf(el(part()), false, 'in').steps[0]!.ms, 600);
  assert.equal(sequenceOf(el(part({ animationDuration: '1.8s, 7s, 1s' })), false, 'in').steps[0]!.ms, 1800);
  /* WITH THE SCROLL: the same keyframes once on a clock — and it says so. */
  const scrub = sequenceOf(el(scene({}, ['hub-tl-scrub'])), true, 'in');
  assert.equal(scrub.steps[0]!.ms, SEQ_MS.in);
  assert.deepEqual(scrub.skipped, [SEQ_ON_A_CLOCK.in]);
  const partScroll = sequenceOf(el(part({ animationTimeline: 'view(), auto, view()' })), false, 'in');
  assert.equal(partScroll.steps[0]!.ms, SEQ_MS.in);
  assert.deepEqual(partScroll.skipped, [SEQ_ON_A_CLOCK.in]);
  /* A Build out only ever follows the scroll. */
  assert.deepEqual(sequenceOf(el(scene()), true, 'out').skipped, [SEQ_ON_A_CLOCK.out]);
  /* ♿ REDUCE MOTION: nothing is set on the page, and the Maker is told why. */
  const still = scene();
  const said: Array<{ phase: string; skipped: string[] }> = [];
  g.window = { matchMedia: (q: string) => ({ matches: /reduce/.test(q) }), setTimeout: () => 0, clearTimeout: () => {} };
  playSequence(el(still), true, (r) => said.push(r), 'in');
  assert.deepEqual(still.set, [], 'something played under reduce motion');
  assert.deepEqual(said, [{ phase: 'rest', skipped: [SEQ_STILL] }]);
  /* …and without it, the one phase IS set on the page. */
  const moving = scene();
  const told: string[] = [];
  g.window = { matchMedia: () => ({ matches: false }), setTimeout: () => 0, clearTimeout: () => {} };
  playSequence(el(moving), true, (r) => told.push(r.phase), 'in');
  assert.deepEqual(told, ['in']);
  assert.match(moving.set.at(-1) ?? '', /^hub-in-movefade-left 1800ms /);
});

const tools = read(`${L}/stage-tools.tsx`);

test('(2) the toolbar asks for the phase on screen only while Animate’s rows are on screen', () => {
  assert.match(tools, /const \[animatePhase\] = useAnimatePhase\(\);/, 'the toolbar does not read Animate’s phase');
  assert.match(tools, /const only = shownToolRef\.current === 'animate' \? \{ only: animatePhase \} : \{\};\s*postToCanvas\(\{ source: 'setnayan-editor', t: 'playSeq', key: def\.canvas, \.\.\.\(def\.el \? \{ el: def\.el \} : \{\}\), \.\.\.only \}\);/);
  assert.match(tools, /shownToolRef\.current = shownTool;/);
  /* The canvas plays what it is asked, and nothing it does not know. */
  const bridge = read('app/[slug]/_components/editor-bridge.tsx');
  assert.match(bridge, /only === 'in' \|\| only === 'act' \|\| only === 'out' \? only : undefined,/);
});

test('(3) a hold is the whole page as a guest — it lets go of nothing, and Exit returns to the part and the page held', () => {
  /* THE PRESS: a timer; a release before it is a tap; the release after it is not. */
  assert.match(tools, /hold\.current\.timer = window\.setTimeout\(\(\) => \{\s*hold\.current\.timer = null;\s*hold\.current\.fired = true;\s*enterPreview\(\);\s*\}, STAGE_HOLD_MS\);/);
  assert.match(tools, /const play = \(\) => \{\s*if \(hold\.current\.fired\) \{\s*hold\.current\.fired = false;\s*return;\s*\}/, 'the release of a hold also plays');
  const bAt = tools.indexOf("aria-label={playing ? 'Stop'");
  const button = tools.slice(bAt, tools.indexOf('className={`${STAGE_ICON_BUTTON}', bAt));
  assert.ok(bAt > 0 && button.includes('data-stage-play=""'), 'anti-vacuity: ▶ was found');
  for (const h of ['onClick={play}', 'onPointerDown={holdStart}', 'onPointerUp={holdEnd}', 'onPointerLeave={holdEnd}', 'onPointerCancel={holdEnd}']) assert.ok(button.includes(h), `▶ lost ${h}`);
  assert.match(button, /hold, or press Shift and Enter, to preview the whole page/, 'a screen reader is not told of the hold');
  assert.doesNotMatch(button, /\sdisabled\b/);
  /* ENTERING lets go of nothing; the canvas is told. */
  const enter = /const enterPreview = useCallback\(\(\) => \{([\s\S]*?)\}, \[\]\);/.exec(tools)?.[1] ?? '';
  assert.match(enter, /before\.current = \{ picked: pickedRef\.current, page: where\.current\.shownPage \?\? null \};/);
  assert.match(enter, /postToCanvas\(\{ source: 'setnayan-editor', t: 'guest', on: true \}\);\s*setPreviewing\(true\);/);
  assert.doesNotMatch(enter, /setPicked|deselect|setTool/, 'the preview lets go of the part or the tool');
  /* The toolbar, the frame and the work area's tool step aside — and nothing picks or lets go while they walk. */
  assert.match(tools, /const away = typing \|\| playing \|\| previewing;/);
  assert.match(tools, /if \(playing \|\| typing \|\| previewing\) \{\s*onPx\(0\);/);
  assert.match(tools, /const open = \(openTool !== null \|\| revealOpen \|\| cameraOpen\) && !typing && !playing && !previewing;/);
  assert.match(tools, /picked: open && !cameraOpen \? picked : null,/, 'anti-vacuity: the frame follows `open`');
  assert.match(tools, /parts\.length === 0 \|\| typing \|\| playing \|\| previewing\) return;/, 'arriving on a page picks a part during the preview');
  assert.match(tools, /if \(tab && held && !previewingRef\.current && /, 'turning a page lets the held part go during the preview');
  assert.match(tools, /d\.t === 'tapOutside' && !previewingRef\.current\) deselectRef\.current\(\);/);
  assert.match(tools, /if \(!previewing\) askPage\(p\.key\);/);
  assert.match(tools, /\{guestBarHost && \(!away \|\| previewing\)/, 'the guests’ pages cannot be turned in the preview');
  /* EXIT PREVIEW — the ONE ActionButton, clear of the home bar and of the guests' bar. */
  const exitAt = tools.indexOf('data-stage-exit-preview=""');
  const exit = tools.slice(tools.lastIndexOf('{previewing && shellEl', exitAt), tools.indexOf('shellEl,', exitAt));
  assert.ok(exitAt > 0 && exit.length > 200, 'anti-vacuity: Exit preview was found');
  assert.equal((exit.match(/<ActionButton\b/g) ?? []).length, 1);
  assert.match(exit, /<ActionButton tone="brand" main icon=\{X\} label="Exit preview" onClick=\{exitPreview\}/);
  assert.doesNotMatch(exit, /<button\b/);
  assert.match(exit, /bottom: `calc\(env\(safe-area-inset-bottom\) \+ \$\{pages\.length > 1 && !rsvpOpen \? STAGE_EXIT_OVER_BAR_PX : STAGE_EXIT_GAP_PX\}px\)`/);
  assert.match(tools, /export const STAGE_EXIT_OVER_BAR_PX = 44 \+ STAGE_EXIT_GAP_PX;/, 'the button is not clear of the guests’ 44-px bar');
  /* THE WORK AREA'S TOOL GOES WITH THE TOOLBAR (seen on the review copy: it stayed on the page and covered "Exit
     preview") — hidden whenever the toolbar's root is away, by the root's own `aria-hidden`. */
  assert.match(tools, /aria-hidden=\{away \|\| undefined\}/, 'anti-vacuity: the toolbar’s root says when it is away');
  assert.ok(tools.includes(`'[data-maker-shell]:has([data-stage-tools][aria-hidden="true"]) [data-phone-chrome="panel"]{visibility:hidden;pointer-events:none}'`), 'the work area’s tool stays on the page while the toolbar is away');
  /* ⌨ THE KEYBOARD: Shift + Enter (or Space) on ▶ goes in; the one button takes the focus; Esc comes out. */
  assert.match(button, /aria-keyshortcuts="Shift\+Enter"/);
  assert.match(button, /onKeyDown=\{\(e\) => \{\s*if \(!e\.shiftKey \|\| \(e\.key !== 'Enter' && e\.key !== ' '\)\) return;\s*e\.preventDefault\(\);\s*hold\.current\.fired = true;\s*enterPreview\(\);/);
  assert.match(button, /press Shift and Enter/);
  assert.match(tools, /document\.querySelector<HTMLElement>\('\[data-stage-exit-preview\] button'\)\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(tools, /if \(e\.key === 'Escape'\) exitPreview\(\);/);
  /* 🧨 SEEN ON THE REVIEW COPY: every toast of the toolbar was in the page and INVISIBLE while the toolbar was away —
     it was drawn inside the toolbar, which slides off with a transform and takes a `fixed` child with it. The one
     toast is drawn on the page's body; and the Maker's top bar leaves for the preview as it does for ▶. */
  assert.match(tools, /\{why && typeof document !== 'undefined'\s*\? createPortal\(\s*<PeekToast key=\{why\.n\} tone="note" data="tool-why"[\s\S]{0,200}<\/PeekToast>,\s*document\.body,\s*\)/, 'the toolbar’s toast is drawn inside the toolbar');
  assert.equal((tools.match(/<PeekToast\b/g) ?? []).length, 1, 'a second toast of the toolbar’s, not on the body');
  assert.match(tools, /away \? 'pointer-events-none translate-y-\[110%\]' : ''/, 'anti-vacuity: the toolbar leaves by a transform');
  assert.match(tools, /shell\?\.setAttribute\('data-stage-previewing', ''\);[\s\S]{0,700}shell\?\.removeAttribute\('data-stage-previewing'\);/);
  assert.ok(tools.includes(`'[data-maker-shell]:is([data-stage-playing],[data-stage-previewing]) [data-phone-chrome="bar"]{transform:translateY(-110%);transition:transform 240ms ease-out}'`), 'the Maker’s top bar — Apply and all — stays on the guest’s page in the preview');
  /* LEAVING: the canvas gets its taps back, then the page and the part they held. */
  const leave = /const exitPreview = useCallback\(\(\) => \{([\s\S]*?)\}, \[\]\);/.exec(tools)?.[1] ?? '';
  assert.match(leave, /postToCanvas\(\{ source: 'setnayan-editor', t: 'guest', on: false \}\);\s*setPreviewing\(false\);/);
  assert.match(leave, /if \(page\) goToPageRef\.current\(page\.key, page\.option\);/);
  assert.match(leave, /if \(was\.picked\) window\.setTimeout\(\(\) => pickPartRef\.current\(was\.picked as MakerPartKey\)/);
  assert.match(tools, /useEffect\(\(\) => \(\) => postToCanvas\(\{ source: 'setnayan-editor', t: 'guest', on: false \}\), \[\]\);/, 'leaving the toolbar mid-preview leaves the canvas deaf');
  /* THE TWIN: the first tap says the hold exists — once. */
  assert.match(tools, /export const STAGE_HOLD_HINT = 'Hold ▶ to preview the whole page\.';/);
  assert.match(tools, /if \(!holdHintSaid\) \{\s*holdHintSaid = true;\s*setWhyRef\.current\(STAGE_HOLD_HINT\);\s*\}/);
});

test('(4) in the preview the canvas takes no tap — and a link that leaves, or a form being sent, is refused and said', () => {
  const bridge = read('app/[slug]/_components/editor-bridge.tsx');
  /* The canvas's own tap handler stands down BEFORE it would stop the page's. */
  const send = bridge.slice(bridge.indexOf('const send = (e: Event) => {'), bridge.indexOf("el.addEventListener('click', send);"));
  assert.ok(send.length > 400, 'anti-vacuity: the canvas’s tap handler was found');
  assert.ok(send.indexOf('if (guest.on) return;') > 0 && send.indexOf('if (guest.on) return;') < send.indexOf('e.preventDefault()'), 'the canvas still takes the tap first');
  assert.match(bridge, /const onStray = \(e: MouseEvent\) => \{\s*if \(guest\.on\) return;/);
  assert.match(bridge, /const onSelection = \(\) => \{\s*if \(guest\.on\) return;/);
  /* 🧨 SEEN ON THE REVIEW COPY (2026-10-09): the Maker's message names no section (`key`), and the canvas only read
     it AFTER the line that drops every keyless message — it never went into its preview and kept taking every tap.
     So: the message has no key, and the canvas answers it BEFORE that line. */
  assert.match(tools, /postToCanvas\(\{ source: 'setnayan-editor', t: 'guest', on: true \}\);/);
  const hears = bridge.indexOf("data.t === 'guest') {");
  const keyless = bridge.indexOf("typeof data.key !== 'string') return;");
  assert.ok(hears > 0 && keyless > 0 && hears < keyless, 'the canvas reads the preview’s message after it has dropped every message without a key');
  assert.match(bridge, /if \(data && data\.source === 'setnayan-editor' && data\.t === 'guest'\) \{\s*guest\.set\(\(data as \{ on\?: unknown \}\)\.on === true\);\s*return;/);
  assert.equal((bridge.match(/data\.t === 'guest'/g) ?? []).length, 1);
  /* Refused, in the capture phase, and SAID. */
  assert.match(bridge, /if \(a && guestLinkLeaves\(a\.href, a\.target, window\.location\.href\)\) refuse\(e, 'link'\);/);
  assert.match(bridge, /const onSubmit = \(e: Event\) => refuse\(e, 'send'\);/);
  assert.match(bridge, /document\.addEventListener\('click', onClick, true\);\s*document\.addEventListener\('submit', onSubmit, true\);/);
  assert.match(bridge, /e\.preventDefault\(\);\s*e\.stopPropagation\(\);\s*window\.parent\?\.postMessage\(\{ source: 'setnayan-site', t: 'guestRefused', what \}, origin\);/);
  assert.match(bridge, /cleanups\.push\(\(\) => set\(false\)\);/, 'a canvas torn down mid-preview keeps its listeners');
  assert.match(tools, /d\.t === 'guestRefused'/);
  assert.match(tools, /STAGE_PREVIEW_REFUSED = \{ link: 'Links are switched off in preview\.', send: 'Nothing is sent from a preview\.' \}/);
  /* EXECUTED — which links leave. The canvas lives at /cale-ice?editor=1&stage=invitation. */
  const here = 'https://setnayan.com/cale-ice?editor=1&stage=invitation';
  const stays = ['#rsvp', 'https://setnayan.com/cale-ice?editor=1&stage=invitation#schedule', '?editor=1&stage=invitation#top'];
  const leaves = ['/cale-ice/everyone', '/dashboard/1/launch', 'https://maps.google.com/?q=x', '/cale-ice', '?editor=1&stage=the-day', 'mailto:a@b.c', 'tel:+639', '//evil.example/cale-ice?editor=1&stage=invitation'];
  for (const h of stays) assert.equal(guestLinkLeaves(h, '', here), false, `${h} is on this page and was refused`);
  for (const h of leaves) assert.equal(guestLinkLeaves(h, '', here), true, `${h} leaves the page and was followed`);
  assert.equal(guestLinkLeaves('#rsvp', '_blank', here), true, 'a new tab is followed');
  assert.equal(guestLinkLeaves('#rsvp', '_top', here), true, 'the top window — the Maker — is navigated');
  assert.equal(guestLinkLeaves('#rsvp', '_self', here), false);
  assert.equal(guestLinkLeaves('http://[', '', here), true, 'an address that cannot be read is followed');
  /* Nothing of the editor is drawn in the preview. */
  const css = read('app/globals.css');
  assert.match(css, /html\[data-maker-guest\] \[data-maker-empty\] \{ display: none !important; \}/);
  assert.match(bridge, /document\.documentElement\.setAttribute\('data-maker-guest', ''\);/);
  assert.match(bridge, /document\.documentElement\.removeAttribute\('data-maker-guest'\);/);
});

test('(5) nothing new loads first — the preview’s pieces are the canvas bridge’s and the lazy toolbar’s', () => {
  const users = (needle: RegExp) => {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        const f = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(f);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && needle.test(readFileSync(join(WEB, f), 'utf8'))) out.push(f);
      }
    };
    for (const d of ['app', 'lib', 'components']) if (existsSync(join(WEB, d))) walk(d);
    return out.sort();
  };
  assert.deepEqual(users(/from '\.\/guest-in-canvas'|guest-in-canvas'/), ['app/[slug]/_components/editor-bridge.tsx']);
  assert.deepEqual(users(/from '\.\/play-sequence'|\/play-sequence'/), ['app/[slug]/_components/editor-bridge.tsx']);
  /* The toolbar itself is mounted lazily (`details-lazy.tsx`), never imported by a first-load file. */
  for (const f of [`${L}/maker-shell.tsx`, `${L}/details-workspace.tsx`, 'lib/hub-draft.ts', 'lib/hub-canvas.ts']) {
    assert.doesNotMatch(readFileSync(join(WEB, f), 'utf8'), /from '[^']*(?:stage-tools|play-sequence|guest-in-canvas)'/, `${f} imports the preview`);
  }
});
