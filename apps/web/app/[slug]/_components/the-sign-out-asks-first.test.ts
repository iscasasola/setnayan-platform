/**
 * "SIGN OUT OF THIS INVITATION" CAN BE READ, AND IS NEVER ONE ACCIDENTAL PRESS.
 *
 * A guest's walk, 2026-10-11 (fault N13): the control was 12px text at 3.0:1 in the middle of the page, and a
 * single press signed the guest out — the pass in this browser gone, the face-tagging selfie erased, the way back
 * in their own link or QR.
 *
 * WHAT IS HELD:
 *   (1) THE FIRST PRESS ASKS; ONLY A PRESS MADE AFTER THE QUESTION SIGNS OUT — the one rule (`signOutPress`), and
 *       the form's handler stops the first press with it.
 *   (2) AS DRAWN (the real guest page, `lib/site-body-fixture-render.ts`): ONE sign-out on the page, a POST to the
 *       event's own `/sign-out`; before any press it is the one control, with nothing that signs out behind a
 *       second label.
 *   (3) IT CAN BE READ AND PRESSED: its words are at least 14px, at least 4.5:1 against the page (worked out from
 *       the house tokens in `globals.css`, not typed in), and the press is at least 44px tall.
 *   (4) The guest is told what it costs before the second press, and — with a selfie — that the selfie is erased,
 *       before the FIRST (owner 2026-09-30).
 *
 * NOT PROVEN HERE: the two presses in a real browser (the component is drawn here before any press).
 *
 * SABOTAGE RUN 2026-10-11 (committed first, put back by `git checkout`): `signOutPress` made to answer "sign-out"
 * always → (1) red; the section put back to `text-xs text-ink/50` → (3) red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
/* FIRST: this import installs the seam the real page is drawn through. */
import { renderSiteBodyFixture } from '@/lib/site-body-fixture-render';
import { stripComments } from '@/lib/strip-comments';
import { SIGN_OUT_COSTS, SignOutOfInvitation, signOutPress } from './sign-out-of-invitation';

const WEB = join(__dirname, '..', '..', '..');

test('(1) the first press asks; only a press made after the question signs out', () => {
  assert.equal(signOutPress(false), 'ask', 'one press signs the guest out');
  assert.equal(signOutPress(true), 'sign-out', 'the guest can never sign out');
  const code = stripComments(readFileSync(join(__dirname, 'sign-out-of-invitation.tsx'), 'utf8'));
  // The handler lets a press through only on the rule's word, and stops every other one.
  assert.match(
    code,
    /const onSubmit = \(event: FormEvent<HTMLFormElement>\) => \{\s*if \(signOutPress\(asked\) === 'sign-out'\) return;\s*event\.preventDefault\(\);\s*setAsked\(true\);\s*\};/,
  );
  assert.match(code, /<form action=\{action\} method="post" onSubmit=\{onSubmit\}/, 'the form is not held by the handler');
  // "Stay" takes the question back; it never submits.
  assert.match(code, /<button type="button" onClick=\{\(\) => setAsked\(false\)\}[^>]*>\s*Stay\s*<\/button>/);
});

