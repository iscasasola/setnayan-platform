/**
 * the-guest-page-paints-the-ombre.test.ts — AN OMBRÉ THE COUPLE CHOSE REACHES A GUEST'S SCREEN.
 *
 * Owner, 2026-09-25: *"color setup can be like plain color or like apples ombe
 * style."* `lib/ombre.test.ts` proves the maths. This file proves the CHAIN
 * from the column to the pixels, because a gradient that is computed and never
 * painted renders exactly like no gradient:
 *
 *   1. the guest loader reads `site_bg_color` through the one reader and hands
 *      the CSS out as `ombre`, with the legibility vars spread LAST;
 *   2. the one translation to the scope (`lookScopeProps`) carries it — so the
 *      layout (every guest) and the host canvas (`HostDraftLook`) both paint it;
 *   3. the scope's paper paints it and does NOT draw the theme's loop beside it;
 *   4. the invitation shell leaves its opaque paper off for it — Classic too;
 *   5. the draft holds it, round-trips it, and Apply treats it as free while
 *      `OMBRE_IS_PRO` is false;
 *   6. the live writer parses it through the same reader, and the panel posts
 *      the encoded spec under the one `bg_color` field.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import {
  classifyHubDraft,
  emptyHubDraft,
  mergeHubDraft,
  overlayHubDraftEvent,
  planHubDraftApply,
  sanitizeHubDraft,
  sanitizeHubDraftEventValue,
  type HubLiveState,
} from './hub-draft';
import { OMBRE_IS_PRO, encodeOmbre, type OmbreSpec } from './ombre';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const SLUG = 'app/[slug]/';
const W = 'app/dashboard/[eventId]/website/';

/** One function's text, up to the next top-level function. */
function fn(src: string, name: string): string {
  const start = src.search(new RegExp(`^(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`, 'm'));
  assert.ok(start >= 0, `function ${name} not found`);
  const rest = src.slice(start + 1);
  const next = rest.search(/^(?:export\s+)?(?:async\s+)?function\s+\w+\s*\(/m);
  return next < 0 ? src.slice(start) : src.slice(start, start + 1 + next);
}

/* ── 1 · the loader ──────────────────────────────────────────────────────── */

test('1 · guestLookFrom reads the column through parseSiteBackground, asks ombreLook, and spreads its vars LAST', () => {
  const src = read(`${SLUG}_lib/loaders.ts`);
  assert.match(src, /import \{[^}]*\bombreLook\b[^}]*\} from '@\/lib\/ombre'/);
  const body = fn(src, 'guestLookFrom');
  const parse = body.search(/parseSiteBackground\(event\.site_bg_color\)/);
  const look = body.search(/ombreLook\(INVITE_THEMES\[hub\.theme\]/);
  const spread = body.search(/vars = \{ \.\.\.\(vars \?\? \{\}\), \.\.\.look\.vars \}/);
  const ret = body.search(/return \{/);
  assert.ok(parse > 0, 'the column is not read through the one reader');
  assert.ok(look > parse, 'ombreLook is not asked with the resolved theme');
  assert.ok(spread > look && spread < ret, 'the legibility vars are not spread over the bag last');
  assert.match(body.slice(ret), /\bombre,?\s*\n?\s*\}/, 'the CSS does not leave the loader as `ombre`');
  // No entitlement anywhere near it: it is free.
  assert.doesNotMatch(body.slice(parse, ret), /proActive|websiteProActive|ownsPro/, 'the ombré must not read Pro');
  // The type carries it, so a caller cannot forget it.
  assert.match(src, /export type GuestLook = \{[\s\S]*?\bombre: string \| null;[\s\S]*?\};/);
});

/* ── 2 · the one translation ─────────────────────────────────────────────── */

