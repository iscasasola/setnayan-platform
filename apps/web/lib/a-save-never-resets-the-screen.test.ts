/**
 * 📍 A SAVE NEVER RESETS THE SCREEN — APP-WIDE (owner, 2026-10-26, DECISION_LOG row of that name, verbatim:
 * *"saving minimum and maximum on papic resets the whole screen. this should not happen"* · *"and same to the rest of
 * the buttons and functions"* · *"same to the rest of the website. avoid resetting the whole screen"*).
 *
 * A server action that ends in `redirect(<the same screen>)` re-draws the page from the top when a plain
 * `<form action>` posts it. The fix is one shared shape: `StayForm` (`app/_components/stay-form.tsx`) → the door
 * (`app/_actions/save-in-place.ts`) → the same action, its redirect read as an answer (`lib/save-in-place.ts`).
 *
 *   (1) RATCHET — every redirecting action (`lib/stay-ratchet.ts`, a TypeScript-AST scan) is a door, navigation with a
 *       reason (`stay-ratchet.navigation.ts`), or in the baseline of the not-yet-converted — and that baseline may only
 *       SHRINK: a new redirecting action fails here, and so does a baseline line that no longer redirects.
 *   (2) a door's action is never posted by a bare `<form action>` / a plain `<ConfirmForm>` (use `StayConfirmForm`) —
 *       that would follow the redirect again, the door notwithstanding;
 *   (3) the registry is the allow-list: every `lib/stay-doors.ts` name has exactly one action, named by it; an invented
 *       name is refused before anything runs; the limited-helper gate runs first, with the SAME area the action's own
 *       gate names;
 *   (4) the answer: saved → in place; refused → said; signed out / not on the event / off the screen → navigates;
 *   (5) no NEW whole-page reload (`location.reload()`) or push to the page you are on — each one left is listed with
 *       why it is not a save.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { STAY_DOORS } from './stay-doors';
import { eventScreen, inPlaceAnswer, NOTHING_CHANGED, supplierScreen } from './save-in-place';
import { STAY_NAVIGATION } from './stay-ratchet.navigation';
import {
  DOOR_FILE,
  WEB,
  doorActions,
  namedImports,
  readBaseline,
  redirectingActions,
  registryFiles,
  scanRedirecting,
  sourceFiles,
} from './stay-ratchet';

const found = scanRedirecting();
const doors = doorActions();
const baseline = readBaseline();

test('(1a) the scan reads the tree — it is not passing because it found nothing', () => {
  assert.ok(found.length > 300, `only ${found.length} redirecting actions found — the scan is not reading the tree`);
  assert.ok(doors.size >= 30, `only ${doors.size} door actions resolved from the registry`);
  /* A known still-redirecting door, a known navigation, and a known baseline line — each must be SEEN. */
  assert.ok(found.includes('app/dashboard/[eventId]/sponsors/actions.ts › addSponsor'), 'the scan no longer sees a known redirect');
  assert.ok(doors.has('app/dashboard/[eventId]/sponsors/actions.ts › addSponsor'), 'the registry no longer resolves its imports');
  assert.ok(found.includes('app/vendor-dashboard/branches/actions.ts › createBranch'), 'the scan no longer sees a known navigation');
});

test('(1b) every action that re-draws the screen is a door, navigation, or not-yet-converted — nothing NEW', () => {
  const fresh = found.filter((k) => !doors.has(k) && !(k in STAY_NAVIGATION) && !baseline.includes(k));
  assert.deepEqual(
    fresh,
    [],
    'A new server action REDIRECTS — a plain form posting it re-draws the whole screen. Return a result, or register it ' +
      'as a door (lib/stay-doors/<area>.ts + app/_actions/stay-registry/<area>.ts) and post it with `<StayForm door=…>`. ' +
      'If moving to another screen IS the point, add it to STAY_NAVIGATION with the reason. Never add it to the baseline.',
  );
});

test('(1c) the baseline only SHRINKS — a converted or deleted action leaves it', () => {
  const stale = baseline.filter((k) => !found.includes(k) || doors.has(k) || k in STAY_NAVIGATION);
  assert.deepEqual(stale, [], 'These no longer re-draw the screen (or are doors / navigation now) — run `pnpm tsx lib/stay-ratchet.ts --write`.');
  assert.equal(new Set(baseline).size, baseline.length, 'a baseline line is listed twice');
  const staleNav = Object.keys(STAY_NAVIGATION).filter((k) => !found.includes(k));
  assert.deepEqual(staleNav, [], 'These navigation entries no longer redirect — take them off STAY_NAVIGATION.');
  for (const [k, why] of Object.entries(STAY_NAVIGATION)) assert.ok(why.trim().length >= 8, `${k} is navigation with no reason`);
  const navDoors = Object.keys(STAY_NAVIGATION).filter((k) => doors.has(k));
  assert.deepEqual(navDoors, [], 'an action cannot be both navigation and a stay door');
});

