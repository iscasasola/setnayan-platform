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
 *   dashboard/[eventId]/layout.tsx    <main className="sn-vt-page">
 *
 * (That third one read `SidebarShell's .sn-vt-page <main>` until 2026-08-15,
 * when the shell was deleted and the layout took the element over directly.)
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
 * length — the shell's docblock explains the landmark rule, and every layout's
 * explains why its content element carries `.sn-vt-page`. A guard that counts a
 * string counts it in the comments too, and a guard that fires on correct
 * code teaches you to skim past the one time it is right.
 *
 * 🪤 AND IT HAPPENED AGAIN IN A SIBLING (2026-08-15). `nav-badges.test.ts`
 * sliced a JSX element from the first `<Tag` it found and was anchored onto a
 * SENTENCE naming that tag, added by the SidebarShell retirement. It reported
 * that the phone had lost its badge counts, which was false. Same lesson, a
 * different file, four weeks later — so that stripper is this one, copied, not
 * re-invented.
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
    /const MainEl = \w+ \? 'div' : 'main'/,
    'The content column must be a <div> wherever the HOST page renders its own ' +
      '<main>. As a <main> it is a SECOND landmark on every such page.\n' +
      '🪤 This used to pin the literal `inApp ? ...`. When a THIRD variant ' +
      '(doorway) arrived, `inApp` became one of four named questions and this ' +
      'guard went red against a more correct shell. It now matches the RULE — ' +
      'the tag comes from a boolean — not the boolean\'s name.',
  );
  /*
    Anchored on the ELEMENT, not on the variable's declaration alone — a
    declaration nothing uses is decoration, which is how a "fix" ships that
    changes nothing at all.
  */
  /*
    🪤 AND THIS PINNED A LITERAL TOO — the SECOND time in one file (2026-08-15).
    It matched `<MainEl className="fd-main"` exactly, so when the shell gained
    an opt-in full-bleed column and the class became
    `className={bleed ? 'fd-main fd-bleed' : 'fd-main'}`, the guard went red
    against code that satisfies its intent perfectly. The intent is: the ELEMENT
    uses the tag variable, and it is still the content column. Neither of those
    is a claim about how the class attribute is spelled.
  */
  const mainEl = /<MainEl\b[\s\S]{0,200}?>/.exec(src);
  assert.ok(
    mainEl,
    'The tag variable is declared but no element uses it, so the fix is inert.',
  );
  assert.match(
    mainEl[0],
    /\bfd-main\b/,
    'The <MainEl> element is no longer the `fd-main` content column.',
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

    ⚠ THE `viaShell` ESCAPE HATCH IS GONE, AND SO IS THE DELEGATION IT ALLOWED.
    Two of these three used to hand their landmark to `<SidebarShell>`; that
    component was deleted on 2026-08-15 and each layout now renders the <main>
    itself, on the element carrying `.sn-vt-page`. So the rule is simply the
    count — no tree delegates any more, and none may go back to it without
    something to delegate to.
  */
  for (const p of HOSTS) {
    const opens = (code(read(p)).match(/<main\b/g) ?? []).length;
    assert.equal(
      opens,
      1,
      `${p} renders ${opens} <main> element(s). The shared shell yields its ` +
        'landmark inside the app, so ZERO leaves this page with none at all, ' +
        'and TWO is the nested-landmark defect this file was written for.',
    );
  }
});

test('the landmark and the page-slide name are the same element in every tree', () => {
  /*
    ⚠ THIS REPLACES 'SidebarShell still carries the landmark…'. The shell
    carried BOTH jobs on one `<main>`, and when it was deleted they could have
    been split across two elements without any error: the landmark on one, the
    view-transition name on another. That still renders, still validates, and
    still slides — so nothing would have said it was wrong.

    Keeping them fused is what makes "did this tree keep its landmark?" and
    "did this tree keep its page-slide?" one question with one answer. The
    admin tree is deliberately not in HOSTS: it carries `.sn-vt-page` on a
    plain <div> and has no <main> of its own — a real gap, named here rather
    than quietly normalised, and NOT a licence to copy that shape.
  */
  for (const p of HOSTS) {
    const src = code(read(p));
    if (!/\bsn-vt-page\b/.test(src)) continue;
    assert.match(
      src,
      /<main className="sn-vt-page"/,
      `${p} carries \`.sn-vt-page\` on something that is not its <main>. The ` +
        'landmark and the element the phone slides must be the same one.',
    );
  }
});