test('2 · lookScopeProps carries `ombre`, and the layout and the host canvas both use that translation', () => {
  const props = fn(read(`${SLUG}_components/host-draft-look.tsx`), 'lookScopeProps');
  assert.match(props, /ombre: look\?\.ombre \?\? null/);
  assert.match(read(`${SLUG}layout.tsx`), /<GuestLookScope \{\.\.\.lookScopeProps\(look\)\}>/);
  assert.match(read(`${SLUG}_components/host-draft-look.tsx`), /<GuestLookScope \{\.\.\.lookScopeProps\(look\)\}>/);
});

/* ── 3 · the paper ───────────────────────────────────────────────────────── */

test('3 · the scope’s paper paints the ombré and hands it no loop beside it; an ombré alone is a look worn', () => {
  const src = read(`${SLUG}_components/guest-look-scope.tsx`);
  // The ground is given the ombré, and the theme media ONLY when there is none.
  assert.match(src, /<GuestGround media=\{theme && !ombre \? ground : null\} ombre=\{ombre\} \/>/);
  const ground = fn(src, 'GuestGround');
  assert.match(ground, /style=\{ombre \? \{ backgroundImage: ombre \} : undefined\}/, 'the paper does not paint the ombré');
  assert.match(ground, /data-guest-ombre=\{ombre \? '' : undefined\}/, 'the painted paper is not marked');
  // Foil names are measured against the theme's own ground — not over a couple's ombré.
  assert.match(src, /data-hub-foil=\{worn && ground\?\.foil && !ombre \? '' : undefined\}/);
  // And a House couple with nothing but an ombré still wears it.
  const worn = fn(src, 'lookIsWorn');
  assert.match(worn, /look\.theme \|\| look\.art \|\| look\.style \|\| look\.ombre/);
});

/* ── 4 · the shell ───────────────────────────────────────────────────────── */

test('4 · the invitation shell leaves its opaque paper off for an ombré, Classic included, and the page tells it so', () => {
  const shell = read(`${SLUG}_components/invitation-shell.tsx`);
  assert.match(shell, /const themed = Boolean\(hubTheme && hubTheme !== 'house'\) \|\| ownGround;/);
  const body = read(`${SLUG}_components/site-body.tsx`);
  assert.match(body, /<InvitationShell[\s\S]*?ownGround=\{isOmbreValue\(event\.site_bg_color\)\}[\s\S]*?>/);
  assert.match(body, /import \{ isOmbreValue \} from '@\/lib\/ombre'/);
});

/* ── 5 · the draft ───────────────────────────────────────────────────────── */

const SPEC: OmbreSpec = { shape: 'diagonal', base: '#1a0608' };
const STORED = encodeOmbre(SPEC);

const LIVE: HubLiveState = { events: { site_bg_color: '#f5efe6' }, widgets: [] };

test('5 · the draft holds an ombré exactly, overlays it on the row, and Apply copies it over as a FREE change', () => {
  assert.equal(sanitizeHubDraftEventValue('site_bg_color', STORED), STORED);
  assert.equal(sanitizeHubDraftEventValue('site_bg_color', ' ombre:diagonal:#1A0608 '), STORED);
  assert.equal(sanitizeHubDraftEventValue('site_bg_color', '#F5EFE6'), '#f5efe6', 'a plain hex still lands');
  assert.equal(sanitizeHubDraftEventValue('site_bg_color', 'ombre:swirl:#000000'), undefined, 'noise is dropped');
  assert.equal(sanitizeHubDraftEventValue('site_bg_color', null), null, 'null still clears');

  const draft = mergeHubDraft(emptyHubDraft(), { events: { site_bg_color: STORED } });
  assert.equal(draft.events.site_bg_color, STORED);
  // A round trip through the stored JSON keeps it.
  assert.equal(sanitizeHubDraft(JSON.parse(JSON.stringify(draft))).events.site_bg_color, STORED);
  // The host's canvas reads the overlaid row.
  assert.equal(overlayHubDraftEvent({ site_bg_color: '#f5efe6' }, draft).site_bg_color, STORED);

  // Free: not a Pro item, for a free couple.
  const { items } = classifyHubDraft(draft, LIVE);
  const bg = items.find((i) => i.kind === 'event' && i.column === 'site_bg_color');
  assert.ok(bg, 'the drafted background is not classified');
  assert.equal(bg.change, 'change');
  assert.equal(bg.pro, OMBRE_IS_PRO, 'the ombré’s Pro answer must be exactly the one switch');
  const plan = planHubDraftApply(draft, LIVE, false);
  const applied = plan.apply.find((i) => i.kind === 'event' && i.column === 'site_bg_color');
  assert.equal(applied?.value, STORED, 'Apply for a free couple must carry the ombré to the live row');
  assert.equal(plan.refused.length, 0);
});

