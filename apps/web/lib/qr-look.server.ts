import type { SupabaseClient } from '@supabase/supabase-js';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { asViewed } from '@/lib/view-as-free.server';
import { HERO_MONOGRAM_COLUMNS } from '@/lib/hero-monogram-data';
import { getPrimaryColor, PALETTE_ORDER, sanitizeRolePalette } from '@/lib/mood-board';
import { resolveMonogram } from '@/lib/monogram';
import { resolveEventMonogramSvg } from '@/lib/monogram-svg-safe';
import { overlayHubDraftEvent, type HubDraftEvents } from '@/lib/hub-draft';
import {
  FREE_QR_LOOK,
  qrInkChoices,
  qrLookFor,
  qrStyleFromPreferences,
  type QrLook,
  type StoredQrStyle,
} from '@/lib/qr-look';

/**
 * lib/qr-look.server.ts — THE ONE place a QR's look is resolved for an event.
 *
 * Reads Event Hub Pro (`eventCoupleWebsiteProActive` — bundle-aware,
 * admin-approved, and TRUE for §10a internal-hosted events, which is why the
 * owner's own event always shows the Pro side), the couple's saved choices
 * (`events.style_preferences.qr`), their palette, and their mark — the drawn
 * logo through `resolveEventMonogramSvg`, the SAME resolver the Event Hub hero
 * uses (lib/hero-monogram-data.ts), never a second one — and hands back a
 * `QrLook` every renderer in lib/qr.ts accepts.
 *
 * Deliberately NOT 'server-only': lib/entitlements.ts is imported by unit
 * tests already, and marking this would stop `tsx --test` from exercising the
 * composition with a stub client.
 *
 * A read that FAILS answers FREE_QR_LOOK — the free look is the safe degrade
 * (every code still carries a mark and still scans), and a Pro couple briefly
 * seeing the Setnayan mark is a smaller wrong than a free couple being handed
 * Pro styling nobody paid for.
 */

/** The event columns a look needs, beyond the canonical monogram list. */
export const QR_LOOK_EXTRA_COLUMNS = 'role_palette, style_preferences';

/**
 * Reusable SELECT fragment: the canonical monogram list + the look's own two.
 *
 * A COMPOSITE of the canonical constant, deliberately not a copy of its text:
 * two spellings of one column list is how two surfaces start disagreeing. The
 * select-column scanner (lib/security/select-column-scan.ts) resolves this
 * shape — `${A_COLUMNS}, literal` — through `extractSelectConstantComposites`,
 * added with this constant (2026-09-28) so every `select(QR_LOOK_COLUMNS)` site
 * stays a select T1 can check. A literal copy here would instead have made the
 * dup-rule scanner treat it as a 59th canonical list and file 52 "omit" facts
 * about unrelated selects.
 */
export const QR_LOOK_COLUMNS = `${HERO_MONOGRAM_COLUMNS}, ${QR_LOOK_EXTRA_COLUMNS}`;

/**
 * For the invite doors, whose select ALREADY carries `display_name,
 * monogram_text, monogram_color` (`INVITE_LOOK_COLUMNS` = `HUB_LOOK_COLUMNS`)
 * and `monogram_custom_svg, monogram_uploaded_svg, role_palette`
 * (`INVITE_MARK_COLUMNS`, the door's own seal since 2026-09-28): the rest of the
 * look's columns, so the three lists sit side by side without naming a column
 * twice. Kept equal to HERO_MONOGRAM_COLUMNS minus those six, plus
 * `style_preferences` — asserted in lib/every-qr-look-decodes.test.ts so it
 * cannot drift from the canonical list.
 */
export const QR_LOOK_COLUMNS_AFTER_INVITE_MARK =
  'monogram_font_key, monogram_style, monogram_frame_key, monogram_motion_key, monogram_studio_config, style_preferences';

/** The row shape `resolveEventQrLook` reads. Every field optional: a caller
 *  that selected fewer columns degrades (no drawn logo → the lockup; no palette
 *  → ink; no saved choices → square · classic), never throws. */
