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
import { INVITE_THEME_IDS, INVITE_THEMES } from '@/lib/invite-themes';

const WEB = join(import.meta.dirname, '..', '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(WEB, ...p), 'utf8');

const CSS = read('app', 'globals.css');
const DOOR_DIR = join(WEB, 'app', '[slug]', 'invite', '_components', 'themes');
const SITE_DIR = join(WEB, 'app', '[slug]', '_components', 'skins');

/** Every theme that actually paints — House is the bare page by design. */
/*
  PAINTED = what actually reaches a pixel, which is NOT "everything but house".

  🔑 THIS LINE USED TO BE AN EXCLUSION LIST, and an exclusion list is a guard
  that breaks on the next registration rather than on the next defect. The day
  four more registers were added — `minimalist`, `fairytale`, `vintage`,
  `custom`, all `ready: false`, all drawing nothing — this test went red
  demanding a material block for a door that cannot be opened. The registry was
  right and the guard's window was wrong.

  ✅ So it reads `ready` instead. A theme nobody can select renders no surface,
  so a missing material block for it is not a defect; `house` is excluded
  because it is Setnayan's own door and wears no material.

  🔒 AND THE RATCHET STILL CLOSES — this is the half that matters. `ready` is
  what the picker offers, so the moment a skin is switched on, PAINTED grows and
  every assertion below starts demanding its material block, its token prefix
  and its pair count. You cannot ship a selectable door that renders unpainted;
  you can only register one that renders nothing at all.
*/
const PAINTED = INVITE_THEME_IDS.filter((id) => id !== 'house' && INVITE_THEMES[id].ready);

/*
  DOORS = the invite-door COMPOSITIONS the painted themes open through
  (`INVITE_THEMES[id].door`, 2026-09-25). Ten themes, four compositions: the
  door's material is keyed on the composition, the page's on the theme. So the
  door assertions below iterate DOORS, and the page assertions PAINTED.
*/
const DOORS: string[] = [...new Set(PAINTED.map((id) => INVITE_THEMES[id].door))].filter((d) => d !== 'house');

/** Every `[data-hub-theme='id'] { … }` body — the SITE's reading of a material. */
function cssBlocksFor(id: string): string[] {
  const out: string[] = [];
  for (const m of CSS.matchAll(new RegExp(`\\[data-hub-theme='${id}'\\][^{]*\\{([^}]*)\\}`, 'g'))) {
    out.push(m[1] ?? '');
  }
  return out;
}

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

test('🔒 PAINTED tracks the picker, and an unready theme really is unpaintable', () => {
  // The guard above narrowed from "every id but house" to "every READY id but
  // house". That narrowing is only safe while these two hold, so they are
  // asserted rather than assumed.
  assert.ok(PAINTED.length >= 4, `only ${PAINTED.length} painted themes — the narrowing ate one`);
  assert.ok(!PAINTED.includes('house' as (typeof PAINTED)[number]), 'house wears no material');
  for (const id of INVITE_THEME_IDS) {
    if (PAINTED.includes(id)) continue;
    if (id === 'house') continue;
    // An unready theme must be unready in the REGISTRY, not merely absent from
    // a list here — otherwise this exemption becomes the exclusion list again.
    assert.equal(INVITE_THEMES[id].ready, false, `${id} is offered to couples but not painted`);
  }
});

test('every door composition has a material block, and every painted theme a page block', () => {
  assert.ok(DOORS.length >= 4, `only ${DOORS.length} door compositions in use`);
  for (const id of DOORS) {
    assert.match(
      CSS,
      new RegExp(`\\[data-invite-theme='${id}'\\][^{]*\\{`),
      `${id}: the door's material block is gone — its skin renders unpainted, from a change ` +
        'that never mentions colour',
    );
  }
  for (const id of PAINTED) {
    assert.ok(cssBlocksFor(id).length >= 1, `${id} is offered to couples but paints no page block`);
  }
});

test('neither surface re-declares a material token', () => {
  for (const [dir, label] of [
    [DOOR_DIR, 'door'],
    [SITE_DIR, 'site'],
  ] as const) {
    const sheets = readdirSync(dir).filter((f) => f.endsWith('.module.css'));
    // The door keeps its four compositions; the site has none since 2026-09-25
    // (its ground is the scope's: the theme loop under the page's own paper).
    if (label === 'door') assert.ok(sheets.length >= 4, `door: found ${sheets.length} theme stylesheets, expected 4+`);
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
  for (const id of DOORS) {
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
  /*
    `recap/page.tsx` and `pabuya/page.tsx` LEFT this list on 2026-09-25: they no
    longer decide a theme at all — `[slug]/layout.tsx` wears it for every page
    (`every-guest-page-wears-the-theme.test.ts`), through `loadGuestLook` in
    `_lib/loaders.ts`, which took their place here. `resolveHubTheme` is the
    same gate as `resolveHubLook` without the reveal photo, so either counts.
  */
  for (const rel of [
    ['app', '[slug]', '_components', 'site-body.tsx'],
    ['app', '[slug]', '_components', 'private-landing.tsx'],
    ['app', '[slug]', '_lib', 'loaders.ts'],
    ['app', '[slug]', 'invite', '_lib', 'load-invite-look.ts'],
  ]) {
    const src = stripComments(read(...rel));
    assert.match(
      src,
      /resolveHubLook|resolveHubTheme/,
      `${rel.join('/')} does not go through resolveHubLook / resolveHubTheme`,
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

test('every guest page wears the theme from ONE stamp, and House wears nothing', () => {
  /*
    🔁 RESHAPED 2026-09-25, NOT RELAXED. This used to count one `data-hub-theme`
    stamp per `<main>` in the shell, the recap and the money gift — and that was
    exactly why the other nine guest pages never wore a theme: the property was
    held per page, so a page nobody listed was never asked. The owner's ruling
    (*"yes place it there"*) moved the stamp to `[slug]/layout.tsx`, which wraps
    every page. So the assertion inverts: the pages must stamp NOTHING (a second
    stamp below the layout's inline palette would let the theme beat the
    couple's own colours), and the one stamp must be the scope's. The full
    structural guard — every page inside the scope, the door exempted only by
    proof — is `app/[slug]/every-guest-page-wears-the-theme.test.ts`.
  */
  for (const rel of [
    ['app', '[slug]', '_components', 'invitation-shell.tsx'],
    ['app', '[slug]', 'recap', 'page.tsx'],
    ['app', '[slug]', 'pabuya', 'page.tsx'],
  ]) {
    const src = stripComments(read(...rel));
    assert.ok(/<main\b/.test(src), `${rel.join('/')} has no <main> — this guard is looking at nothing`);
    assert.doesNotMatch(
      src,
      /data-hub-theme=\{/,
      `${rel.join('/')} stamps data-hub-theme again — the layout already wears it for every page`,
    );
  }
  // House must resolve to `undefined`, never to the string: React omits an
  // undefined attribute entirely, which is what makes an unthemed event's DOM
  // byte-identical to before this shipped.
  const scope = stripComments(read('app', '[slug]', '_components', 'guest-look-scope.tsx'));
  assert.match(scope, /data-hub-theme=\{worn && theme \? theme : undefined\}/, 'House would stamp an attribute');
  const loaders = stripComments(read('app', '[slug]', '_lib', 'loaders.ts'));
  assert.match(loaders, /theme: hub\.theme === 'house' \? null : hub\.theme/, 'House reaches the scope as a theme');
  const shell = stripComments(read('app', '[slug]', '_components', 'invitation-shell.tsx'));
  assert.match(shell, /hubTheme !== 'house'/, 'the shell does not exclude House from painting');
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
    // `themed` since 2026-09-25: the shell no longer builds a skin (the layout
    // wears the look and lays the ground), it only needs to know a theme is on.
    assert.match(
      main,
      /\bthemed\b[^`]*\?\s*'relative'\s*:\s*'bg-cream'/,
      `branch ${i} paints bg-cream regardless of the skin — it is opaque and sits ON the ` +
        "ground, so the theme would render as nothing while every other assertion here passes",
    );
  }
});

test('every theme keeps its text readable on BOTH the ground and the plates', () => {
  /*
    🔴 THE DEFECT THIS EXISTS FOR SHIPPED IN THIS BRANCH AND WAS FOUND BY LOOKING
    AT A SCREEN, not by any test here.

    Velvet's first mapping took the skin's near-black ink onto a light ground —
    correct for its PLATES, and catastrophic for every chapter heading and
    eyebrow, which sit on the ground. Near-black on near-black. The plates
    rendered perfectly the whole time, so a thumbnail looked right and eight
    other assertions in this file stayed green.

    🪤 THE FIRST VERSION OF THIS GUARD WAS A PHRASING RULE — "a theme that moves
    --color-ink must also declare --color-ink-on-plate" — and it convicted ABACA,
    which is correct: its ground and its plates share one dark ink because both
    its papers are light. A rule about which DECLARATIONS are present cannot tell
    the difference. So this measures the two contrasts instead, which is the
    thing that actually has to be true and is what would have caught Velvet.
  */
  const material = new Map<string, string>();
  for (const m of CSS.matchAll(/^\s*(--(?:cz|vl|ga|ab)-[a-z-]+(?:-ch)?):\s*([^;]+);/gm)) {
    material.set(m[1]!, m[2]!.trim());
  }

  /** `251 248 243`, or `var(--vl-paper-ch)` resolved one level into the material. */
  function channels(raw: string | undefined, where: string): [number, number, number] {
    assert.ok(raw, `${where}: nothing to resolve`);
    let v = raw!.trim();
    const ref = /^var\((--[a-z-]+)\)$/.exec(v);
    if (ref) {
      const looked = material.get(ref[1]!);
      assert.ok(looked, `${where}: ${ref[1]} is read but never declared — it resolves to empty`);
      v = looked!.trim();
    }
    const n = /^(\d+)\s+(\d+)\s+(\d+)$/.exec(v);
    assert.ok(n, `${where}: "${v}" is not space-separated channels`);
    return [Number(n![1]), Number(n![2]), Number(n![3])];
  }

  const lin = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const lum = ([r, g, b]: [number, number, number]) =>
    0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const ratio = (a: [number, number, number], b: [number, number, number]) => {
    const la = lum(a);
    const lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };

  // The house values, for any role a theme leaves alone.
  const HOUSE = { ink: '30 34 41', cream: '255 255 255', paperDeep: '241 241 240' };

  let measured = 0;
  for (const id of PAINTED) {
    const body = cssBlocksFor(id).join('\n');
    const decl = (name: string) =>
      new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(body)?.[1]?.trim();

    const ink = channels(decl('--color-ink') ?? HOUSE.ink, `${id} --color-ink`);
    const cream = channels(decl('--color-cream') ?? HOUSE.cream, `${id} --color-cream`);
    const plateInk = channels(
      decl('--color-ink-on-plate') ?? decl('--color-ink') ?? HOUSE.ink,
      `${id} plate ink`,
    );
    const plate = channels(decl('--color-paper-deep') ?? HOUSE.paperDeep, `${id} --color-paper-deep`);

    const onGround = ratio(ink, cream);
    const onPlate = ratio(plateInk, plate);
    measured += 2;

    assert.ok(
      onGround >= 4.5,
      `${id}: text on the GROUND is ${onGround.toFixed(2)}:1 — this is the failure that shipped, ` +
        'and it is invisible in a thumbnail because the plates still look right',
    );
    assert.ok(
      onPlate >= 4.5,
      `${id}: text on the PLATES is ${onPlate.toFixed(2)}:1 — a dark theme with a bright card ` +
        'needs --color-ink-on-plate, or the card inherits the ground\'s ink and goes blank',
    );
  }
  assert.equal(measured, PAINTED.length * 2, `measured ${measured} pairs, expected ${PAINTED.length * 2}`);
});

test('a plate reads its own ink, so a dark theme can hold a bright card', () => {
  const css = CSS;
  for (const rule of ['pahina-plate', 'pahina-deckle']) {
    const m = new RegExp(`\\.sn-editorial \\.${rule} \\{([^}]*)\\}`).exec(css);
    assert.ok(m, `${rule} is gone — re-anchor this guard rather than deleting it`);
    assert.match(
      m[1]!,
      /color:\s*rgb\(var\(--color-ink-on-plate, var\(--color-ink\)\)\)/,
      `${rule} no longer takes --color-ink-on-plate — Velvet's bright cards would inherit ` +
        'the dark ground\'s cream ink and go blank',
    );
  }
});

test('no site skin paints its own ground colour — the page\'s paper is the only one', () => {
  /*
    🔴 THE STRUCTURAL HALF OF THE VELVET BUG: a token and a stylesheet disagreeing
    about the same plane is not something a colour calculation can see. Velvet's
    mapping once claimed a near-white paper while its skin painted near-black
    behind the page.

    ✅ Since 2026-09-25 the possibility is removed outright: the site has NO skin
    stylesheet at all. The only ground behind a guest page is `GuestLookScope`'s
    — `bg-cream` (the page's own paper), the theme's loop, and a scrim painted in
    `rgb(var(--color-cream) / …)`, the very variable every ink is computed against.
  */
  const sheets = readdirSync(SITE_DIR).filter((f) => f.endsWith('.module.css'));
  assert.deepEqual(sheets, [], `the site grew a skin stylesheet again: ${sheets.join(', ')}`);
  const scope = stripComments(read('app', '[slug]', '_components', 'guest-look-scope.tsx'));
  const ground = scope.slice(scope.indexOf('function GuestGround'));
  assert.ok(ground.length > 100, 'GuestGround is gone — re-anchor this guard rather than deleting it');
  assert.match(ground, /fixed inset-0 -z-10 bg-cream/, 'the ground no longer paints the page\'s own paper');
  assert.match(ground, /rgb\(var\(--color-cream\) \/ /, 'the scrim is not the page\'s own paper');
  assert.doesNotMatch(ground, /backgroundColor:\s*['"`]#/, 'the ground paints a literal colour of its own');
});
