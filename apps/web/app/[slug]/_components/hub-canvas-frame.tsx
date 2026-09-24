import {
  hasHubCanvas,
  hubCanvasClass,
  hubCanvasVars,
  hubPhotoPlacement,
  sanitizeHubCanvas,
} from '@/lib/hub-canvas';
import type { InvitationWidgetRow } from '@/lib/invitation-widgets';

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
  children: React.ReactNode;
}) {
  if (children === null) return null;
  const canvas = sanitizeHubCanvas(widget.config_json);
  if (!hasHubCanvas(canvas)) return <>{children}</>;
  /* ⛔ A ref whose signing FAILED is not a picture. A deleted object or a
     refused bucket resolves to nothing, and the section must then render as a
     section with no background — never as a styled plate waiting for an image
     that is not coming, which reads to a guest as a broken page. */
  const mediaUrl = canvas.media ? (mediaUrls?.[canvas.media] ?? null) : null;
  /* WHERE the picture goes is the arrangement's call (`hubPhotoPlacement`):
     behind the words, in its own column beside them, or — for "Words only" —
     nowhere. The frame draws exactly the one layer that answer names. */
  const placement = hubPhotoPlacement(canvas, Boolean(mediaUrl));
  return (
    <div
      className={hubCanvasClass(canvas, Boolean(mediaUrl))}
      style={hubCanvasVars(canvas, placement === 'none' ? null : mediaUrl) as React.CSSProperties}
    >
      {placement === 'behind' ? <div aria-hidden className="hub-canvas-media" /> : null}
      {/* Beside the words: a clipping box around a CHILDLESS picture layer, so
          the couple's zoom stays inside its own column and — like the
          background layer — nothing can sit under its transform. */}
      {placement === 'beside' ? (
        <div aria-hidden className="hub-canvas-photo">
          <div className="hub-canvas-photo-img" />
        </div>
      ) : null}
      {/* The words sit above the picture, in their own layer, so the section's
          own spacing is untouched by the background existing. */}
      <div className="hub-canvas-body">{children}</div>
    </div>
  );
}
