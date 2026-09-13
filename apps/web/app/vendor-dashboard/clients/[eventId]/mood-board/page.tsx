import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Palette } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { PALETTE_LIMITS, PALETTE_ORDER, sanitizeRolePalette, type PaletteKey } from '@/lib/mood-board';
import {
  renderVenueSvg,
  sanitizeReceptionDesign,
  type ReceptionDesign,
  type RoleColors,
} from '@/lib/reception-scene';
import { fetchDecorLayerCatalog, renderDecorLayerDataUrl } from '@/lib/reception-decor-layers-server';
import { PILOT_DECOR_ZONES } from '@/lib/reception-decor-layers';
import { isMoodboardStyleFamily } from '@/lib/moodboard-templates';
import type { PartId } from '@/lib/reception-scene';
import { renderPartLabel } from '@/lib/moodboard-finalization';
import { VendorPartSignoff, type VendorSignoffRow } from '../_components/vendor-part-signoff';
import { ColourLaneEditor } from '../_components/colour-lane-editor';
import { editableSwatches, isColourDomain, type ColourDomain, type EditableSwatch } from '@/lib/colour-access';
import { applyColourChange } from '@/app/dashboard/[eventId]/colour-access-actions';
import {
  vendorAgreeToPart,
  vendorAnswerPartReopen,
  vendorDeclinePart,
} from '../finalization-actions';

export const metadata = { title: 'Mood Board · Vendor' };

/**
 * Read-only mood board for booked vendors — lets them align their booth,
 * decor, florals, or styling to the couple's palette + reception design.
 *
 * Booked-gate lives in the get_vendor_mood_board SECURITY DEFINER RPC:
 * raises if the calling vendor isn't in event_vendors for this event.
 *
 * No guest data, no PII — only palette colors, reception design choices,
 * and uploaded inspiration reference images.
 */

type MoodBoardData = {
  display_name: string | null;
  role_palette: Record<string, string[]>;
  reception_design: ReceptionDesign;
  mood_board_updated_at: string | null;
  theme_name: string | null;
  theme_description: string | null;
  /** `events.moodboard_style_family` — added to the RPC by 20271197327520.
   *  Typed `string | null` (not the narrow union) because it arrives from
   *  jsonb: it is re-validated against the shipped vocabulary before use. */
  style_family: string | null;
  inspirations: Array<{ slot_key: string; slot_position: number; image_url: string }>;
};

type Props = { params: Promise<{ eventId: string }> };

