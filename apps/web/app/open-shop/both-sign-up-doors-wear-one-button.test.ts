/**
 * both-sign-up-doors-wear-one-button.test.ts — /open-shop's Continue and /signup's Create are the same shape.
 *
 * ── THE DEFECT (live check 2026-10-23, `open-shop__wk.png`) ─────────────────
 * The two sign-up doors disagreed: /signup's Create is a pill (the house primary on the public pages), while
 * /open-shop's Continue — and its last-step "Open my shop — free" — were 8 px rectangles, because they wore the
 * app's `.button-primary` (`rounded-md`) as-is.
 *
 * ── THE PROPERTY ────────────────────────────────────────────────────────────
 * Every primary button in the open-shop wizard resolves to the SAME radius as /signup's Create — both read from
 * the CSS that paints them (Create: `.hr-si-submit` → `--hr-r` in the overlay scope; the wizard: its `rounded-*`
 * class → tailwind.config → the `:root` token), never re-typed here. The round Back beside it matches.
 * Comments stripped before matching, so the explanation of the fix is never the finding.
 *
 * SABOTAGE: drop `rounded-full` from Continue → RED (resolves to `.button-primary`'s rounded-md, 8 px).
 * SABOTAGE: change Create's `--hr-r` to 12px in the overlay block → RED (the doors disagree again).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const RESKIN = read('app/_components/home/home-reskin.css');
const GLOBALS = read('app/globals.css');
const TAILWIND = read('tailwind.config.ts');
const WIZARD = read('app/open-shop/_components/open-shop-wizard.tsx');
const SIGNUP = read('app/signup/page.tsx');

/** The px a `:root`-declared `--m-r-*` token holds. */
function rootTokenPx(token: string): number {
  const m = GLOBALS.match(new RegExp(`:root\\s*\\{[^}]*${token}:\\s*(\\d+)px`));
  assert.ok(m, `${token} is not declared on :root`);
  return Number(m[1]);
}

/** The px a Tailwind `rounded-<key>` paints, through tailwind.config's borderRadius block. */
function roundedPx(key: string): number {
  const block = TAILWIND.slice(TAILWIND.indexOf('borderRadius: {'));
  const body = block.slice(0, block.indexOf('}'));
  const m = body.match(new RegExp(`(?:^|\\n)\\s*'?${key}'?:\\s*'([^']+)'`));
  assert.ok(m, `tailwind.config has no borderRadius.${key}`);
  const v = m[1]!;
  const tok = v.match(/^var\((--[\w-]+)\)$/);
  return tok ? rootTokenPx(tok[1]!) : Number.parseFloat(v);
}

/** The radius `.button-primary` itself applies (the fallback a button without its own `rounded-*` gets). */
function buttonPrimaryPx(): number {
  const apply = GLOBALS.match(/\.button-primary\s*\{\s*@apply([^;]+);/)?.[1] ?? '';
  const key = apply.match(/(?:^|\s)rounded-(none|sm|md|lg|xl|2xl|3xl|full)(?=\s|$)/)?.[1];
  assert.ok(key, '.button-primary declares no rounded-* — this guard is pointed at nothing');
  return roundedPx(key);
}

/** /signup's Create: the radius `.home-reskin-ov .hr-si-submit` paints, resolved through the overlay's own --hr-r. */
function createPx(): number {
  assert.match(SIGNUP, /<SubmitButton className="hr-si-submit"/, "/signup's Create no longer wears .hr-si-submit");
  let radius: string | null = null;
  for (const m of RESKIN.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1]!.trim();
    if (!/\.home-reskin-ov \.hr-si-submit$/.test(sel)) continue;
    const r = m[2]!.match(/border-radius:\s*([^;]+);/);
    if (r) radius = r[1]!.trim();
  }
  assert.ok(radius, '.home-reskin-ov .hr-si-submit sets no radius — this guard is pointed at nothing');
  const tok = radius.match(/^var\((--[\w-]+)\)$/);
  if (!tok) return Number.parseFloat(radius);
  // The token must resolve INSIDE the overlay — the scope /signup's card renders in.
  let px: number | null = null;
  for (const m of RESKIN.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/(?:^|,)\s*\.home-reskin-ov\s*$/.test(m[1]!.trim())) continue;
    const d = m[2]!.match(new RegExp(`${tok[1]}:\\s*(\\d+)px`));
    if (d) px = Number(d[1]);
  }
  assert.ok(px !== null, `${tok[1]} is not declared in the .home-reskin-ov scope`);
  return px;
}

/** Every element in the wizard wearing `button-primary`: its class list. */
function wizardPrimaries(): string[] {
  return [...WIZARD.matchAll(/className="([^"]*\bbutton-primary\b[^"]*)"/g)].map((m) => m[1]!);
}

test('every primary button in the open-shop wizard is the shape of /signup’s Create', () => {
  const want = createPx();
  const primaries = wizardPrimaries();
  assert.ok(primaries.length >= 2, `found ${primaries.length} primary buttons — Continue and Open my shop are both expected`);
  for (const cls of primaries) {
    const key = cls.match(/(?:^|\s)rounded-(none|sm|md|lg|xl|2xl|3xl|full)(?=\s|$)/)?.[1];
    const px = key ? roundedPx(key) : buttonPrimaryPx();
    assert.equal(px, want, `an open-shop primary button paints ${px}px corners; /signup's Create paints ${want}px:\n  ${cls}`);
  }
});

test('Back, beside it, is round too', () => {
  const back = WIZARD.match(/onClick=\{back\}\s*className="([^"]+)"/)?.[1];
  assert.ok(back, 'the wizard Back button moved — this guard is pointed at nothing');
  const key = back.match(/(?:^|\s)rounded-(none|sm|md|lg|xl|2xl|3xl|full)(?=\s|$)/)?.[1];
  assert.ok(key, 'Back wears no rounded-*');
  assert.equal(roundedPx(key), createPx(), 'Back is a square beside a pill');
});
