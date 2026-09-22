/**
 * 🔒 THE PAGE WEARS THE THEME THE COUPLE PICKED FOR THEIR DOOR — one material,
 * one resolver, on every guest surface.
 *
 * Owner, 2026-09-22: *"we have event hub themes"*, then: the Event Hub pages
 * wear the same one. Five themes existed (`lib/invite-themes.ts`, 2026-09-10)
 * and stopped at `/[slug]/invite`; carrying them onto the pages behind that door
 * created three ways for the two surfaces to disagree, and EVERY ONE IS SILENT:
 *
 *   1 · THE MATERIAL FORKS. Pearl, velvet, wall and kraft used to be declared
 *       inside the door's `.module.css`. They had to move out — the site cannot
 *       import those files (`themes-stay-skins.test.ts`, and rightly: no theme
 *       may reach the shared chunk) — so they now live once in globals.css
 *       under `[data-invite-theme='x'], [data-hub-theme='x']`. If either
 *       surface starts re-declaring one, the door and the page drift a shade
 *       apart and both look fine on their own.
 *   2 · THE DOOR STOPS STAMPING ITS ATTRIBUTE. The material is keyed on it now.
 *       Drop `data-invite-theme` and every `var(--cz-*)` in the door's skin
 *       resolves to nothing — an UNPAINTED door, from a change to a file that
 *       never mentions colour.
 *   3 · THE GATE GETS A SECOND OPINION. A Pro theme needs the unlock live NOW
 *       and a celebration type that carries the Save-the-Date film, and either
 *       can lapse after the couple saved. Two copies of that means House on the
 *       door and Capiz on the page — each passing its own tests.
 *
 * None of the three is visible to a type-checker, and none fails a render test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { INVITE_THEME_IDS } from '@/lib/invite-themes';

const WEB = join(import.meta.dirname, '..', '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(WEB, ...p), 'utf8');

const CSS = read('app', 'globals.css');
const DOOR_DIR = join(WEB, 'app', '[slug]', 'invite', '_components', 'themes');
const SITE_DIR = join(WEB, 'app', '[slug]', '_components', 'skins');

/** Every theme that actually paints — House is the bare page by design. */
const PAINTED = INVITE_THEME_IDS.filter((id) => id !== 'house');

/** The material prefix each theme's tokens use. */
const PREFIX: Record<string, string> = {
  capiz: 'cz',
  velvet: 'vl',
  galeriya: 'ga',
  abaca: 'ab',
};

/**
 * Tokens that describe DOORSHELL, not the theme — its `px-4`, its `p-6`, the
 * gap its rule stands at. They belong in the door's own module and must NOT be
 * hauled into the shared block: a page has no such card, and a shared value
 * named for one would be read as a page measurement by the next person.
 */
const DOOR_GEOMETRY = new Set([
  '--ga-pad',
  '--ga-card-pad',
  '--ga-rule-gap',
  '--ga-print-h',
  '--ab-card-pad',
]);

test('every painted theme has a material block, and BOTH surfaces are on it', () => {
  for (const id of PAINTED) {
    const block = new RegExp(
      `\\[data-invite-theme='${id}'\\],\\s*\\n\\[data-hub-theme='${id}'\\] \\{`,
    );
    assert.match(
      CSS,
      block,
      `${id}: the material block must name BOTH selectors — drop the door's and ` +
        'its skin renders unpainted, from a change that never mentions colour',
    );
  }
});

test('neither surface re-declares a material token', () => {
  for (const [dir, label] of [
    [DOOR_DIR, 'door'],
    [SITE_DIR, 'site'],
  ] as const) {
    const sheets = readdirSync(dir).filter((f) => f.endsWith('.module.css'));
    assert.ok(sheets.length >= 4, `${label}: found ${sheets.length} theme stylesheets, expected 4+`);
    for (const sheet of sheets) {
      const src = stripComments(readFileSync(join(dir, sheet), 'utf8'));
      const declared = [...src.matchAll(/^\s*(--(?:cz|vl|ga|ab)-[a-z-]+)\s*:/gm)].map((m) => m[1]!);
      const forked = declared.filter((d) => !DOOR_GEOMETRY.has(d));
      assert.deepEqual(
        forked,
        [],
        `${label}/${sheet} declares material (${forked.join(', ')}) — it belongs once in ` +
          'globals.css, shared with the other surface, or the two drift a shade apart',
      );
    }
  }
});

