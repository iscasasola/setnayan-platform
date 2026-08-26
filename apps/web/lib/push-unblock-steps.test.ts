/**
 * GUARD — a blocked device is given a way out, and the screen notices when it
 * is taken.
 *
 * ⚠ WHAT THIS PROTECTS. `Notification.requestPermission()` opens a dialog
 * exactly once per device. After a denial it resolves to 'denied' with NO
 * prompt, forever, and no code we can write re-opens it. So for a blocked
 * person the instructions ARE the feature — if they are wrong, generic, or
 * absent, the alert channel is simply closed and nothing says why.
 *
 * 🛡 Every rule mutation-checked by occurrence count before → after.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { unblockSteps } from './push-unblock-steps';

const TOGGLE = readFileSync(
  join(__dirname, '..', 'app', '_components', 'push-toggle.tsx'),
  'utf8',
);
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const TOGGLE_CODE = code(TOGGLE);

const UA = {
  chromeMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
  chromeWin:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
  edgeWin:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 Edg/128.0',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  firefoxMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:129.0) Gecko/20100101 Firefox/129.0',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36',
};

test('ANCHOR — the component source was read', () => {
  assert.ok(TOGGLE.length > 2000, `push-toggle.tsx read as ${TOGGLE.length} chars`);
});

test('1 · every device family gets real, ordered steps — never an empty shrug', () => {
  const empties: string[] = [];
  for (const [name, userAgent] of Object.entries(UA)) {
    for (const standalone of [true, false]) {
      const g = unblockSteps({ userAgent, standalone });
      if (g.steps.length < 2) empties.push(`${name}/${standalone}: ${g.steps.length} step(s)`);
      if (!g.platform.trim()) empties.push(`${name}/${standalone}: no platform name`);
    }
  }
  assert.deepEqual(empties, [], 'a blocked person with no steps has no way back in');
});

test('2 · an unknown or missing user agent still gets usable steps', () => {
  // The fallback is the whole safety net for UA sniffing being unreliable.
  for (const userAgent of ['', 'something nobody has ever shipped']) {
    const g = unblockSteps({ userAgent });
    assert.ok(g.steps.length >= 2, `"${userAgent}" produced ${g.steps.length} steps`);
  }
});

test('3 · the steps name the right place for the device', () => {
  // Each family is told about ITS OWN control. Getting this wrong is worse than
  // the generic fallback: it sends somebody hunting for a button that is not there.
  const wants: [string, string, RegExp][] = [
    ['chromeMac', UA.chromeMac, /left of the web address/i],
    ['edgeWin', UA.edgeWin, /left of the web address/i],
    ['safariMac', UA.safariMac, /Websites/],
    ['firefoxMac', UA.firefoxMac, /Blocked/i],
    ['androidChrome', UA.androidChrome, /Permissions/],
  ];
  const wrong: string[] = [];
  for (const [name, userAgent, re] of wants) {
    const joined = unblockSteps({ userAgent }).steps.join(' ');
    if (!re.test(joined)) wrong.push(`${name}: steps do not mention ${re}`);
  }
  assert.deepEqual(wrong, [], 'the instructions must match the device in front of the reader');
});

test('4 · Edge and Safari are not mistaken for Chrome', () => {
  // Every Chromium UA carries "chrome" and every iOS UA carries "safari", so a
  // naive includes() check mislabels both. Order of the branches is the fix.
  assert.equal(unblockSteps({ userAgent: UA.edgeWin }).platform, 'Edge');
  assert.equal(unblockSteps({ userAgent: UA.chromeWin }).platform, 'Chrome');
  assert.equal(unblockSteps({ userAgent: UA.safariMac }).platform, 'Safari on Mac');
});

test('5 · iPhone is told the truth: web push needs the installed app', () => {
  const inSafari = unblockSteps({ userAgent: UA.iphone, standalone: false });
  assert.match(
    inSafari.steps.join(' '),
    /Home Screen/,
    'in Safari on iOS there is no permission to grant — the way in is installing it',
  );
  const installed = unblockSteps({ userAgent: UA.iphone, standalone: true });
  assert.match(
    installed.steps.join(' '),
    /Settings/,
    'once installed the switch lives in iOS Settings, not in the browser',
  );
  assert.notDeepEqual(
    inSafari.steps,
    installed.steps,
    'installed and not-installed are different problems and must not share steps',
  );
});

test('6 · Mac gets the second, silent gate named', () => {
  // Allowing the site and still hearing nothing because macOS is swallowing
  // them is the commonest "I did it and it does not work".
  for (const ua of [UA.chromeMac, UA.safariMac, UA.firefoxMac]) {
    assert.match(
      unblockSteps({ userAgent: ua }).systemNote ?? '',
      /System Settings/,
      'a Mac reader must be told about the OS-level gate',
    );
  }
  assert.equal(
    unblockSteps({ userAgent: UA.chromeWin }).systemNote,
    undefined,
    'and Windows must NOT be told to open a Mac settings app',
  );
});

test('7 · the toggle still asks only on a deliberate press', () => {
  assert.match(TOGGLE_CODE, /Notification\.requestPermission/);
  assert.ok(
    !/useEffect\([^)]*\)\s*=>\s*\{[^}]*requestPermission/.test(TOGGLE_CODE),
    'never prompt on first paint — that is the pattern browsers punish with a silent permanent block',
  );
});

test('8 · the switch NOTICES when the device is unblocked elsewhere', () => {
  /*
    The regression this exists for: resolve the permission once on mount, and
    somebody follows the steps perfectly, returns, and finds the switch still
    dead — so they conclude the feature is broken. Unblocking always happens on
    another screen, so the component has to look again.
  */
  assert.match(
    TOGGLE_CODE,
    /visibilitychange/,
    'must re-check when the tab is looked at again — that is the moment somebody returns from settings',
  );
  assert.match(
    TOGGLE_CODE,
    /navigator\.permissions/,
    'must subscribe to permission changes where the browser offers it',
  );
  assert.match(
    TOGGLE_CODE,
    /removeEventListener/,
    'and must unsubscribe — a listener left behind outlives the screen',
  );
});