/** The sign-out section of a guest's page, as drawn. */
function signOutOf(html: string): string {
  const forms = [...html.matchAll(/<form\b[^>]*action="[^"]*\/sign-out"[^>]*>[\s\S]*?<\/form>/g)].map((m) => m[0]);
  assert.equal(forms.length, 1, `a guest's page has ${forms.length} sign-outs — one place per control`);
  const at = html.indexOf(forms[0]!);
  const open = html.lastIndexOf('<section', at);
  return html.slice(open, at + forms[0]!.length);
}

test('(2) as drawn: ONE sign-out, a POST to the event’s own route, and one control before any press', async () => {
  const html = await renderSiteBodyFixture();
  const section = signOutOf(html);
  assert.match(section, /<form[^>]*action="\/maria-and-jose\/sign-out"[^>]*method="post"/, 'the sign-out is not a POST to this event’s route');
  const buttons = section.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
  assert.equal(buttons.length, 1, 'before any press there is more than one control');
  assert.match(buttons[0]!, />Sign out of this invitation</);
  assert.ok(!section.includes(SIGN_OUT_COSTS), 'the question is drawn before anyone pressed');
  assert.doesNotMatch(section, /<a\b/, 'a link signs out — a prefetch would run it');
});

/** WCAG contrast of an `text-ink/NN` on the house page, from the tokens themselves. */
function inkContrast(alphaPct: number): number {
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  const token = (name: string) => {
    const m = css.match(new RegExp(`--color-${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)`));
    assert.ok(m, `--color-${name} was not found in globals.css`);
    return [Number(m![1]), Number(m![2]), Number(m![3])] as const;
  };
  const ink = token('ink');
  const page = token('cream');
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = (c: readonly number[]) => 0.2126 * lin(c[0]!) + 0.7152 * lin(c[1]!) + 0.0722 * lin(c[2]!);
  const a = alphaPct / 100;
  const mixed = ink.map((v, i) => v * a + page[i]! * (1 - a));
  const [hi, lo] = [lum(page), lum(mixed)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

test('(3) it can be read and pressed: ≥14px, ≥4.5:1 on the page, ≥44px tall', async () => {
  // Anti-vacuity: the measure sees the fault it was written for (12px ink/50 was 3.0:1).
  assert.ok(inkContrast(50) < 3.2 && inkContrast(50) > 2.8, `ink/50 measures ${inkContrast(50).toFixed(2)}:1 — the measure is off`);
  const section = signOutOf(await renderSiteBodyFixture());
  const cls = (section.match(/^<section class="([^"]*)"/)?.[1] ?? '').split(/\s+/);
  const size = cls.find((c) => /^text-(?:xs|sm|base|lg|xl)$/.test(c));
  assert.ok(size && size !== 'text-xs', `the sign-out's words are ${size ?? 'unsized'} — under 14px`);
  const alpha = Number(cls.map((c) => c.match(/^text-ink(?:\/(\d+))?$/)).find(Boolean)?.[1] ?? 100);
  assert.ok(inkContrast(alpha) >= 4.5, `the sign-out's words are ${inkContrast(alpha).toFixed(2)}:1 on the page (text-ink/${alpha})`);
  const button = section.match(/<button\b[^>]*>/)?.[0] ?? '';
  assert.match(button, /min-h-\[44px\]/, 'the press is under 44px tall');
  // No colour of its own that would undo the section's.
  assert.doesNotMatch(button, /text-ink\/(?:[1-5]\d|6[0-4])\b/, 'the button dims its own words again');
});

test('(4) the cost is said before the second press; the erased selfie before the first', () => {
  const { renderToStaticMarkup } = require('react-dom/server') as typeof import('react-dom/server');
  const drawn = renderToStaticMarkup(
    React.createElement(
      SignOutOfInvitation,
      { action: '/ana/sign-out', erases: React.createElement('p', { 'data-sign-out-erases-selfie': '' }, 'Signing out also erases your face-tagging selfie.') },
      'Sign out of this invitation',
    ),
  );
  assert.ok(drawn.indexOf('face-tagging selfie') > 0 && drawn.indexOf('face-tagging selfie') < drawn.indexOf('<button'), 'the selfie line is not said before the press');
  const code = stripComments(readFileSync(join(__dirname, 'sign-out-of-invitation.tsx'), 'utf8'));
  const askedArm = code.slice(code.indexOf('{asked ? ('), code.indexOf(') : ('));
  assert.ok(askedArm.indexOf('{SIGN_OUT_COSTS}') > 0 && askedArm.indexOf('{SIGN_OUT_COSTS}') < askedArm.indexOf('type="submit"'), 'the cost is not said before the press that signs out');
  assert.ok(SIGN_OUT_COSTS.length > 20 && /link|QR/.test(SIGN_OUT_COSTS), 'the cost no longer says how to get back in');
  // The page hands the selfie line in, for a guest who has one.
  const body = stripComments(readFileSync(join(__dirname, 'site-body.tsx'), 'utf8'));
  assert.match(body, /<SignOutOfInvitation\s+action=\{`\/\$\{event\.slug\}\/sign-out`\}\s+erases=\{\s*guest\.photo_source === 'selfie' \? \(/);
});
