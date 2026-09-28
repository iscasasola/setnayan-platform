import { hasHubCanvas, sanitizeHubCanvas } from '@/lib/hub-canvas';
import { sceneGround } from '@/lib/scene-ground';
import { SceneClip } from './scene-clip';
import type { InvitationWidgetRow } from '@/lib/invitation-widgets';
import { INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';
import { sceneFrameLook } from '@/lib/scene-frame-look';
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
  ownClipPlays = false,
  children,
}: {
  widget: InvitationWidgetRow;
  /**
   * 🎞 The couple's own Maker canvas (a verified host) — their clip plays.
   * Absent for every guest: the SEC-6 gate in `sceneGround` then decides.
   */
  ownClipPlays?: boolean;
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
  const ground = sceneGround(widget, mediaUrls, { ownClipPlays });
  const { bg, mediaUrl, painted } = ground;
  /* WHERE the picture goes (`hubPhotoPlacement`), the frame's classes and its
     variables, and — 🔤 THE WORDS FOLLOW THE SCENE'S OWN GROUND, for every
     couple, never Pro (owner 2026-09-25) — the legibility tokens: a flat
     colour, both ombrés over their ramp, both glasses over the pane at the
     couple's own opacity (`sceneTintGround`), a photo or clip under its light
     scrim. ONE answer (`lib/scene-frame-look.ts`), read by this frame and by
     the Maker's instant background preview, so the two cannot differ. */
  /* The GROUND's canvas: a clip that may not play here is drawn as its still. */
  const look = sceneFrameLook(ground.canvas, { bg, mediaUrl, painted }, INVITE_THEMES[hubTheme ?? 'house']);
  const placement = look.placement;
  return (
    <>
    <div
      className={look.className}
      style={look.style as React.CSSProperties}
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
        /* The shipped scene clip (`scene-clip.tsx`): muted, looping, inline,
           no controls — and played ONLY while on screen, never under reduced
           motion. */
        <SceneClip src={mediaUrl} play="loop" open="inplace" label="" className="hub-canvas-media" />
      ) : placement === 'behind' && mediaUrl && bg?.kind === 'photo' ? (
        /* 🌄 Parallax rides the SHIPPED hero parallax: `PahinaCoverParallax`
           finds `[data-pahina-parallax]` and writes one custom property; the
           `.pahina-js` rule in globals.css moves the layer. */
        <div
          aria-hidden
          className="hub-canvas-media"
          {...(ground.canvas.mediaMotion === 'parallax' ? { 'data-pahina-parallax': '' } : {})}
        />
      ) : null}
      {/* The words sit above the picture, in their own layer, so the section's
          own spacing is untouched by the background existing. */}
      <div className="hub-canvas-body">{children}</div>
    </div>
    {elementStyle}
    </>
  );
}
