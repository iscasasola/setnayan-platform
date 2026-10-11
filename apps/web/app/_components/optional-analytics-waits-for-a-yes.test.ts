/**
 * optional-analytics-waits-for-a-yes.test.ts — NOTHING OPTIONAL IS ON, OR EVEN LOADED, BEFORE A PERSON SAYS YES.
 *
 * Measured on the live guest page (2026-10-11): the cookie banner's "Manage" sheet opened with **Analytics already
 * ticked**. A visitor who opened it and pressed Save without touching the box was recorded as having consented.
 * The app's standing rule is the opposite — consent is something a person does (`app/signup/consent-is-affirmative
 * .test.ts`: "starts UNTICKED — affirmative consent, not pre-selected"; `lib/terms-agreement.ts`).
 *
 * Tracing what reads the choice found two more things the same rule covers:
 *   · the analytics provider's own "switch it off" effect LOADED the SDK to do so — and it runs for everyone who has
 *     not said yes, so every such visitor downloaded the analytics SDK on their first render;
 *   · four other places load the SDK to send one event each, and never asked the choice at all (the SDK, never
 *     started, dropped the event — but it was loaded).
 *
 * 🔑 THE PROPERTY:
 *   (1) the stored choice is a yes ONLY after a yes was written — never from nothing, a refusal or a broken value;
 *   (2) the one place the choice is written from offers the optional box UNTICKED, shows a stored choice as stored,
 *       and has exactly one control that writes a yes without the box: "Accept all";
 *   (3) EVERY place in the app that loads the analytics SDK asks the choice first — the list is derived from the
 *       code, so a fifth loader added tomorrow fails this until it asks.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { CONSENT_STORAGE_KEY, analyticsAllowed, hasDecidedConsent, readConsent, writeConsent } from '@/lib/cookie-consent';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/* ── A browser, as far as `lib/cookie-consent.ts` can tell ───────────────────────────────────────────────────── */
type Browser = { store: Map<string, string>; cookie: string; posted: unknown[] };
function browser(start: { localStorage?: string; cookie?: string } = {}): Browser {
  const b: Browser = { store: new Map(), cookie: '', posted: [] };
  if (start.localStorage !== undefined) b.store.set(CONSENT_STORAGE_KEY, start.localStorage);
  if (start.cookie !== undefined) b.cookie = `${CONSENT_STORAGE_KEY}=${encodeURIComponent(start.cookie)}`;
  const g = globalThis as Record<string, unknown>;
  g.window = {
    localStorage: { getItem: (k: string) => b.store.get(k) ?? null, setItem: (k: string, v: string) => void b.store.set(k, v) },
    dispatchEvent: () => true,
  };
  g.document = { get cookie() { return b.cookie; } };
  g.fetch = (_url: string, init: { body: string }) => { b.posted.push(JSON.parse(init.body)); return Promise.resolve(new Response(null, { status: 204 })); };
  return b;
}

test('(1) the stored choice is a yes only after a yes was written', () => {
  // A first visit: nothing stored anywhere.
  browser();
  assert.equal(readConsent(), null);
  assert.equal(hasDecidedConsent(), false, 'an undecided visitor reads as decided');
  assert.equal(analyticsAllowed(), false, 'analytics is allowed before anybody chose');

  // Everything that is not a stored yes is a no.
  const notAYes = ['', 'null', '{}', '{"analytics":"true"}', '{"analytics":1}', '{"analytics":null}', 'true', 'yes', '{"analytics":false,"decidedAt":"2026-01-01T00:00:00.000Z"}', '{broken'];
  for (const raw of notAYes) {
    for (const where of ['localStorage', 'cookie'] as const) {
      browser({ [where]: raw });
      assert.equal(analyticsAllowed(), false, `${where} holding ${JSON.stringify(raw)} was read as a yes`);
    }
  }

  // "Essential only", and a Save with the box unticked: a no is written and read back as a no.
  let b = browser();
  writeConsent(false);
  assert.equal(analyticsAllowed(), false);
  assert.equal(hasDecidedConsent(), true, 'a refusal must be remembered, or the banner asks for ever');
  assert.deepEqual(b.posted, [{ analytics: false }], 'the server cookie was not asked to remember the refusal');

  // A yes is a yes — and it is kept: a person who already chose keeps their stored choice.
  b = browser();
  writeConsent(true);
  assert.equal(analyticsAllowed(), true);
  assert.deepEqual(b.posted, [{ analytics: true }]);
  browser({ cookie: '{"analytics":true,"decidedAt":"2026-06-01T00:00:00.000Z"}' });
  assert.equal(analyticsAllowed(), true, 'a yes stored before this change is no longer honoured');
  // The server's cookie outranks the script's storage (Safari purges the latter): a later no beats an old yes.
  browser({ cookie: '{"analytics":false}', localStorage: '{"analytics":true}' });
  assert.equal(analyticsAllowed(), false);
});