test('(1d) the scanner tells a landing from a guard', () => {
  const src = (body: string) => `'use server';\nimport { redirect } from 'next/navigation';\n${body}`;
  assert.deepEqual(redirectingActions('x.ts', src(`export async function a(fd: FormData) { if (!fd) redirect('/login'); redirect('/dashboard'); }`)), []);
  assert.deepEqual(redirectingActions('x.ts', src(`export async function a(e: string) { redirect(\`/dashboard/\${e}/guests?saved=1\`); }`)), ['a']);
  /* through a same-file helper (`backToList`, `back()`), and via an arrow export */
  assert.deepEqual(redirectingActions('x.ts', src(`function back(p: string) { redirect(p); }\nexport const b = async () => { back('/x'); };`)), ['b']);
  assert.deepEqual(redirectingActions('x.ts', `import { redirect } from 'next/navigation';\nexport async function a() { redirect('/x'); }`), [], 'not a server module');
});

/** Every `.tsx` that imports a door action, with the local names it binds. */
function doorPosters(): { rel: string; code: string; local: string[] }[] {
  const out: { rel: string; code: string; local: string[] }[] = [];
  for (const rel of sourceFiles().filter((f) => f.endsWith('.tsx'))) {
    const text = readFileSync(join(WEB, rel), 'utf8');
    if (!/\bimport\b/.test(text)) continue;
    const local = [...namedImports(rel, text)].filter(([, k]) => doors.has(k)).map(([name]) => name);
    if (local.length) out.push({ rel, code: stripComments(text), local });
  }
  return out;
}