/* ── 6 · the writer and the panel ────────────────────────────────────────── */

test('6 · updateSiteColors parses the background through the one reader, before the draft door, and classifies the ombré outside siteLookChange', () => {
  const src = read(`${W}colors/actions.ts`);
  const body = fn(src, 'updateSiteColors');
  const parse = body.search(/parseBackgroundField\(formData\.get\('bg_color'\)\)/);
  const door = body.search(/isHubDraftWrite\(formData\)/);
  const gate = body.search(/requireLookPro\(/);
  assert.ok(parse > 0 && door > parse && gate > door, 'parse → draft door → live gate, in that order');
  const parser = fn(src, 'parseBackgroundField');
  assert.match(parser, /parseSiteBackground\(raw\)/);
  assert.match(parser, /encodeSiteBackground\(bg\) : false/, 'a malformed background must bounce, not be repaired');
  // The ombré's classification is combined INTO the gate, from its own call.
  assert.match(body, /const ombreChange = ombreLookChange\(s\.site_bg_color \?\? null, bg\);/);
  assert.match(body, /combineChanges\(\s*siteLookChange\([\s\S]*?\),\s*ombreChange,?\s*\)/);
  assert.match(body, /\.select\('site_bg_color, /, 'the stored background must be read for the classification');
});

test('6 · the Colors panel posts ONE bg_color, filled by the Plain | Ombré field, drafted', () => {
  const src = read(`${W}editor/_components/pro-panels.tsx`);
  const panel = fn(src, 'ColorsPanel');
  assert.match(panel, /<HubDraftField \/>/);
  assert.match(panel, /<BackgroundField id=\{`\$\{rowKey\}-bg`\} value=\{bgColor\} themeId=\{themeId\} \/>/);
  assert.doesNotMatch(panel, /name="bg_color"/, 'the panel must not post a second bg_color beside the field');
  const field = fn(src, 'BackgroundField');
  assert.equal((field.match(/name="bg_color"/g) ?? []).length, 1, 'exactly one bg_color is posted');
  // One colour + one effect → the column's own text form (owner: "pick a color,
  // and you apply either plain, dawn, diagonal or glow effect. that's it").
  assert.match(field, /const posted = encodeBackgroundChoice\(hex, effect\);/);
  assert.equal((field.match(/type="color"/g) ?? []).length, 1, 'exactly ONE colour picker — no multi-colour builder');
  assert.match(field, /BACKGROUND_EFFECTS\.map\(/, 'the four effects are offered from the one list');
  assert.match(field, /aria-pressed=\{on\}/, 'the effects are a pressed set');
  assert.match(field, /backgroundImage: ombreCss\(\{ shape: e, base: previewBase \}\)/, 'an effect chip is a REAL gradient of the picked colour');
  assert.match(field, /style=\{\{ color: look\.legibility\.ink \}\}/, 'the preview shows the ink the page will use');
  assert.doesNotMatch(src, /ombrePresetsFor|Make my own|OMBRE_MAX_STOPS/, 'the preset gallery and the multi-colour builder are gone');
  // The editor page hands the live theme in, beside the first-visit hint.
  const page = read(`${W}editor/page.tsx`);
  assert.match(page, /<MiniTour tourKey="customer_ombre_background_v1" storeShell=\{storeShell\} \/>\s*<ColorsPanel/);
  assert.match(page, /<ColorsPanel[\s\S]*?themeId=\{currentThemeId\}/);
});