test('(2) the banner — the ONE place the choice is written — offers the optional box unticked', () => {
  // One writer in the whole app: the banner's `choose`.
  const files = walk(['app', 'lib', 'components']);
  const writers = files.filter((f) => f !== 'lib/cookie-consent.ts' && /\bwriteConsent\(/.test(src(f)));
  assert.deepEqual(writers, ['app/_components/cookie-consent-banner.tsx'], 'a second place writes the cookie choice — read it against this test, then list it');

  const banner = src('app/_components/cookie-consent-banner.tsx');
  // The box's state: unticked until a stored choice says otherwise, at mount AND when re-opened.
  assert.match(banner, /const \[analytics, setAnalytics\] = useState\(false\);/, 'the optional box starts ticked');
  const sets = [...banner.matchAll(/setAnalytics\(((?:[^()]|\([^()]*\))*)\)/g)].map((m) => m[1]!.trim());
  assert.ok(sets.length >= 3, `only ${sets.length} places set the box — the scan went blind`);
  for (const value of sets) {
    assert.ok(
      value === 'e.target.checked' || /^(?:c|readConsent\(\))\?\.analytics \?\? false$/.test(value),
      `the box is set to \`${value}\` — it may only be the person's own tick, or the stored choice with NO as the fallback`,
    );
  }
  assert.doesNotMatch(banner, /analytics \?\? true/, 'an absent choice is read as a yes');
  assert.match(banner, /const onOpen = \(\) => \{\s*setAnalytics\(readConsent\(\)\?\.analytics \?\? false\);/, 're-opening the sheet does not show the choice as stored');
  assert.match(banner, /<input\s+type="checkbox"\s+checked=\{analytics\}\s+onChange=\{\(e\) => setAnalytics\(e\.target\.checked\)\}\s+aria-label="Analytics cookies"/, 'the box no longer shows the state measured above');

  // What each control writes: only "Accept all" writes a yes outright; "Essential only" writes a no; Save writes the box.
  const writes = [...banner.matchAll(/onClick=\{\(\) => choose\(([^)]+)\)\}((?:[^>]|=>)*)>\s*([A-Za-z ]+?)\s*</g)].map((m) => `${m[3]}:${m[1]}`);
  assert.deepEqual(writes.sort(), ['Accept all:true', 'Essential only:false', 'Save:analytics'], 'the controls that write the choice changed — read each one');
  // Closing the page, or leaving the sheet, writes nothing: a choice is written by those three presses and nowhere else.
  assert.match(banner, /const choose = \(a: boolean\) => \{\s*writeConsent\(a\);/);
  assert.equal([...banner.matchAll(/\bchoose\(/g)].length, 3, 'something besides the three buttons writes the choice');
  assert.equal([...banner.matchAll(/\bwriteConsent\(/g)].length, 1);
});

function walk(dirs: string[]): string[] {
  const go = (dir: string): string[] =>
    readdirSync(join(WEB, dir)).flatMap((name) => {
      const rel = `${dir}/${name}`;
      if (name === 'node_modules' || name.startsWith('.')) return [];
      if (statSync(join(WEB, rel)).isDirectory()) return go(rel);
      return /\.(?:tsx?|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [rel] : [];
    });
  return dirs.filter((d) => { try { return statSync(join(WEB, d)).isDirectory(); } catch { return false; } }).flatMap(go);
}

test('(3) every place that loads the analytics SDK asks the choice first — the list is derived from the code', () => {
  const files = walk(['app', 'lib', 'components']);
  assert.ok(files.length > 3000 && files.includes('app/_components/posthog-provider.tsx'), `anti-vacuity: walked ${files.length} files`);
  const SDK = /import\(\s*['"]posthog-js['"]\s*\)/g;
  const loaders = files.filter((f) => SDK.test(readFileSync(join(WEB, f), 'utf8')) && (SDK.lastIndex = 0, SDK.test(src(f))));
  SDK.lastIndex = 0;
  assert.ok(loaders.length >= 5, `only ${loaders.length} loaders found — the scan went blind (${loaders.join(', ')})`);
  // Never a static import of the SDK's code: that would ship it to everyone, consent or not.
  for (const f of files) {
    const s = readFileSync(join(WEB, f), 'utf8');
    if (!s.includes('posthog-js')) continue;
    assert.doesNotMatch(stripComments(s), /^import (?!type\b)[^;]*from ['"]posthog-js['"]/m, `${f} imports the analytics SDK statically`);
  }

  const PROVIDER = 'app/_components/posthog-provider.tsx';
  for (const f of loaders) {
    const s = src(f);
    if (f === PROVIDER) continue;
    for (const m of s.matchAll(/import\(\s*['"]posthog-js['"]\s*\)/g)) {
      // The gate stands before the load, inside the same function body.
      const before = s.slice(Math.max(0, m.index! - 700), m.index!);
      const body = before.slice(Math.max(before.lastIndexOf('function '), before.lastIndexOf('=> {'), 0));
      assert.match(body, /if \(!analyticsAllowed\(\)\) return;|if \(analyticsAllowed\(\)\) \{/, `${f} loads the analytics SDK without asking the choice first`);
    }
  }

  // The provider loads through ONE function; every caller of it has already been told yes.
  const provider = src(PROVIDER);
  assert.equal([...provider.matchAll(/import\(\s*['"]posthog-js['"]\s*\)/g)].length, 1, 'the provider loads the SDK from more than one place');
  const effects = provider.split(/useEffect\(/).filter((b) => /\bloadPostHog\(\)/.test(b) && !/^function loadPostHog/m.test(b.slice(0, 40)));
  const calls = effects.filter((b) => /void loadPostHog\(\)/.test(b));
  assert.ok(calls.length >= 3, `only ${calls.length} effects load the SDK — re-derive, do not lower this`);
  for (const b of calls) {
    const at = b.indexOf('void loadPostHog()');
    const gate = Math.max(b.lastIndexOf('if (!consentReady) return;', at), b.lastIndexOf('if (!analyticsAllowed()) return;', at));
    assert.ok(gate >= 0, `an effect loads the analytics SDK before a yes:\n${b.slice(0, 260)}`);
  }
  assert.equal([...provider.matchAll(/\bloadPostHog\(\)/g)].length - 1, calls.length, 'the SDK is loaded somewhere outside the checked effects');
  // `consentReady` is nothing but the stored choice, and starts as a no.
  assert.match(provider, /const \[consentReady, setConsentReady\] = useState\(false\);/);
  assert.match(provider, /const sync = \(\) => setConsentReady\(analyticsAllowed\(\)\);/);
  // Switching it off never loads it: the effect uses the module already in hand.
  const off = provider.split(/useEffect\(/).find((b) => /client\.opt_out_capturing\(\)/.test(b));
  assert.ok(off && /if \(consentReady\) return;/.test(off) && /const client = posthogModule;/.test(off) && !/loadPostHog\(\)/.test(off), 'the switch-off effect loads the SDK for every visitor who has not said yes');
});
