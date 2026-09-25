import type { ReactNode } from 'react';
import { GuestLookScope } from './guest-look-scope';
import { siteSkin } from './skins/site-skin';
import { resolveThemeGround } from '../_lib/theme-ground';
import type { GuestLook } from '../_lib/loaders';

/**
 * What `GuestLookScope` wears for one resolved look — the ONE translation from
 * `GuestLook` to the scope's props, shared by the guest-tree layout (every
 * guest, live columns) and `HostDraftLook` below (the host's canvas, drafted
 * columns), so the two can never dress the page two different ways.
 */
export function lookScopeProps(look: GuestLook | null) {
  /*
    The theme's font classes and the `--accent` its material mixes with come
    from the site skin, the one place they are declared. Its `ground` is NOT
    drawn here: the textured grounds carry the couple's reveal photo, and the
    layout wraps the private landing (see `resolveHubTheme`). `GuestLookScope`
    lays the plain paper instead.
  */
  const skin = look?.theme ? siteSkin(look.theme, { accent: look.accent }) : undefined;
  const style =
    look && (look.vars || skin) ? { ...(look.vars ?? {}), ...((skin?.style as Record<string, string>) ?? {}) } : null;
  /*
    The theme's LOOP and scrim. Unlike the couple's reveal photo this is
    Setnayan's own public theme art, so it may be drawn on every page — the
    private landing included — and it is resolved once, not per page.
  */
  const ground = look?.theme ? resolveThemeGround(look.theme, { ownColours: Boolean(look.vars) }) : null;
  return {
    theme: look?.theme ?? null,
    art: look?.art ?? null,
    fontClassName: skin?.className ?? '',
    style,
    ground,
  };
}

/**
 * 💾 THE HOST'S DRAFTED COLOURS AND FACE, ON THE MAKER'S CANVAS ONLY.
 *
 * The page's look is worn by `app/[slug]/layout.tsx`, which a layout's nature
 * keeps from seeing `?editor=1` — so a drafted colour would be a save the
 * host's preview never showed. The page DOES see it: when the host's draft
 * holds any Colors-panel column (`HUB_DRAFT_LOOK_COLUMNS`), `InvitationBody`
 * resolves the look again from the OVERLAID row and wraps its output in a
 * second `GuestLookScope`. Custom properties and `data-*` attributes set on the
 * inner scope win for everything inside it, and its paper is drawn after the
 * layout's, so the canvas shows exactly the drafted look.
 *
 * ⛔ NEVER FOR A GUEST. `InvitationBody` only builds this from a `hostDraft`,
 * which is null for every request that is not the host's own canvas
 * (`asksForHostCanvas` + `loadHostPreviewDraft`'s host check) — guest HTML is
 * byte-identical.
 *
 * ⚠ Known limit: Candlelight is worn as an ATTRIBUTE, so a draft that turns
 * Candlelight OFF while it is live cannot take the layout's attribute away —
 * the canvas stays dark until Apply. Turning it ON previews correctly.
 */
export function HostDraftLook({ look, children }: { look: GuestLook | null; children: ReactNode }) {
  return <GuestLookScope {...lookScopeProps(look)}>{children}</GuestLookScope>;
}
