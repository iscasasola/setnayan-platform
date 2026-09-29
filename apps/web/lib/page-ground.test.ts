/**
 * page-ground.test.ts — THE COLOUR IS ALWAYS THE BASE; THE HERO SITS ON TOP
 * ONLY ON PRO THEMES.
 *
 * Owner, 2026-09-26 (DECISION_LOG "YES TO ALL" (a)). `lib/page-ground.ts` is
 * the one rule; this file proves the rule over all ten themes, and that every
 * surface that paints the page ground asks it rather than restating it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { INVITE_THEME_IDS, INVITE_THEMES } from './invite-themes';
import { heroMayBePageGround, pageGround } from './page-ground';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the hero may be the page ground on a Pro theme, or on a free one the event owns Pro for — never Classic', () => {
  const pro = INVITE_THEME_IDS.filter((t) => INVITE_THEMES[t].tier === 'pro');
  assert.ok(pro.length >= 1 && pro.length < INVITE_THEME_IDS.length, 'precondition: both tiers exist');
  for (const t of INVITE_THEME_IDS) {
    const classic = t === 'house';
    // Without the unlock: a Pro theme only (it resolved, so ownership is decided upstream).
    assert.equal(heroMayBePageGround(t, false), INVITE_THEMES[t].tier === 'pro', `${t} without Pro`);
    // With it (owner 2026-09-29, "yes"): every theme but Classic.
    assert.equal(heroMayBePageGround(t, true), !classic, `${t} with Pro`);
  }
  assert.equal(heroMayBePageGround('house', true), false, 'Classic never wears the hero as its ground');
  assert.equal(heroMayBePageGround(null, true), false);
  assert.equal(heroMayBePageGround(undefined, true), false);
});

test('Classic never shows the hero as the page background, whatever the Maker stored', () => {
  for (const ombre of [false, true]) {
    const g = pageGround({ theme: 'house', ombre, heroGround: true });
    assert.equal(g.heroOnTop, false, `ombre=${ombre}`);
    assert.equal(g.themeLoop, false, 'Classic has no loop');
    assert.equal(g.base, ombre ? 'ombre' : 'paper', 'the colour + effect is still the base');
  }
  // With no ombré, Classic's page is the shell's own flat paper.
  assert.equal(pageGround({ theme: 'house', ombre: false, heroGround: true }).shellPaper, true);
  // With an ombré, the shell must leave its opaque paper off or it hides the effect.
  assert.equal(pageGround({ theme: 'house', ombre: true, heroGround: false }).shellPaper, false);
});

test('on every Pro theme the base is always there, and the hero goes ON TOP of it', () => {
  for (const t of INVITE_THEME_IDS.filter((id) => INVITE_THEMES[id].tier === 'pro')) {
    for (const ombre of [false, true]) {
      const withHero = pageGround({ theme: t, ombre, heroGround: true });
      assert.equal(withHero.heroOnTop, true, `${t} ombre=${ombre}`);
      assert.equal(withHero.base, ombre ? 'ombre' : 'paper', `${t}: the base is still painted under the hero`);
      assert.equal(withHero.themeLoop, false, `${t}: the hero replaces the loop — never two videos`);
      assert.equal(withHero.shellPaper, false, `${t}: an opaque shell would hide the hero`);

      const noHero = pageGround({ theme: t, ombre, heroGround: false });
      assert.equal(noHero.heroOnTop, false);
      assert.equal(noHero.base, ombre ? 'ombre' : 'paper');
      // The theme's own loop only over a plain base — an ombré is a background.
      assert.equal(noHero.themeLoop, !ombre, `${t} ombre=${ombre}`);
      assert.equal(noHero.shellPaper, false);
    }
  }
});

test('every surface that paints the page ground asks the one rule', () => {
  // 1 · The hero-on-top layer: resolved only behind the tier gate, drawn once.
  /*
    🪤 IT MOVED OUT OF site-body.tsx (2026-09-28) INTO ONE HELPER, and this
    guard moved with it. The owner ruled the RSVP page's background follows the
    Event Hub's, so two pages now draw the Main background — and the property
    this guard holds ("resolved only behind the tier gate, mounted once") is
    kept by making both ASK the one helper rather than each carrying a copy.
    The gate assertions below are the same ones that read site-body before.
  */
  const helper = read('app/[slug]/_lib/main-ground-layer.tsx');
  assert.match(helper, /import \{ heroGroundNeedsOwnership, heroMayBePageGround \} from '@\/lib\/page-ground';/);
  assert.match(
    helper,
    /const mainGround = heroMayBePageGround\(theme, ownsPro\)\s*\?\s*resolveMainGround\(/,
    'the Main background is resolved without asking the one rule',
  );
  assert.equal(helper.split('resolveMainGround(').length - 1, 1, 'a second, ungated resolveMainGround call');
  assert.equal(helper.split('<MainGround').length - 1, 1, 'MainGround is mounted twice');
  const mount = helper.indexOf('<MainGround');
  const gate = helper.lastIndexOf('if (mainGround) {', mount);
  assert.ok(gate > 0 && mount - gate < 800, 'MainGround is mounted outside the `if (mainGround)` gate');

  // The two pages that draw it ask the helper — neither resolves it itself.
  const body = read('app/[slug]/_components/site-body.tsx');
  const reply = read('app/[slug]/invite/reply/page.tsx');
  for (const [rel, src] of [
    ['site-body.tsx', body],
    ['invite/reply/page.tsx', reply],
  ] as const) {
    assert.equal(src.split('mainGroundLayerFor(').length - 1, 1, `${rel} does not draw the Main background through the one helper`);
    assert.doesNotMatch(src, /resolveMainGround\(|<MainGround\b/, `${rel} resolves or mounts the Main background itself`);
  }

  // No other page in the guest tree draws the hero as a ground.
  for (const rel of ['app/[slug]/layout.tsx', 'app/[slug]/page.tsx', 'app/[slug]/_components/guest-look-scope.tsx']) {
    assert.doesNotMatch(read(rel), /<MainGround\b|mainGroundLayerFor\(/, `${rel} draws the Main background — only a gated page may`);
  }

  // 2 · The theme loop over the base.
  const scope = read('app/[slug]/_components/guest-look-scope.tsx');
  assert.match(scope, /media=\{pageGround\(\{ theme, ombre: Boolean\(ombre\), heroGround: false \}\)\.themeLoop \? ground : null\}/);

  // 3 · The shell's own opaque paper.
  const shell = read('app/[slug]/_components/invitation-shell.tsx');
  assert.match(shell, /const themed = !pageGround\(\{ theme: hubTheme, ombre: ownGround, heroGround: false \}\)\.shellPaper;/);

  // And the hero, when on top, switches the theme's loop off with its own sheet.
  const main = read('app/[slug]/_components/main-ground.tsx');
  assert.match(main, /\[data-guest-ground\] \[data-theme-loop\],\[data-guest-ground\] \[data-theme-poster\]\{display:none\}/);
});