export default async function VendorMoodBoardPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const { data, error } = await supabase.rpc('get_vendor_mood_board', {
    p_event_id: eventId,
  });
  if (error || !data) redirect(`/vendor-dashboard/clients/${eventId}`);

  const board = data as MoodBoardData;

  // ── MB12: what this supplier has been asked to sign off on ───────────────
  // Read with the supplier's OWN client, through
  // `moodboard_part_finalizations_vendor_read`, which is scoped to the BOOKING
  // (`current_vendor_event_vendor_ids`) rather than to the event — so a shop
  // sees the parts it was asked about and nothing else on this board.
  //
  // ⚠ A REFUSED READ IS NOT "NOTHING TO ANSWER". An error renders identically
  // to a board with no open asks, and the supplier would simply never answer.
  // Logged, and the section is omitted only when the read genuinely returned
  // nothing.
  const { data: signoffRows, error: signoffError } = await supabase
    .from('moodboard_part_finalizations')
    .select('finalization_id, part_id, state, expires_at, reopen_state, reopen_expires_at')
    .eq('event_id', eventId)
    .in('state', ['pending', 'agreed'])
    .order('created_at', { ascending: true });
  if (signoffError) {
    console.error(
      `[vendorMoodBoard] sign-off rows unreadable for event_id=${eventId}:`,
      signoffError.message,
    );
  }
  const signoffs: VendorSignoffRow[] = (signoffRows ?? []).map((r) => {
    const row = r as {
      finalization_id: string;
      part_id: string;
      state: string;
      expires_at: string | null;
      reopen_state: string | null;
      reopen_expires_at: string | null;
    };
    return {
      finalizationId: row.finalization_id,
      partLabel: renderPartLabel(row.part_id),
      state: row.state,
      expiresAt: row.expires_at,
      reopenState: row.reopen_state,
      reopenExpiresAt: row.reopen_expires_at,
    };
  });
  // SANITIZE, never cast. `as RolePalette` asserted a shape nobody had checked:
  // the RPC hands back raw jsonb, and its hex strings land directly in a
  // `style={{ backgroundColor: hex }}` swatch below. Every other surface that
  // reads role_palette — the couple's own board, the venue walk, the QR and
  // PDF routes — runs it through sanitizeRolePalette first, so this mirror was
  // the one place a vendor could be shown a palette the couple's own board
  // would not draw. Two surfaces disagreeing about one fact is the exact
  // disease this repo keeps getting bitten by.
  //
  // Safe for couple-authored extras: sanitizeRolePalette preserves custom_roles
  // and room_dressing explicitly rather than letting the PALETTE_ORDER rebuild
  // drop them, and the rows below read palette.custom_roles.
  const palette = sanitizeRolePalette(board.role_palette ?? {});

  // Build palette rows — only keys that have at least one color saved.
  // Couple-authored `custom_roles` beyond the fixed taxonomy are appended
  // after the fixed rows, never replacing any of them.
  const paletteRows = [
    ...PALETTE_ORDER.map((key) => ({
      key: key as string,
      label: PALETTE_LIMITS[key as PaletteKey]?.label ?? key,
      colors: palette[key as PaletteKey] ?? [],
    })),
    ...(palette.custom_roles ?? []).map((r) => ({
      key: r.key,
      label: r.label,
      colors: r.colors,
    })),
  ].filter((r) => r.colors.length > 0);

  // Reception scene SVG — server-rendered, palette-tinted, read-only
  const roleColors: RoleColors = {
    bride: palette.bride?.[0],
    groom: palette.groom?.[0],
    party: palette.wedding_party?.[0],
    guest: palette.guest?.[0],
    guestPalette: palette.guest ?? [],
  };
  // Through the sanitizer, like every other reader: it enforces the
  // multi-select cap and the valid-option-id rule, so a hand-edited JSONB blob
  // can't draw nine ceiling treatments onto a supplier's screen.
  const receptionDesign = sanitizeReceptionDesign(board.reception_design);
  const receptionSvg = renderVenueSvg(receptionDesign, palette.reception ?? [], roleColors);

  // AI decor-image layer PILOT (backdrop + ceiling — see
  // @/lib/reception-decor-layers).
  //
  // ✅ `styleFamily` IS NO LONGER HARD-CODED NULL (2026-09-03). It used to be,
  // and this comment used to explain why: nothing anywhere persisted a style
  // family for an event, because applyMoodboardTemplate merged a template's
  // palette + reception_design in and discarded which family produced them.
  // `events.moodboard_style_family` (migration 20271197327520) is now that
  // record, and `get_vendor_mood_board` returns it as `style_family`.
  //
  // ⚠ ONE OF THE TWO PRECONDITIONS IS STILL OPEN, SO NOTHING RENDERS YET. The
  // 10 pilot asset rows migration 20271194970382 seeded carry approved_at =
  // NULL (the generated files were never uploaded to R2) and the catalog read
  // requires approved, so `fetchDecorLayerCatalog` still returns EMPTY here
  // and every zone still falls back to the flat SVG — now for the one
  // remaining reason (no approved images) rather than two.
  const decorCatalog = await fetchDecorLayerCatalog(supabase);
  const styleFamily = isMoodboardStyleFamily(board.style_family) ? board.style_family : null;
  const decorLayerEntries = await Promise.all(
    PILOT_DECOR_ZONES.map(async (zone) => {
      const dataUrl = await renderDecorLayerDataUrl(
        zone,
        styleFamily,
        decorCatalog,
        palette.reception ?? [],
      );
      return [zone, dataUrl] as const;
    }),
  );
  const decorImages = Object.fromEntries(
    decorLayerEntries.filter((e): e is [PartId, string] => e[1] !== null),
  );
  // Same zone bounding boxes the couple-facing Reception Designer's HOTSPOTS
  // uses (app/dashboard/[eventId]/studio/mood-board/_components/reception-
  // designer.tsx) — reused, not redefined, so an image layer lands exactly
  // where the flat SVG drew that zone.
  const DECOR_ZONE_BOUNDS: Partial<Record<PartId, { l: number; t: number; w: number; h: number }>> = {
    ceiling: { l: 4, t: 0, w: 92, h: 20 },
    backdrop: { l: 33, t: 22, w: 34, h: 26 },
  };

  // ── MB16 · which colours, if any, this supplier may change ───────────────
  //
  // Read with the supplier's OWN client through
  // `event_colour_grants_vendor_read`, which is scoped to the BOOKING via
  // `current_vendor_event_vendor_ids()` — so a shop sees its own grant and
  // nothing else about this board's permissions.
  //
  // ⚠ A REFUSED READ RENDERS AS "NO GRANT", which is indistinguishable from
  // the couple never having given one. Logged. The consequence of getting it
  // wrong is mild in this direction (the supplier sees the board they saw
  // yesterday and the RPC would have let them write) — but it is still a
  // silence, and a silence is what this whole session is about.
  const { data: grantRows, error: grantError } = await supabase
    .from('event_colour_grants')
    .select('domain, is_active')
    .eq('event_id', eventId)
    .eq('is_active', true);
  if (grantError) {
    console.error(
      `[vendorMoodBoard] colour grants unreadable for event_id=${eventId}:`,
      grantError.message,
    );
  }
  const grantedDomains: ColourDomain[] = [
    ...new Set(
      ((grantRows ?? []) as { domain: string }[])
        .map((r) => r.domain)
        .filter(isColourDomain),
    ),
  ];
  const colourSwatches: EditableSwatch[] =
    grantedDomains.length > 0 ? editableSwatches(grantedDomains, palette) : [];

  const hasInspiration = board.inspirations.length > 0;
  const hasPalette = paletteRows.length > 0;
  const hasReception =
    board.reception_design && Object.keys(board.reception_design).length > 0;
  const nothingYet = !hasPalette && !hasReception && !hasInspiration;

  return (
    <div className="space-y-6">
      <Link
        href={`/vendor-dashboard/clients/${eventId}`}
        className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to event brief
      </Link>

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          <Palette className="h-7 w-7 text-terracotta" aria-hidden />
          Mood Board
        </h1>
        {board.display_name ? (
          <p className="text-base text-ink/60">{board.display_name}</p>
        ) : null}
        {board.theme_name ? (
          <div className="pt-1">
            <p className="text-xl font-semibold text-ink">{board.theme_name}</p>
            {board.theme_description ? (
              <p className="max-w-prose text-sm text-ink/60">{board.theme_description}</p>
            ) : null}
          </div>
        ) : null}
        {board.mood_board_updated_at ? (
          <p className="text-xs text-ink/40">
            Last updated by the couple{' '}
            {new Date(board.mood_board_updated_at).toLocaleDateString('en-PH', {
              dateStyle: 'medium',
            })}
          </p>
        ) : null}
      </header>

      {nothingYet ? (
        <div className="sn-tile px-6 py-10 text-center">
          <p className="text-base text-ink/55">
            The couple hasn&rsquo;t set their mood board yet. Check back once they&rsquo;ve saved
            their palette.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* MB12 — the ask sits ABOVE the design, because it is the reason the
              supplier opened this page. Renders nothing when there is nothing
              to answer. */}
          <VendorPartSignoff
            rows={signoffs}
            agreeAction={vendorAgreeToPart}
            declineAction={vendorDeclinePart}
            answerReopenAction={vendorAnswerPartReopen}
          />

          {/* MB16 — the swatches this supplier may change, if the couple gave
              them any. Above the read-only palette below it, because a control
              underneath the thing it controls is one nobody finds; renders
              nothing at all without a grant. */}
          <ColourLaneEditor
            swatches={colourSwatches}
            applyAction={applyColourChange.bind(null, eventId)}
          />

          {/* Palette */}
          {hasPalette ? (
            <section className="sn-tile p-5 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold">Palette</h2>
              <ul className="space-y-3">
                {paletteRows.map(({ key, label, colors }) => (
                  <li key={key} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-ink/70">{label}</span>
                    <span className="flex flex-wrap justify-end gap-1.5">
                      {colors.map((hex, i) => (
                        <span
                          key={`${hex}-${i}`}
                          title={hex}
                          className="h-7 w-7 rounded-full border border-ink/15 shadow-sm"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Reception scene — read-only SVG render */}
          {hasReception ? (
            <section className="sn-tile p-5 sm:p-6">
              <h2 className="mb-1 text-lg font-semibold">Reception design</h2>
              <p className="mb-4 text-sm text-ink/55">
                The couple&rsquo;s chosen materials and treatments — ceiling, backdrop, stage,
                tables, entrance — rendered in their palette.
              </p>
              <div className="relative overflow-hidden rounded-xl">
                <div dangerouslySetInnerHTML={{ __html: receptionSvg }} />
                {/* AI decor-image layer pilot — composited on top of the flat
                    SVG at the exact zone bounds, only for zones that resolved
                    to a retinted image server-side this render. */}
                {(Object.entries(decorImages) as Array<[PartId, string]>).map(
                  ([zone, dataUrl]) => {
                    const bounds = DECOR_ZONE_BOUNDS[zone];
                    if (!bounds) return null;
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={zone}
                        src={dataUrl}
                        alt=""
                        aria-hidden="true"
                        className="pointer-events-none absolute rounded-sm object-cover"
                        style={{
                          left: `${bounds.l}%`,
                          top: `${bounds.t}%`,
                          width: `${bounds.w}%`,
                          height: `${bounds.h}%`,
                        }}
                      />
                    );
                  },
                )}
              </div>
            </section>
          ) : null}

          {/* Inspiration photos */}
          {hasInspiration ? (
            <section className="sn-tile p-5 sm:p-6">
              <h2 className="mb-1 text-lg font-semibold">Inspirations</h2>
              <p className="mb-4 text-sm text-ink/55">
                Reference images the couple uploaded — venues, backdrops, florals, styling
                they love.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {board.inspirations.map((item) => (
                  <div
                    key={`${item.slot_key}-${item.slot_position}`}
                    className="aspect-square overflow-hidden rounded-xl bg-ink/5"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image_url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