test('every material token a stylesheet USES is one the shared block declares', () => {
  // The other direction, and the one that renders as nothing rather than as
  // drift: a `var(--cz-whatever)` nobody declares is simply an empty value.
  const declared = new Set(
    [...CSS.matchAll(/^\s*(--(?:cz|vl|ga|ab)-[a-z-]+)\s*:/gm)].map((m) => m[1]!),
  );
  for (const [dir, label] of [
    [DOOR_DIR, 'door'],
    [SITE_DIR, 'site'],
  ] as const) {
    for (const sheet of readdirSync(dir).filter((f) => f.endsWith('.module.css'))) {
      const src = stripComments(readFileSync(join(dir, sheet), 'utf8'));
      for (const m of src.matchAll(/var\((--(?:cz|vl|ga|ab)-[a-z-]+)/g)) {
        const token = m[1]!;
        assert.ok(
          declared.has(token) || DOOR_GEOMETRY.has(token),
          `${label}/${sheet} reads ${token}, which nothing declares — it renders as empty`,
        );
      }
    }
  }
});

test('a channel companion is the same colour as the hex beside it', () => {
  // CSS cannot turn a hex into the space-separated channels `rgb(var(x) / a)`
  // needs, so the shared block states some colours twice. That is the ONE place
  // the second representation is allowed, and this is what stops it drifting.
  const hexes = new Map<string, string>();
  for (const m of CSS.matchAll(/^\s*(--(?:cz|vl|ga|ab)-[a-z-]+):\s*(#[0-9a-fA-F]{6});/gm)) {
    hexes.set(m[1]!, m[2]!.toLowerCase());
  }
  const companions = [
    ...CSS.matchAll(/^\s*(--(?:cz|vl|ga|ab)-[a-z-]+)-ch:\s*(\d+) (\d+) (\d+);/gm),
  ];
  assert.ok(companions.length >= 8, `found ${companions.length} channel companions, expected 8+`);
  for (const m of companions) {
    const source = m[1]!;
    const hex = hexes.get(source);
    assert.ok(hex, `${source}-ch has no ${source} hex beside it to agree with`);
    const n = parseInt(hex.slice(1), 16);
    assert.deepEqual(
      [m[2], m[3], m[4]].map(Number),
      [(n >> 16) & 255, (n >> 8) & 255, n & 255],
      `${source}-ch does not match ${source} (${hex}) — the page and the door would paint two colours`,
    );
  }
});

test('the door still stamps the attribute its own material is keyed on', () => {
  const shell = stripComments(read('app', '_components', 'door', 'door-shell.tsx'));
  assert.match(
    shell,
    /data-invite-theme=\{skin\?\.themeId\}/,
    'DoorShell no longer stamps data-invite-theme — every door skin renders unpainted',
  );
  for (const id of PAINTED) {
    const src = stripComments(readFileSync(join(DOOR_DIR, `${id}.tsx`), 'utf8'));
    assert.match(
      src,
      new RegExp(`themeId:\\s*'${id}'`),
      `${id}.tsx does not return its own themeId — its door would paint as another theme, or not at all`,
    );
  }
});

test('the page has exactly one opinion about which theme is live', () => {
  // The gate is an orders lookup plus a profile read, and both can lapse after
  // the couple saved. A second copy means House on the door and Capiz on the
  // page, with each surface passing its own suite.
  for (const rel of [
    ['app', '[slug]', '_components', 'site-body.tsx'],
    ['app', '[slug]', '_components', 'private-landing.tsx'],
    ['app', '[slug]', 'recap', 'page.tsx'],
    ['app', '[slug]', 'pabuya', 'page.tsx'],
    ['app', '[slug]', 'invite', '_lib', 'load-invite-look.ts'],
  ]) {
    const src = stripComments(read(...rel));
    assert.match(
      src,
      /resolveHubLook/,
      `${rel.join('/')} does not go through resolveHubLook`,
    );
    /*
      🪤 NARROWED, AND THE FIRST VERSION WAS WRONG IN THE EXPENSIVE DIRECTION.
      It also banned `eventCoupleWebsiteProActive` and `resolveWeddingOnlyParts`
      — the two reads the gate is BUILT from — and went red on correct code:
      `site-body.tsx` has called `resolveWeddingOnlyParts` for the Save-the-Date
      film fence since long before themes existed, and the watermark check has
      its own legitimate Pro read. Banning the INGREDIENTS convicts every other
      dish that uses them.

      `resolveInviteTheme` is the decision itself, and there is exactly one
      honest reason to call it: to be the gate. So that is the ban, and the
      positive assertion above (every one of these files goes through
      `resolveHubLook`) is what carries the real weight.
    */
    assert.doesNotMatch(
      src,
      /resolveInviteTheme\b/,
      `${rel.join('/')} calls resolveInviteTheme directly — that is the second opinion about ` +
        'which theme is live, and it renders as House on the door and Capiz on the page',
    );
  }
});

test('every guest <main> wears the theme, and House wears nothing', () => {
  for (const rel of [
    ['app', '[slug]', '_components', 'invitation-shell.tsx'],
    ['app', '[slug]', 'recap', 'page.tsx'],
    ['app', '[slug]', 'pabuya', 'page.tsx'],
  ]) {
    const src = stripComments(read(...rel));
    const mains = (src.match(/<main\b/g) ?? []).length;
    const stamps = (src.match(/data-hub-theme=\{/g) ?? []).length;
    assert.ok(mains > 0, `${rel.join('/')} has no <main> — this guard is looking at nothing`);
    assert.equal(
      stamps,
      mains,
      `${rel.join('/')} has ${mains} <main> but stamps ${stamps} — a half-themed page reads ` +
        'as a broken theme, and the un-wired branch is usually the full-bleed Save-the-Date film',
    );
  }
  // House must resolve to `undefined`, never to the string: React omits an
  // undefined attribute entirely, which is what makes an unthemed event's DOM
  // byte-identical to before this shipped.
  const shell = stripComments(read('app', '[slug]', '_components', 'invitation-shell.tsx'));
  assert.match(shell, /hubTheme !== 'house'/, 'the shell does not exclude House from painting');
  assert.match(shell, /skin \? hubTheme \?\? undefined : undefined/, 'House would stamp an attribute');
});

test('the shared block gives House nothing to wear', () => {
  assert.doesNotMatch(
    CSS,
    /\[data-hub-theme='house'\]/,
    "House owns a CSS block — it is the page as it renders today, and a block for it " +
      'means the default has started overriding itself',
  );
});

test('the opaque paper yields to the ground — or the theme renders as nothing', () => {
  /*
    🔴 THE BUG THIS EXISTS FOR WAS FOUND BY LOOKING, NOT BY A TEST. The shell's
    `<main>` carries `bg-cream`, which is OPAQUE, and the theme's ground is a
    FIXED layer beneath it. Paint both and the ground is invisible on every
    page — and nothing else notices: the attribute is stamped, the material
    resolves, every token is right, the tests pass, and a couple who paid for
    Velvet gets a white page.

    The spatial-backdrop path has always dropped `bg-cream` for exactly this
    reason. This asserts a skin gets the same treatment on BOTH render branches,
    because the full-bleed one is the Save-the-Date film — the first thing most
    guests ever see.
  */
  const src = stripComments(read('app', '[slug]', '_components', 'invitation-shell.tsx'));
  /*
    🪤 SLICED TO THE TAG'S OWN `>`, NOT BY A CHARACTER BUDGET. The first attempt
    capped each opening tag at 400 characters and found ONE of the two — the
    other tag is longer than that, so the guard silently measured half the file
    and then failed on its own arithmetic rather than on the property. A window
    sized by a guess is a guard that fails where it is hardest to read.
  */
  const mains = [...src.matchAll(/<main\b/g)].map((m) => {
    const end = src.indexOf('>', m.index);
    assert.ok(end > 0, 'an unterminated <main> — re-anchor this guard rather than deleting it');
    return src.slice(m.index, end + 1);
  });
  assert.equal(mains.length, 2, `expected 2 <main> branches, found ${mains.length}`);
  for (const [i, main] of mains.entries()) {
    assert.ok(
      /bg-cream/.test(main),
      `branch ${i}: no bg-cream at all — this guard is looking at the wrong thing`,
    );
    assert.match(
      main,
      /\bskin\b[^`]*\?\s*'relative'\s*:\s*'bg-cream'/,
      `branch ${i} paints bg-cream regardless of the skin — it is opaque and sits ON the ` +
        "ground, so the theme would render as nothing while every other assertion here passes",
    );
  }
});
