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
 *   (2) a door's action is never posted by a bare `<form action>` / a plain `<ConfirmForm>` (use `StayConfirmForm`) — that would follow the
 *       redirect again, the door notwithstanding;
 *   (3) the registry is the allow-list: every `lib/stay-doors.ts` name has exactly one action (the type does that at
 *       compile time; this holds the name ↔ action pairing), and an invented name is refused before anything runs;
 *   (4) the answer: saved → in place; refused → said; signed out / not on the event / off the screen → navigates.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { STAY_DOORS } from './stay-doors';
import { inPlaceAnswer, NOTHING_CHANGED } from './save-in-place';
import { STAY_NAVIGATION } from './stay-ratchet.navigation';
import {
  DOOR_FILE,
  WEB,
  doorActions,
  namedImports,
  readBaseline,
  redirectingActions,
  scanRedirecting,
  sourceFiles,
} from './stay-ratchet';

const found = scanRedirecting();
const doors = doorActions();
const baseline = readBaseline();

test('(1a) the scan reads the tree — it is not passing because it found nothing', () => {
  assert.ok(found.length > 300, `only ${found.length} redirecting actions found — the scan is not reading the tree`);
  assert.ok(doors.size >= 30, `only ${doors.size} door actions resolved from ${DOOR_FILE}`);
  /* A known still-redirecting action, a known navigation, and a converted door — each must be SEEN. */
  assert.ok(found.includes('app/dashboard/[eventId]/sponsors/actions.ts › addSponsor'), 'the scan no longer sees a known redirect');
  assert.ok(doors.has('app/dashboard/[eventId]/sponsors/actions.ts › addSponsor'), 'the door no longer resolves its imports');
});

test('(1b) every action that re-draws the screen is a door, navigation, or not-yet-converted — nothing NEW', () => {
  const fresh = found.filter((k) => !doors.has(k) && !(k in STAY_NAVIGATION) && !baseline.includes(k));
  assert.deepEqual(
    fresh,
    [],
    'A new server action REDIRECTS — a plain form posting it re-draws the whole screen. Return a result, or register it ' +
      'as a door (lib/stay-doors.ts + app/_actions/save-in-place.ts) and post it with `<StayForm door=…>`. If moving to ' +
      'another screen IS the point, add it to STAY_NAVIGATION with the reason. Never add it to the baseline.',
  );
});

test('(1c) the baseline only SHRINKS — a converted or deleted action leaves it', () => {
  const stale = baseline.filter((k) => !found.includes(k) || doors.has(k) || k in STAY_NAVIGATION);
  assert.deepEqual(stale, [], 'These no longer re-draw the screen (or are doors / navigation now) — run `pnpm tsx lib/stay-ratchet.ts --write`.');
  assert.equal(new Set(baseline).size, baseline.length, 'a baseline line is listed twice');
  const staleNav = Object.keys(STAY_NAVIGATION).filter((k) => !found.includes(k));
  assert.deepEqual(staleNav, [], 'These navigation entries no longer redirect — take them off STAY_NAVIGATION.');
  for (const [k, why] of Object.entries(STAY_NAVIGATION)) assert.ok(why.trim().length >= 8, `${k} is navigation with no reason`);
});

test('(1d) the scanner tells a landing from a guard', () => {
  const src = (body: string) => `'use server';\nimport { redirect } from 'next/navigation';\n${body}`;
  assert.deepEqual(redirectingActions('x.ts', src(`export async function a(fd: FormData) { if (!fd) redirect('/login'); redirect('/dashboard'); }`)), []);
  assert.deepEqual(redirectingActions('x.ts', src(`export async function a(e: string) { redirect(\`/dashboard/\${e}/guests?saved=1\`); }`)), ['a']);
  /* through a same-file helper (`backToList`, `back()`), and via an arrow export */
  assert.deepEqual(redirectingActions('x.ts', src(`function back(p: string) { redirect(p); }\nexport const b = async () => { back('/x'); };`)), ['b']);
  assert.deepEqual(redirectingActions('x.ts', `import { redirect } from 'next/navigation';\nexport async function a() { redirect('/x'); }`), [], 'not a server module');
});