test('9 · each tree is promised what IT actually gets', () => {
  // The shared component was born on the couple profile and carried its copy
  // into the admin console, promising the operator vendor messages.
  /*
    🪤 REV 1 OF THIS RULE WAS DECORATION AND A MUTATION SAID SO. It asserted
    that PROMISE existed and that all three keys were written — and replacing
    the render's `PROMISE[audience]` with a hardcoded `PROMISE.vendor`, which
    puts vendor copy back on the admin console, left it GREEN. A map that
    nothing indexes is three sentences nobody reads. **A grep cannot tell a
    name appearing from a name being USED.**
  */
  assert.match(
    TOGGLE_CODE,
    /PROMISE\[\s*audience\s*\]/,
    'the render must index the promise BY the audience prop, not pick one for everybody',
  );
  assert.match(TOGGLE_CODE, /audience\s*=\s*'couple'/, 'the default audience must be explicit');
  for (const aud of ['admin', 'couple', 'vendor']) {
    assert.ok(
      new RegExp(`${aud}:`).test(TOGGLE_CODE),
      `no promise written for the ${aud} tree`,
    );
  }
  assert.ok(
    !/'Get alerted on this device when a vendor messages you or a new inquiry comes in — even when the app is closed\.'\s*\}/.test(
      TOGGLE_CODE,
    ),
    'the single hardcoded vendor sentence must not be the fallback for all three trees',
  );
});


test('10 · the vendor card can both enable and disable, and still shows the way out', () => {
  /*
    ⚠ THE VENDOR SURFACE IS NOT THE SHARED TOGGLE. `vendor-dashboard/notifications`
    imports its OWN card, and typecheck is what proved it — passing the shared
    toggle's `audience` prop there failed to compile, which is the only reason
    the difference surfaced at all. My own note had already claimed that file
    was "mounted nowhere"; it is mounted, and a grep whose --include flag had
    errored is where that false claim came from.

    That card USED TO defer entirely to the layout's registrar banner for
    enabling, which dead-ended once the vendor dismissed that banner (30-day
    cooldown) or it was hidden for any other reason — the card said "Allow via
    banner below" pointing at nothing on screen. It now enables inline, through
    the same registerPushToken('web') path the registrar uses, so either one
    can turn the device on and `deactivateAllPushTokens` can always turn it back
    off. It is still NOT replaced with the shared toggle, because it owns
    something the shared one does not: `deactivateAllPushTokens`, a SERVER-side
    switch-off across every device the vendor has registered. Swapping it would
    delete that inverse.
  */
  const src = code(
    readFileSync(
      join(__dirname, '..', 'app', 'vendor-dashboard', 'notifications', 'push-toggle.tsx'),
      'utf8',
    ),
  );
  assert.match(src, /unblockSteps/, 'the vendor card must offer the way out too');
  assert.match(
    src,
    /guide\.steps\.map/,
    'it must RENDER the steps, not merely compute them',
  );
  assert.match(
    src,
    /deactivateAllPushTokens/,
    'and it must keep the server-side switch-off — that is why it was not replaced',
  );
  assert.match(
    src,
    /registerPushToken/,
    'it must be able to enable inline, not only point at a banner that may be hidden',
  );
  assert.doesNotMatch(
    src,
    /Allow via banner below/,
    'the dead-end enable copy must not come back',
  );
});
