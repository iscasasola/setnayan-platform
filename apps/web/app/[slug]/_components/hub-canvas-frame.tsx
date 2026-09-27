import {
  hasHubCanvas,
  hubBackgroundTint,
  hubCanvasClass,
  hubCanvasVars,
  hubPhotoPlacement,
  sanitizeHubCanvas,
} from '@/lib/hub-canvas';
import { sceneGround } from '@/lib/scene-ground';
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
     entitlement. A photo or clip keeps the frame's measured scrim.
     🪟 Both glasses too, measured over the pane they actually paint — and the
     pane's own fill comes from the same answer, so the glass is exactly as
     clear as its words allow (`sceneTintGround`). */
  /* 🖼 …and a photo or snippet behind the words: under the light scrim it is a
     light ground, so a dark theme's light page ink must not ride onto it. */
  const tint = hubBackgroundTint(bg);
  const theme = INVITE_THEMES[hubTheme ?? 'house'];
  const legible =
    placement !== 'behind'
      ? null
      : tint && (bg?.kind === 'color' || bg?.kind === 'glass' || bg?.kind === 'frost')
        ? sceneLegibilityVars(theme, tint, bg.kind)
        : mediaUrl && (bg?.kind === 'photo' || bg?.kind === 'snippet')
          ? sceneLegibilityVars(theme, '#ffffff', 'media')
          : null;
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