export type QrLookRow = {
  display_name?: string | null;
  monogram_text?: string | null;
  monogram_color?: string | null;
  monogram_font_key?: string | null;
  monogram_style?: string | null;
  monogram_frame_key?: string | null;
  monogram_custom_svg?: string | null;
  monogram_uploaded_svg?: string | null;
  role_palette?: unknown;
  style_preferences?: unknown;
};

/** What the Maker's Details controls need to draw the three dropdowns. */
export type QrLookChoices = {
  ownsPro: boolean;
  style: StoredQrStyle;
  /** Contrast-passing palette hexes, palette order, deduplicated. */
  inks: string[];
};

/** Pure half — compose from an already-measured `ownsPro` and a row. */
export function qrLookFromRow(row: QrLookRow | null | undefined, ownsPro: boolean): QrLook {
  if (!row) return FREE_QR_LOOK;
  if (!ownsPro) return FREE_QR_LOOK;
  const palette = sanitizeRolePalette(row.role_palette ?? {});
  const ink = getPrimaryColor(palette, 'reception') ?? null;
  return qrLookFor({
    ownsPro,
    style: qrStyleFromPreferences(row.style_preferences),
    monogram: resolveMonogram({
      display_name: row.display_name ?? null,
      monogram_text: row.monogram_text ?? null,
      monogram_color: row.monogram_color ?? null,
      monogram_font_key: row.monogram_font_key ?? null,
      monogram_style: row.monogram_style ?? null,
      monogram_frame_key: row.monogram_frame_key ?? null,
    }),
    logoSvg: resolveEventMonogramSvg(row, { ink }),
  });
}

/**
 * 💾 THE HOST'S DRAFTED LOOK — for a Maker PREVIEW only, never for a file that
 * is saved or printed and never for a guest. When the draft holds a QR look
 * (`style_preferences`, written by `updateQrStyle`), the code is drawn with it
 * laid over the live row and worn as Pro would wear it: the host sees what
 * they are trying before paying, and Pro decides only at Apply (owner
 * 2026-09-29, #6113). Null when the draft holds no QR look — the caller then
 * draws the live look (`resolveEventQrLook`).
 *
 * ONE rule for every Maker preview of a code: the event QR beside the address
 * (`/api/website/qr/[slug]?draft=1`), the Guest QR codes sheet and every set
 * piece's corner QR and pass (`/api/hub-print/[piece]` with `draft=`). Before
 * 2026-10-06 only the first followed the draft — the owner changed the style
 * and asked why the guest QR codes had not changed.
 */
export function qrLookForHostDraft(
  liveRow: QrLookRow | null | undefined,
  draftEvents: HubDraftEvents | null | undefined,
): QrLook | null {
  if (!liveRow || !draftEvents || !('style_preferences' in draftEvents)) return null;
  const shown = overlayHubDraftEvent(liveRow as Record<string, unknown>, { events: draftEvents, widgets: {} });
  return qrLookFromRow(shown as QrLookRow, true);
}

/** Pure half for the controls — the choices a couple may pick from. */
export function qrLookChoicesFromRow(row: QrLookRow | null | undefined, ownsPro: boolean): QrLookChoices {
  const palette = sanitizeRolePalette(row?.role_palette ?? {});
  return {
    ownsPro,
    style: qrStyleFromPreferences(row?.style_preferences),
    inks: qrInkChoices(palette as Record<string, unknown>, PALETTE_ORDER),
  };
}

/**
 * Resolve the look for an event whose row the caller already holds (selected
 * with `QR_LOOK_COLUMNS`, or any subset). `client` must be able to read the
 * event's orders — the admin client on anonymous surfaces.
 */
export async function resolveEventQrLook(
  client: SupabaseClient,
  eventId: string,
  row: QrLookRow | null | undefined,
): Promise<QrLook> {
  if (!row) return FREE_QR_LOOK;
  let ownsPro = false;
  try {
    // 👁 As the viewer is shown it — a QR is drawn, never written, here.
    ownsPro = await asViewed(eventCoupleWebsiteProActive(client, eventId));
  } catch (err) {
    console.error('[qr-look] Event Hub Pro could not be read; rendering the free look', err instanceof Error ? err.message : err);
    ownsPro = false;
  }
  return qrLookFromRow(row, ownsPro);
}
