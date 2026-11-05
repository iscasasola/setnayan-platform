/**
 * every-offered-accent-draws.test.ts — 🕯 AN ACCENT THE ACCENT ▾ OFFERS IS AN ACCENT THE SCENE DRAWS, IN EVERY STYLE, ON
 * ITS OWN CARD AND ON THE SCENE'S OWN BACKGROUND (owner 17 Oct, cale-ice, Invitation › Home › Countdown › Style: Boxes,
 * Accent ▾ "Narra columns", and no columns on the canvas — *"why narra columns are not showing?"*).
 *
 * MEASURED (prod, SELECT only): `events.style_preferences.scene_accents.countdown = "narra-columns"` — the pick WAS live.
 * The countdown's canvas is `{ kind: 'frost', own: true, style: 'four-tiles' }`: a background of the scene's own, so its
 * card is drawn BARE (`sceneWidgetIsBare`), and both mounts passed the kit only `artKit && !bare`; `CountdownWidget`
 * drew it only in the four tiles, and only when not bare. A frosted ground, or any other style, dropped a saved pick.
 *
 * Held for every countdown style the Maker offers (plus the calendar it still draws), bare and own, every accent the
 * Accent ▾ lists: the kit's ONE mount is a DIRECT child of the scene card (the stylesheet keys on
 * `[data-scene-card]:has(>[data-kit-slot="countdown"])`) and carries every piece of the pick; None draws nothing.
 *
 * SABOTAGE (each seen RED, then restored — see the PR): `{bare ? null : kit}` back in the four tiles · the kit dropped
 * from one other style · a mount gated on `!bare` again.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

test('every countdown style draws every offered accent — on its own card and on the scene’s own background', async () => {
  const { CountdownWidget } = await import('../app/[slug]/_components/countdown');
  const { KitSlot } = await import('../app/[slug]/_components/kit-piece');
  const { artKitView, ACCENT_NONE, SCENE_ACCENTS } = await import('./art-kits');
  const { STAGE_SCENE_STYLE_SETS } = await import('./scene-styles-stages');
  const offered = STAGE_SCENE_STYLE_SETS.find((s) => s.type === 'countdown')!.styles.map((s) => s.id);
  const styles = [...new Set([...offered, 'calendar'])];
  assert.ok(styles.length >= 5, `only ${styles.length} countdown styles could be read`);
  let drawn = 0;
  for (const theme of ['house', 'vintage'] as const) {
    for (const option of SCENE_ACCENTS.countdown) {
      const kit = artKitView({ theme, accents: { countdown: option.id }, ownsPro: true, tryOn: false })!;
      assert.ok(kit, `${theme}: no kit view for ${option.id}`);
      for (const sceneStyle of styles) {
        for (const bare of [false, true]) {
          const html = renderToStaticMarkup(
            React.createElement(CountdownWidget, { targetIso: '2099-12-12', timeZone: 'Asia/Manila', sceneStyle, bare, kit: React.createElement(KitSlot, { kit, slot: 'countdown' }) }),
          );
          const where = `${theme} · ${sceneStyle} · ${bare ? 'on its own background' : 'on its own card'} · ${option.label}`;
          assert.match(html, /^<section data-scene-card="[a-z]+"[^>]*><span aria-hidden="true" data-kit-slot="countdown">/, `${where}: the accent is not the card's first child (or not drawn at all)`);
          for (const piece of option.pieces) assert.ok(html.includes(`/${piece}.`), `${where}: the ${piece} piece is not drawn`);
          drawn += 1;
        }
      }
    }
    /* …and None draws nothing, in every style. */
    const none = artKitView({ theme, accents: { countdown: ACCENT_NONE }, ownsPro: true, tryOn: false });
    for (const sceneStyle of styles) {
      const html = renderToStaticMarkup(
        React.createElement(CountdownWidget, { targetIso: '2099-12-12', timeZone: 'Asia/Manila', sceneStyle, kit: none ? React.createElement(KitSlot, { kit: none, slot: 'countdown' }) : null }),
      );
      assert.doesNotMatch(html, /data-kit-slot/, `${theme} · ${sceneStyle}: None still drew an accent`);
    }
  }
  assert.ok(drawn >= 20, `only ${drawn} renders checked`);
});

test('both countdown mounts hand the kit over whatever the scene’s background — never gated on `bare`', () => {
  for (const file of ['app/[slug]/_components/hideable-widget-render.tsx', 'app/[slug]/_components/public-hideable-widget.tsx']) {
    const src = stripComments(readFileSync(join(__dirname, '..', file), 'utf8'));
    assert.match(src, /kit=\{artKit \? <KitSlot kit=\{artKit\} slot="countdown" \/> : null\}/, `${file}: the countdown's accent mount moved or is gated`);
    assert.doesNotMatch(src, /kit=\{artKit && !bare/, `${file}: the countdown's accent is dropped on the scene's own background again`);
  }
});
