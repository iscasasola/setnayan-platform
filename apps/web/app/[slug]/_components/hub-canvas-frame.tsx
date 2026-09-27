import {
  hasHubCanvas,
  hubBackgroundOwnsBox,
  hubBackgroundTint,
  hubCanvasClass,
  hubCanvasVars,
  hubPhotoPlacement,
  resolveHubBackground,
  sanitizeHubCanvas,
  type HubBackground,
  type HubSectionCanvas,
} from '@/lib/hub-canvas';
import { heroVideoRefForGuests } from '@/lib/guest-hero-video';
import type { InvitationWidgetRow } from '@/lib/invitation-widgets';
import { INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';
import { sceneLegibilityVars } from '@/lib/scene-legibility';
import { HUB_ELEMENT_EXCLUDED_WIDGETS, hubElementSceneCss } from '@/lib/element-style';

/**
 * THE CANVAS FRAME — a couple's arrangement, put around one section.
 *
 * ── WHY THIS IS ITS OWN FILE, AND NOT A HELPER INSIDE A DISPATCHER ─────────
 * 🔴 BECAUSE THERE ARE TWO DISPATCHERS, AND THE FIRST VERSION WRAPPED ONE.
 * `site-body.tsx` renders widgets down two different paths: guests go through
 * `HideableWidgetRender`, and an anonymous visitor on an open-browse event goes
 * through `PublicHideableWidget`, a deliberate mirror that handles the six
 * widget types needing no guest object. The wrapper was written inside the
 * first one, so a couple who arranged their page would have seen it — and a
 * stranger following their link would have seen the page unarranged, with
 * nothing red anywhere and no way to tell the two apart from the dashboard.
 *
 * One frame, imported by both, and
 * `apps/web/lib/every-dispatcher-frames-the-canvas.test.ts` finds every
 * dispatcher by what it DOES rather than by a list of two names, so a third one
 * added later cannot quietly skip it.
 *
 * ── THE TWO REFUSALS, BOTH DELIBERATE ──────────────────────────────────────
 * ⛔ A WIDGET THAT HID ITSELF STAYS HIDDEN. Several return `null` — Countdown
 * with no date, Schedule with no public blocks. Wrapping a null in a styled
 * div would put an empty, animated box where the widget deliberately drew
 * nothing: a worse bug than the one it would be hiding.
 *
 * ⛔ A COUPLE WHO ARRANGED NOTHING GETS NO FRAME. `hasHubCanvas` is false for an
 * empty or unreadable `config_json`, so the markup for those pages is
 * byte-identical to what it was before any of this existed, and a defect in the
 * canvas CSS cannot reach a page nobody has arranged.
 */
/**
 * WHAT THIS SCENE'S GROUND ACTUALLY PAINTS — read ONCE, the same way, by the
 * frame and by both dispatchers (which ask it whether the widget should draw
 * its own card: `sceneWidgetIsBare`).
 *
 *   · a colour or either glass always paints (no signing);
 *   · a photo paints once its ref signed; a snippet also only when the guest
 *     hero-video gate lets that clip through (SEC-6, below);
 *   · "No background" paints nothing, on purpose.
 */
export function sceneGround(
  widget: Pick<InvitationWidgetRow, 'config_json'>,
  mediaUrls?: Readonly<Record<string, string>>,
): { canvas: HubSectionCanvas; bg: HubBackground | null; mediaUrl: string | null; painted: boolean } {
  const canvas = sanitizeHubCanvas(widget.config_json);
  /* ⛔ A ref whose signing FAILED is not a picture. A deleted object or a
     refused bucket resolves to nothing, and the section must then render as a
     section with no background — never as a styled plate waiting for an image
     that is not coming, which reads to a guest as a broken page. */
  const rawMediaUrl = canvas.media ? (mediaUrls?.[canvas.media] ?? null) : null;
  /* WHICH ground this section has. `resolveHubBackground` is the one place
     that decides, including the rule that a row written before `kind` existed
     is a PHOTO. */
  const bg = resolveHubBackground(canvas);
  /* 🔒 SEC-6 — CLOSE THE SNIPPET BYPASS (plan Phase 4). `setWidgetBackground`'s
     ONLY snippet source is the couple's own `landing_page_hero_video_r2_key`
     (see that action's docblock: "the couple's own hero video, and only
     that") — the SAME unscreened clip `heroVideoRefForGuests` exists to keep
     off every other guest surface. Without this, a couple could post the
     identical clip to a guest page through this one section background,
     bypassing `GUEST_HERO_VIDEO_PLAYBACK` entirely. Gate it exactly the same
     way `app/[slug]/_lib/loaders.ts` gates the hero itself: a blocked snippet
     is treated like a ref whose signing failed — no picture, not a styled
     plate — never as an error. */
  const mediaUrl =
    bg && bg.kind === 'snippet'
      ? (heroVideoRefForGuests(bg.media) ? rawMediaUrl : null)
      : rawMediaUrl;
  /* A colour (flat or glass) needs no signing, so it stands on its own; a
     photo and a snippet both need their ref to have survived the allow-list
     AND the signer. "No background" paints nothing. */
  const painted = hubBackgroundTint(bg) ? true : bg?.kind === 'none' ? false : Boolean(mediaUrl);
  return { canvas, bg, mediaUrl, painted };
}

/**
 * 🖼 SHOULD THE WIDGET DRAW ITS OWN CARD? No, when the scene background owns
 * the box — "No background" (no box at all) or a painted ground (the frame IS
 * the box). Yes only when the couple chose no background at all: the page as it
 * always looked. `lib/hub-canvas.ts` `hubBackgroundOwnsBox` is the rule.
 */
export function sceneWidgetIsBare(
  widget: Pick<InvitationWidgetRow, 'config_json'>,
  mediaUrls?: Readonly<Record<string, string>>,
): boolean {
  const { canvas, painted } = sceneGround(widget, mediaUrls);
  return hubBackgroundOwnsBox(canvas, painted);
}

export function HubCanvasFrame({
  widget,
  mediaUrls,
  hubTheme,
  children,
}: {
  widget: InvitationWidgetRow;
  /**
   * ref → presigned URL, resolved ONCE for the whole page by `SiteBody`.
   *
   * 🔑 Passed in rather than signed here. A page with a dozen arranged sections
   * would otherwise make a dozen sequential signing round trips — the exact
   * thing `displayUrlForStoredAsset`'s own docblock tells list surfaces not to
   * do. One `Promise.all` upstream, a lookup here.
   */
  mediaUrls?: Readonly<Record<string, string>>;
  /**
   * The live theme (`resolveHubTheme`), so a scene's words take the theme's
   * own readable ink over the scene's own ground. Absent → Classic's inks.
   */
  hubTheme?: InviteThemeId;
  children: React.ReactNode;
}) {
  if (children === null) return null;
  const canvas = sanitizeHubCanvas(widget.config_json);
  /* 🔤 THE SCENE'S ELEMENTS — its label, heading and words in the couple's own
     font · colour · size · animation (`lib/element-style.ts`). One hidden
     `<style>` placed straight AFTER the scene and addressing it with
     `:has(+ style…)`, so no widget is edited or wrapped and the scene stays its
     parent's direct child. Absent when nothing was chosen — the markup of an
     untouched scene is byte-identical. ⛔ Never on the RSVP form. */
  const elementCss = HUB_ELEMENT_EXCLUDED_WIDGETS.includes(widget.widget_type)
    ? null
    : hubElementSceneCss(widget.widget_type, canvas.elements);
  const elementStyle = elementCss ? (
    <style hidden data-hub-els={widget.widget_type}>
      {elementCss}
    </style>
  ) : null;
  if (!hasHubCanvas(canvas)) {
    return elementStyle ? (
      <>
        {children}
        {elementStyle}
      </>
    ) : (
      <>{children}</>
    );
  }
  /* The ground — which kind, its signed URL, whether it paints — read once by
     `sceneGround` above, the same reader the dispatchers use to decide whether
     the widget draws its own card. */
  const { bg, mediaUrl, painted } = sceneGround(widget, mediaUrls);
  /* WHERE the picture goes is the arrangement's call (`hubPhotoPlacement`):
     behind the words, in its own column beside them, or — for "Words only" —
     nowhere. The frame draws exactly the one layer that answer names. */
  const placement = hubPhotoPlacement(canvas, painted);
  /* 🔤 THE WORDS FOLLOW THE SCENE'S OWN GROUND — for every couple, never Pro
     (owner 2026-09-25: "did you already make the font color adapt also based
     on the background?"). A flat colour re-derives the ink, heading and
     eyebrow through the Phase 3 rule (`hubLegibility`); nothing here reads an
     entitlement. A photo or clip keeps the frame's measured scrim. */
  const tint = hubBackgroundTint(bg);
  const legible =
    tint && placement === 'behind' ? sceneLegibilityVars(INVITE_THEMES[hubTheme ?? 'house'], tint) : null;
  return (
    <>
    <div
      className={hubCanvasClass(canvas, painted)}
      style={{ ...hubCanvasVars(canvas, placement === 'none' ? null : mediaUrl), ...legible } as React.CSSProperties}
    >
      {/* Beside the words: a clipping box around a CHILDLESS picture layer, so
          the couple's zoom stays inside its own column and — like the
          background layer — nothing can sit under its transform. */}
      {placement === 'beside' ? (
        <div aria-hidden className="hub-canvas-photo">
          <div className="hub-canvas-photo-img" />
        </div>
      ) : placement === 'behind' && bg?.kind === 'snippet' && mediaUrl ? (
        /* 🔑 A SNIPPET IS TEXTURE, NOT A FILM, and every attribute here says so.
           `muted` + `playsInline` because a background that makes noise or
           jumps to fullscreen on iOS is not a background; `loop` because a few
           seconds that stop dead leave a frozen frame behind the words;
           `preload="metadata"` because a guest on mobile data did not ask to
           download a video to read a page. `aria-hidden` and no controls: there
           is nothing here to operate, and a screen reader announcing a media
           player in the middle of the couple's words is noise.
           ⚠ The ref reached here through the SAME `hubMediaRef` allow-list a
           photo passes — one field, one fence. */
        <video
          aria-hidden
          className="hub-canvas-media"
          src={mediaUrl}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          tabIndex={-1}
        />
      ) : placement === 'behind' && mediaUrl && bg?.kind === 'photo' ? (
        <div aria-hidden className="hub-canvas-media" />
      ) : null}
      {/* The words sit above the picture, in their own layer, so the section's
          own spacing is untouched by the background existing. */}
      <div className="hub-canvas-body">{children}</div>
    </div>
    {elementStyle}
    </>
  );
}