test('(2) a door action is never posted by a bare form — it would follow the redirect again', () => {
  const posters = doorPosters();
  const bare: string[] = [];
  for (const { rel, code, local } of posters) {
    for (const m of code.matchAll(/<(form|ConfirmForm|SafeForm)\b([^>]*?)\b(action|formAction)=\{\(?\s*([A-Za-z_$][\w$]*)/g)) {
      if (local.includes(m[4]!)) bare.push(`${rel} › <${m[1]} ${m[3]}={${m[4]}}>`);
    }
    /* `<button formAction={x}>` inside a StayForm would post past the door too. */
    for (const m of code.matchAll(/<(button|SubmitButton|input)\b[^>]*?\bformAction=\{\(?\s*([A-Za-z_$][\w$]*)/g)) {
      if (local.includes(m[2]!)) bare.push(`${rel} › <${m[1]} formAction={${m[2]}}>`);
    }
    /* A client component that CALLS the action itself (`removeSponsor(fd)`) follows its redirect too — call
       `saveInPlace('<door>', fd)` instead. */
    if (/^\s*['"]use client['"]/.test(code)) {
      for (const name of local) {
        if (new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}\\(`).test(code)) bare.push(`${rel} › ${name}(…) called directly`);
      }
    }
  }
  assert.ok(posters.length >= 12, `only ${posters.length} files post a door action — the sweep is not reading them`);
  assert.deepEqual(bare, [], 'These forms post a door action without the door — the screen resets on every press. Make each a `<StayForm door=…>` (a confirm-first one: `<StayConfirmForm door=…>`).');
});

/** Every `'<area>.<name>': <kind>(<maybe onEvent(>name…` row across the registry's area files. */
function registryRows(): { file: string; door: string; kind: string; fn: string; src: string }[] {
  const rows: { file: string; door: string; kind: string; fn: string; src: string }[] = [];
  for (const file of registryFiles()) {
    const src = stripComments(readFileSync(join(WEB, file), 'utf8'));
    for (const m of src.matchAll(/^\s*'([\w]+\.[\w]+)':\s*(\w+)\((?:onEvent\()?(\w+)/gm)) rows.push({ file, door: m[1]!, kind: m[2]!, fn: m[3]!, src });
  }
  return rows;
}

/** The area an action's OWN first limited-helper gate names (`refuseLimitedHelper(x, 'photos')`), or `undefined`. */
function ownGateArea(fileRel: string, fn: string): string | null | undefined {
  const src = stripComments(readFileSync(join(WEB, fileRel), 'utf8'));
  const at = src.search(new RegExp(`export (?:async function ${fn}\\b|const ${fn}\\s*=)`));
  if (at < 0) return undefined;
  const next = src.indexOf('\nexport ', at + 10);
  const body = src.slice(at, next < 0 ? undefined : next);
  const g = /(?:refuseLimitedHelper|limitedHelperRefusal)\([^,]+,\s*('[\w]+'|null)\s*\)/.exec(body);
  return g ? (g[1] === 'null' ? null : g[1]!.slice(1, -1)) : undefined;
}

test('(3) the registry is the allow-list — each name runs the action it names; the gate runs first, on the action\'s own area', () => {
  const rows = registryRows();
  assert.deepEqual(rows.map((r) => r.door).sort(), [...STAY_DOORS].sort(), 'the registry and lib/stay-doors.ts disagree');
  for (const r of rows) assert.equal(r.door.split('.')[1], r.fn, `door ${r.door} runs ${r.fn} — a door's name is the action it runs`);
  const door = stripComments(readFileSync(join(WEB, DOOR_FILE), 'utf8'));
  assert.match(door, /if \(!isStayDoor\(door\) \|\| !Object\.hasOwn\(DOORS, door\)\) return \{ ok: false/, 'an unknown door name is no longer refused first');
  assert.match(door, /if \(answer === 'navigate'\) throw e;/, 'a redirect that must navigate is swallowed');
  /* 🔒 the limited-helper gate runs BEFORE the action */
  assert.match(door, /if \(area !== false\) \{\s*const eventId/, 'the event gate is skipped for more than the no-event doors');
  const gate = door.indexOf('await limitedHelperRefusal(');
  assert.ok(gate > -1 && gate < door.indexOf('await run(formData)'), 'the door runs an action before asking the limited-helper gate');
  assert.match(door, /if \(helperRefusal\) return \{ ok: false, error: helperRefusal \};/, "a limited helper's refusal is not said");
  /* …with the SAME area the action's own gate names (whose area `every-action-refuses-a-limited-helper.test.ts` pins). */
  const wrong: string[] = [];
  for (const r of rows) {
    const kindArea = new RegExp(`const ${r.kind} = kind(?:Read)?\\([^\\n]*, ('[\\w]+'|null|false)\\);`).exec(r.src)?.[1];
    assert.ok(kindArea, `${r.file}: door kind ${r.kind} names no area`);
    const target = namedImports(r.file).get(r.fn);
    assert.ok(target, `${r.file}: ${r.fn} is not imported`);
    const [fileRel] = target.split(' › ');
    if (!fileRel!.startsWith('app/dashboard/[eventId]/')) continue;
    /* An event's write never skips the event gate. */
    if (kindArea === 'false') {
      wrong.push(`${r.door}: an event action's door skips the limited-helper gate`);
      continue;
    }
    const own = ownGateArea(fileRel!, r.fn);
    if (own === undefined) continue; /* a server-only helper with no gate of its own (Papic's chapter doors) */
    const want = own === null ? 'null' : `'${own}'`;
    if (kindArea !== want) wrong.push(`${r.door}: the door gates on ${kindArea}, the action on ${want}`);
  }
  assert.deepEqual(wrong, [], 'A door asks the limited-helper gate about a different area than its action does.');
  const form = stripComments(readFileSync(join(WEB, 'app/_components/stay-form.tsx'), 'utf8'));
  assert.match(form, /const onSubmit = \(e: FormEvent<HTMLFormElement>\) => \{\s*e\.preventDefault\(\);/, 'the stay form lets the browser submit — and follow the redirect');
  assert.match(form, /save: StaySave = saveInPlace\)/, 'the stay form no longer saves through the door by default');
  assert.match(form, /await save\(door, fd\)/);
  assert.match(form, /role="alert"[^>]*data-stay-error/, 'a refusal is not said on the row');
  assert.match(form, /action=\{action as/, 'the plain action is no longer the no-JavaScript path');
});

test('(4) a redirect is read as an answer — saved, refused (said), or let through', () => {
  const memories = { within: [eventScreen('memories')] };
  assert.deepEqual(inPlaceAnswer('/dashboard/e1/memories?hidden=1', memories), { ok: true });
  assert.deepEqual(inPlaceAnswer('/dashboard/e1/schedule#emcee-picks', { within: [eventScreen('schedule')] }), { ok: true });
  assert.deepEqual(inPlaceAnswer('/dashboard/e1/memories?error=hide_failed', memories), { ok: false, error: NOTHING_CHANGED });
  assert.deepEqual(inPlaceAnswer('/dashboard/e1/memories?vendorMedia=error', memories), { ok: false, error: NOTHING_CHANGED });
  assert.deepEqual(inPlaceAnswer('/dashboard/e1/x?error=Nope', { within: ['/dashboard/'], refuse: (q) => q.get('error') }), { ok: false, error: 'Nope' });
  assert.deepEqual(inPlaceAnswer('/vendor-dashboard/calendar?cal_err=busy', { within: [supplierScreen('calendar')], say: { busy: 'Busy.' } }), { ok: false, error: 'Busy.' });
  /* a gate's "not a couple on this event" bounce must NEVER read as saved */
  assert.equal(inPlaceAnswer('/dashboard/e1', memories), 'navigate');
  assert.equal(inPlaceAnswer('/dashboard', { within: ['/dashboard'] }), 'navigate');
  assert.equal(inPlaceAnswer('/vendor-dashboard', { within: ['/vendor-dashboard'] }), 'navigate');
  assert.equal(inPlaceAnswer('/login?next=/dashboard/e1', { within: ['/'] }), 'navigate');
  assert.equal(inPlaceAnswer('/pay/ABC', memories), 'navigate');
});

/**
 * (5) A WHOLE-PAGE RELOAD AFTER A SAVE resets the screen just as a redirect does. Each one left in the tree is listed
 * here with why it is not a save. `router.refresh()` is NOT one: it re-renders the server parts in place and keeps the
 * scroll and every open sheet — it is how a save stays in place.
 */
const RELOAD_ALLOWED: Readonly<Record<string, string>> = {
  'app/[slug]/_components/provider-stall.tsx': 'a stalled sign-in provider: "Try again", and a page restored from the back cache',
  'app/_components/account-switcher/account-switcher.tsx': 'another account signed in in another tab — the page belongs to someone else now',
  'app/_components/last-seen/last-seen-mark.tsx': '"Try again" on a read that failed',
  'app/_components/offline-ready/use-offline-copy.ts': 'the offline copy finished — the new build is loaded',
  'app/_components/stale-tab-notice.tsx': '"Reload" on a tab whose build is gone',
  'app/dashboard/[eventId]/_components/day-of-mode/schedule-unread.tsx': '"Try again" on an unread schedule',
  'app/dashboard/[eventId]/_components/home-parts.tsx': '"Try again" with no router (router.refresh() otherwise)',
  'app/dashboard/[eventId]/_components/home-tile.tsx': '"Try again" with no router (router.refresh() otherwise)',
  'app/dashboard/[eventId]/guests/_components/guest-copy-mark.tsx': '"Try again" on the guest copy',
  'app/dashboard/[eventId]/launch/_components/details-look-pages.tsx': 'reloads the PREVIEW frame, not the page',
  'app/dashboard/[eventId]/launch/_components/maker-reveal.tsx': 'reloads the PREVIEW frame, not the page',
  'app/dashboard/[eventId]/story/_components/make-it-yours.tsx': '"Try again" on a failed read',
  'app/dashboard/[eventId]/studio/photo-delivery/_components/release-progress-poller.tsx': 'a long release finished on the server — not a press',
  'app/dashboard/[eventId]/website/editor/_components/buffered-canvas-frame.tsx': 'reloads the PREVIEW frame, not the page',
  'app/error.tsx': 'the error screen: a new deployment or a stale bundle',
  'app/global-error.tsx': 'the error screen: a new deployment or a stale bundle',
  'app/open-shop/_components/open-shop-wizard.tsx': '"Tap Reload to keep going" on a new build — the draft is saved first',
  'app/papic/guest/_components/papic-guest-capture.tsx': '"Try again" when the camera failed to start',
  'app/papic/seat/[token]/_components/papic-seat-capture.tsx': '"Try again" when the camera failed to start',
  'app/vendor-dashboard/shop/_components/portfolio-form.tsx': '"Retry" on an unread shop wallet (moved, unchanged, out of gallery-media.tsx)',
  'lib/stale-bundle.ts': 'recoverStaleTab(): an out-of-date tab hit a missing chunk — reload once onto the new build (every error boundary)',
  'lib/stylesheet-recovery.ts': 'a stylesheet failed to load — the page is unstyled',
};

test('(5) no NEW whole-page reload or push to the page you are on', () => {
  const hits = new Set<string>();
  for (const rel of sourceFiles()) {
    if (rel.startsWith('app/admin/')) continue;
    const code = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    if (/\blocation\.reload\(\)/.test(code) || /\brouter\.(?:push|replace)\(\s*(?:pathname|window\.location\.pathname)\s*\)/.test(code)) hits.add(rel);
  }
  assert.ok(hits.size >= 10, `only ${hits.size} reloads found — the sweep is not reading the tree`);
  const fresh = [...hits].filter((r) => !(r in RELOAD_ALLOWED)).sort();
  assert.deepEqual(fresh, [], 'A whole-page reload resets the screen. After a save, let the action revalidate (or call router.refresh()) instead; if this reload is not after a save, list it in RELOAD_ALLOWED with why.');
  const stale = Object.keys(RELOAD_ALLOWED).filter((r) => !hits.has(r));
  assert.deepEqual(stale, [], 'These no longer reload — take them off RELOAD_ALLOWED.');
});
