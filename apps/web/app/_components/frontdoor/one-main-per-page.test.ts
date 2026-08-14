import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ONE <main> PER PAGE — the shared rail must not bring a second landmark.
 *
 * ─── THE DEFECT THIS CLOSES ──────────────────────────────────────────────
 * `FrontDoorShell` renders the content column, and it was a `<main>` in BOTH
 * variants. On `/` that is right — the column IS the page's landmark. Inside
 * the app it is wrong, because every surface the rail wraps already renders
 * its own:
 *
 *   dashboard/(launcher)/layout.tsx   <main>{children}</main>
 *   dashboard/(account)/layout.tsx    <main>{children}</main>
 *   dashboard/[eventId]/layout.tsx    SidebarShell's `.sn-vt-page` <main>
 *
 * So every converted page shipped TWO nested `<main>` landmarks — invalid
 * HTML, and a duplicated landmark for anyone navigating by landmark. It was
 * introduced by One Shell slice 0 and copied by slice 1, and the slice-3
 * session named it in `DECISION_LOG.md` 2026-08-14 as something that "will
 * bite every tree that copies that shape". It did.
 *
 * ─── WHY IT SURVIVED ─────────────────────────────────────────────────────
 * 🔑 THE SAME FILE ALREADY GUARDED THE OTHER HALF OF THIS EXACT RULE. Its
 * sr-only `<h1>` is deliberately front-door-only, with a comment explaining
 * that a shared shell must not bring the host page's headings with it —
 * written for the 2026-08-13 "exactly one <h1> each" work. **The landmark
 * needed the identical rule and simply did not get it.** Nothing threw,
 * nothing rendered differently, and no screenshot could show it.
 *
 * 🔑 A DUPLICATE LANDMARK IS THE SAME DISEASE AS THE REJECTED QUERY: no
 * error, no visible symptom, and the only way to know is to go and count.
 * So this counts.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SHELL = join(HERE, 'front-door-shell.tsx');
const APP = join(HERE, '..', '..');
const HOSTS = [
  join(APP, 'dashboard', '(launcher)', 'layout.tsx'),
  join(APP, 'dashboard', '(account)', 'layout.tsx'),
  join(APP, 'dashboard', '[eventId]', 'layout.tsx'),
];

function read(p: string): string {
  return readFileSync(p, 'utf8');
}

/**
 * Source with comments removed.
 *
 * 🪤 THIS FILE'S FIRST RUN CRIED WOLF ON ITS OWN PROSE. Both `<main>` counts
 * went red against correct code, because these files TALK about `<main>` at
 * length — the shell's docblock explains the landmark rule and SidebarShell's
 * explains why its `<main>` carries `.sn-vt-page`. A guard that counts a
 * string counts it in the comments too, and a guard that fires on correct
 * code teaches you to skim past the one time it is right.
 */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
    .join('\n');
}

test('the anchor: the shell and every rail-wrapped layout exist', () => {
  for (const p of [SHELL, ...HOSTS]) {
    assert.ok(
      read(p).length > 500,
      `${p} is missing or a stub — every assertion below would pass vacuously.`,
    );
  }
});

test('the shared content column is a <main> only on the public front door', () => {
  const src = read(SHELL);
  assert.match(
    src,
    /const MainEl = inApp \? 'div' : 'main'/,
    'The content column must be a <div> in the app variant. As a <main> it is a ' +
      'SECOND landmark on every converted page, because each host surface ' +
      'already renders its own.',
  );
  /*
    Anchored on the ELEMENT, not on the variable's declaration alone — a
    declaration nothing uses is decoration, which is how a "fix" ships that
    changes nothing at all.
  */
  assert.match(
    src,
    /<MainEl className="fd-main"/,
    'The tag variable is declared but the element still hardcodes its tag, so ' +
      'the fix is inert.',
  );
  const hardcoded = code(src).match(/<main\b/g) ?? [];
  assert.equal(
    hardcoded.length,
    0,
    `front-door-shell.tsx still hardcodes ${hardcoded.length} literal <main> ` +
      'element(s); the column tag must come from the variant.',
  );
});

test('each rail-wrapped layout still renders exactly one landmark of its own', () => {
  /*
    THE OTHER HALF. Making the shell yield its <main> is only correct while the
    host actually has one — otherwise these pages would end up with NONE, which
    is a different accessibility bug wearing the fix's clothes. So both halves
    are asserted together and neither can be "tidied" alone.
  */
  for (const p of HOSTS) {
    const src = read(p);
    const opens = (code(src).match(/<main\b/g) ?? []).length;
    const viaShell = /<SidebarShell\b/.test(src);
    assert.ok(
      opens === 1 || viaShell,
      `${p} renders ${opens} <main> element(s) and does not delegate to ` +
        'SidebarShell. With the shell now yielding its landmark, this page ' +
        'would have NO main landmark at all.',
    );
  }
});

test('SidebarShell still carries the landmark for the trees that delegate to it', () => {
  const shell = read(join(APP, '_components', 'nav', 'sidebar-shell.tsx'));
  const opens = (code(shell).match(/<main\b/g) ?? []).length;
  assert.equal(
    opens,
    1,
    `SidebarShell must render exactly one <main>; found ${opens}. The event ` +
      'tree relies on it for both its landmark AND the `.sn-vt-page` name the ' +
      "phone's page-slide animates.",
  );
});