test('(2) a door action is never posted by a bare form — it would follow the redirect again', () => {
  const bare: string[] = [];
  let checked = 0;
  for (const rel of sourceFiles().filter((f) => f.endsWith('.tsx'))) {
    const text = readFileSync(join(WEB, rel), 'utf8');
    if (!/\bimport\b/.test(text)) continue;
    const imports = namedImports(rel, text);
    const local = [...imports].filter(([, k]) => doors.has(k)).map(([name]) => name);
    if (!local.length) continue;
    checked++;
    if (!/<(form|ConfirmForm)\b/.test(text)) continue;
    const code = stripComments(text);
    for (const m of code.matchAll(/<(form|ConfirmForm)\b([^>]*?)\b(action|formAction)=\{\(?\s*([A-Za-z_$][\w$]*)/g)) {
      /* A form that owns its submit and saves through `useStaySubmit` says so on its tag (`data-stay=`). */
      const tag = code.slice(m.index!, code.indexOf('>', m.index! + m[0].length));
      if (local.includes(m[4]!) && !/\bdata-stay=/.test(tag)) bare.push(`${rel} › <${m[1]} action={${m[4]}}>`);
    }
  }
  assert.ok(checked >= 12, `only ${checked} files post a door action — the sweep is not reading them`);
  assert.deepEqual(bare, [], 'These forms post a door action without the door — the screen resets on every press. Make each a `<StayForm door=…>` (a confirm-first one: `<StayConfirmForm door=…>`).');
});

test('(3) the registry is the allow-list — each name runs the action it names, an invented name runs nothing', () => {
  const src = stripComments(readFileSync(join(WEB, DOOR_FILE), 'utf8'));
  const body = src.slice(src.indexOf('const DOORS'), src.indexOf('\n};', src.indexOf('const DOORS')));
  const rows = [...body.matchAll(/^\s*'([\w.]+)':\s*(?:\w+\()?(?:on(?:Event|Guest)\()?(?:\{ run: )?(?:\(fd\) =>\s*)?(\w+)/gm)];
  assert.deepEqual(rows.map((r) => r[1]).sort(), [...STAY_DOORS].sort(), 'the registry and lib/stay-doors.ts disagree');
  for (const r of rows) assert.equal(r[1]!.split('.')[1], r[2], `door ${r[1]} runs ${r[2]} — a door's name is the action it runs`);
  assert.match(src, /if \(!isStayDoor\(door\) \|\| !Object\.hasOwn\(DOORS, door\)\) return \{ ok: false/, 'an unknown door name is no longer refused first');
  assert.match(src, /if \(answer === 'navigate'\) throw e;/, 'a redirect that must navigate is swallowed');
  /* 🔒 the limited-helper gate runs BEFORE the action, with the area `AREA_RULES` gives it
     (`app/dashboard/[eventId]/every-action-refuses-a-limited-helper.test.ts`). */
  const gate = src.indexOf('await limitedHelperRefusal(');
  assert.ok(gate > -1 && gate < src.indexOf('await run(formData)'), 'the door runs an action before asking the limited-helper gate');
  assert.match(src, /if \(helperRefusal\) return \{ ok: false, error: helperRefusal \};/, 'a limited helper\'s refusal is not said');
  const AREA: Record<string, string> = { papic: "'photos'", memories: "'photos'", schedule: "'schedule'", sponsors: 'null', guests: "'guest_list'", hosts: 'null', review: 'null', invitation: "'invitations'", guest: "'guest'", account: "'account'" };
  for (const [kind, area] of Object.entries(AREA)) {
    assert.match(src, new RegExp(`const ${kind} = \\(run[^\\n]*area: ${area} \\}\\);`), `${kind} doors no longer gate on ${area}`);
  }
  for (const r of rows) assert.ok(new RegExp(`'${r[1]!.replace('.', '\\.')}': (papic|memories|schedule|sponsors|guests|hosts|review|invitation|guest|account)\\(`).test(body), `door ${r[1]} names no gated area`);
  const form = stripComments(readFileSync(join(WEB, 'app/_components/stay-form.tsx'), 'utf8'));
  assert.match(form, /const onSubmit = \(e: FormEvent<HTMLFormElement>\) => \{\s*e\.preventDefault\(\);/, 'the stay form lets the browser submit — and follow the redirect');
  assert.match(form, /const realDoor: StayDoorFn = \(door, fd\) => saveInPlace\(door, fd\);/, 'the app no longer saves through the real door');
  assert.match(form, /const r = await send\(door, fd, action\);/, 'the stay form no longer sends through the door');
  assert.match(form, /role="alert"[^>]*data-stay-error/, 'a refusal is not said on the row');
  assert.match(form, /action=\{action as/, 'the plain action is no longer the no-JavaScript path');
});

test('(4) a redirect is read as an answer — saved, refused (said), or let through', () => {
  const memories = { within: [/^\/dashboard\/[^/]+\/memories$/] };
  assert.deepEqual(inPlaceAnswer('/dashboard/e1/memories?hidden=1', memories), { ok: true });
  assert.deepEqual(inPlaceAnswer('/dashboard/e1/schedule#emcee-picks', { within: [/^\/dashboard\/[^/]+\/schedule$/] }), { ok: true });
  assert.deepEqual(inPlaceAnswer('/dashboard/e1/memories?error=hide_failed', memories), { ok: false, error: NOTHING_CHANGED });
  assert.deepEqual(inPlaceAnswer('/dashboard/e1/x?error=Nope', { refuse: (q) => q.get('error') }), { ok: false, error: 'Nope' });
  /* a gate's "not a couple on this event" bounce must NEVER read as saved */
  assert.equal(inPlaceAnswer('/dashboard/e1', memories), 'navigate');
  assert.equal(inPlaceAnswer('/dashboard'), 'navigate');
  assert.equal(inPlaceAnswer('/login?next=/dashboard/e1'), 'navigate');
  assert.equal(inPlaceAnswer('/pay/ABC'), 'navigate');
});
