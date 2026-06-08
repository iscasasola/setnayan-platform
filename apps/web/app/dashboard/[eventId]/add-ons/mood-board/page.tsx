import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchGuestsByEvent } from '@/lib/guests';
import { roleGroupOf, type RoleGroup } from '@/lib/role-groups';
import {
  sanitizeRolePalette,
  type PaletteKey,
  type RolePalette,
} from '@/lib/mood-board';
import { saveRolePalette } from './actions';
import { PaletteEditor } from './_components/palette-editor';
import {
  MoodboardChapters,
  type ChapterAsset,
  type ChapterSave,
} from './_components/moodboard-chapters';
import {
  WeddingAttireGuide,
  type AssetsByRoleAndStyle,
  type RoleAsset,
} from './_components/wedding-attire-guide';
import type { ColorRangeMap } from '@/lib/color-recolor';

const MOODBOARD_BUCKET = 'moodboard-library';

export const metadata = { title: 'Mood Board' };

type Props = { params: Promise<{ eventId: string }> };

export default async function MoodBoardPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [eventRes, guests, attireAssetsRes] = await Promise.all([
    supabase
      .from('events')
      .select(
        // attire_guide_palette · migration 20260610010000 · Wedding Attire
        // Guide per-role colors (owner directive 2026-05-23 PM). Defaults
        // to {} per the migration; component fills with reference hexes
        // when keys are absent.
        'event_id, display_name, role_palette, mood_board_updated_at, attire_guide_palette',
      )
      .eq('event_id', eventId)
      .maybeSingle(),
    fetchGuestsByEvent(supabase, eventId),
    // Real-photo assets for Wedding Attire Guide per-role figures —
    // owner directive 2026-05-23 PM ("want something like this but Filipina
    // face + recolorable + same for men" · Pinterest wedding-guest-dresses
    // collage reference). Fetches from moodboard_library_assets filtered
    // by asset_type='figure_attire' (other rows are venue_scene); joins
    // the slot-1 color range for the future Color Range Manipulator engine.
    // V1 placeholder seed lives in migration 20260611000000 — Pexels
    // free-commercial stock photos hot-linked. RLS limits this to
    // approved + non-retired rows. WeddingAttireGuide gracefully renders
    // SVG silhouette fallbacks for any role missing an asset.
    supabase
      .from('moodboard_library_assets')
      .select(
        // style_theme · migration 20260613000000 · the 5-style × 10-role
        // Recraft V3 library uses this column to bucket figures into
        // STYLE_OPTIONS sets (elegant·simple·classic, bridgerton·regal,
        // editorial cream, tropical heritage, modern minimalist). NULL
        // here means a legacy pre-style-themed row (e.g., the retired
        // Pexels seed) — falls through the resolveAsset chain in the
        // component to the legacy flat-map path.
        `asset_subtype, label, storage_path, style_theme,
         moodboard_asset_color_ranges!inner ( slot_id, sampled_hex )`,
      )
      .eq('asset_type', 'figure_attire')
      .eq('moodboard_asset_color_ranges.slot_id', 1)
      .not('approved_at', 'is', null)
      .is('retired_at', null),
  ]);
  const event = eventRes.data;
  if (!event) notFound();

  // Build the asset maps. Defensive against schema returning the join as
  // an array (PostgREST nested-select shape) or as a single object — both
  // shapes valid depending on PostgREST version. Two output shapes:
  //   1. attireAssetsByRole       — legacy flat map (Pexels-seed era / no style)
  //   2. attireAssetsByRoleAndStyle — Recraft library nested map (active)
  // The WeddingAttireGuide component prefers (2) when both populated for
  // a role; (1) is the backwards-compat fallback for pre-style-themed rows.
  type AttireAssetRow = {
    asset_subtype: string | null;
    label: string;
    storage_path: string;
    style_theme: string | null;
    moodboard_asset_color_ranges:
      | Array<{ slot_id: number; sampled_hex: string }>
      | { slot_id: number; sampled_hex: string }
      | null;
  };
  const attireAssetsByRole: Record<string, RoleAsset> = {};
  const attireAssetsByRoleAndStyle: Record<
    string,
    Record<string, RoleAsset>
  > = {};
  for (const row of (attireAssetsRes.data ?? []) as AttireAssetRow[]) {
    if (!row.asset_subtype) continue;
    const ranges = Array.isArray(row.moodboard_asset_color_ranges)
      ? row.moodboard_asset_color_ranges
      : row.moodboard_asset_color_ranges
        ? [row.moodboard_asset_color_ranges]
        : [];
    const slot1 = ranges.find((r) => r.slot_id === 1);
    const asset: RoleAsset = {
      url: row.storage_path,
      sampledHex: slot1?.sampled_hex ?? '#E8C9B8',
      label: row.label,
    };
    if (row.style_theme) {
      // Recraft library row — bucket into the nested map by style.
      // Local extraction to dodge the noUncheckedIndexedAccess error
      // that fires on the chained access pattern.
      const subMap =
        attireAssetsByRoleAndStyle[row.asset_subtype] ?? {};
      subMap[row.style_theme] = asset;
      attireAssetsByRoleAndStyle[row.asset_subtype] = subMap;
    } else {
      // Legacy pre-style-themed row (Pexels seed era · retired but kept
      // visible if admin un-retires). First-write-wins keeps the legacy
      // path deterministic without per-row tiebreaker logic.
      if (!attireAssetsByRole[row.asset_subtype]) {
        attireAssetsByRole[row.asset_subtype] = asset;
      }
    }
  }

  const palette = sanitizeRolePalette(event.role_palette ?? {});
  // Wedding Attire Guide per-role colors — JSONB column, defaults to {}.
  // Defensive cast: PostgREST returns `unknown` for JSONB, so verify
  // shape before passing to the client component.
  const attireGuidePalette =
    event.attire_guide_palette && typeof event.attire_guide_palette === 'object'
      ? (event.attire_guide_palette as Record<string, string>)
      : {};

  // Flatten role_palette to {role → first color} for the visual preview
  // pillars + Wedding Attire Guide mockup — they pick ONE accent per
  // role for the silhouette tint, not the full multi-color list.
  //
  // Moved UP to the data-prep block (was inside an IIFE in the JSX) so
  // both downstream components get a clean prop without the IIFE wrapper
  // that was suppressing the WeddingAttireGuide section from rendering
  // in production. IIFE wrapping an async server component + a client
  // component children was the fragile pattern — flat top-level JSX is
  // the React 19 + Next.js 15 reliable shape.
  const flatPalette = Object.fromEntries(
    Object.entries(palette).flatMap(([role, colors]) =>
      colors && colors.length > 0 && typeof colors[0] === 'string'
        ? [[role, colors[0]] as const]
        : [],
    ),
  );

  // Conditional rendering: a role-family palette section only shows when at
  // least one guest exists in that group. Couples + venue palettes always show.
  const presentRoleGroups = new Set<RoleGroup>();
  for (const g of guests) {
    const group = roleGroupOf(g.role);
    if (group !== 'guest') presentRoleGroups.add(group);
  }
  const visibleKeys = new Set<PaletteKey>([
    'ceremony',
    'reception',
    'bride',
    'groom',
    'guest',
  ]);
  if (presentRoleGroups.has('wedding_party')) visibleKeys.add('wedding_party');
  if (presentRoleGroups.has('principal_sponsors')) visibleKeys.add('principal_sponsors');
  if (presentRoleGroups.has('secondary_sponsors')) visibleKeys.add('secondary_sponsors');
  if (presentRoleGroups.has('bearers_flower_girl')) visibleKeys.add('bearers_flower_girl');
  if (presentRoleGroups.has('officiants')) visibleKeys.add('officiants');

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/add-ons`}
        className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
      >
        ‹ Back to add-ons
      </Link>

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Mood Board
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Set your colors once, then see them land on real photos across four chapters —
          Church, Reception, Attire, and Flowers. Tap any part of a photo and recolor it:
          snap it to a palette color, or fine-tune the hue, brightness, and contrast by hand.
        </p>
        {event.mood_board_updated_at ? (
          <p className="text-xs text-ink/55">
            Last saved {new Date(event.mood_board_updated_at).toLocaleString()}
          </p>
        ) : null}
      </header>

      <PaletteEditor
        eventId={eventId}
        initial={palette}
        visibleKeys={Array.from(visibleKeys)}
        saveAction={saveRolePalette}
      />

      <ChaptersSection eventId={eventId} palette={palette} />

      {/* Wedding Attire Guide preview — owner directive 2026-05-23 PM.
          Clickable mockup of the V1.x Professional Mood Board
          group-portrait composition (2-tier wedding party with
          annotated swatch + descriptor per role group). Uses the
          same flattened palette as the visual preview above so
          changes the host makes in the PaletteEditor flow through
          automatically. See the component for the V1.x-vs-V1
          scope reasoning.

          attireGuidePalette = host's saved per-role attire colors
          from the new events.attire_guide_palette JSONB column
          (migration 20260610010000). Empty {} = component uses
          reference defaults from its ROLES array. Per-role color
          picker on the component persists to this column via
          saveAttireGuidePaletteColor server action — owner
          directive: "we want the capability to change the color
          of the attires of each role."

          Previously wrapped in an IIFE alongside VisualPreviewSection
          (PR #446 + #447). That IIFE pattern silently suppressed this
          section from rendering in production — async server component
          + client component siblings inside an IIFE-returned fragment
          is fragile in React 19 + Next 15. Flat top-level JSX is the
          reliable shape; flatPalette + attireGuidePalette are both
          prepared in the data block above. */}
      <WeddingAttireGuide
        eventId={eventId}
        rolePalette={flatPalette}
        attirePalette={attireGuidePalette}
        assetsByRole={attireAssetsByRole}
        assetsByRoleAndStyle={
          attireAssetsByRoleAndStyle as AssetsByRoleAndStyle
        }
      />

      <section className="space-y-3 rounded-2xl border border-dashed border-ink/15 bg-cream p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Coming later
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-ink/65">
          <li>Custom role palettes (define your own role with its own colors)</li>
          <li>20-theme curated library</li>
          <li>Setnayan Guide rule engine (cohesion · contrast · temperature · saturation)</li>
          <li>AI Composite Scene — paste your own inspiration photos and generate a bespoke scene (Professional Mood Board)</li>
          <li>Stylist uploads from their own Google Drive (V1.x)</li>
        </ul>
      </section>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Mood Board chapters (Church · Reception · Attire · Flowers) — redesign 2026-06-08.
// Supersedes the 2-pillar "Visual preview" (Location feel + Dress codes). Fetches
// the curated library + the event's saves and hands them to the client-side
// MoodboardChapters, which renders the couple-facing Recolor Studio per asset.
// ----------------------------------------------------------------------------
async function ChaptersSection({
  eventId,
  palette,
}: {
  eventId: string;
  /** The event's full role/venue palette (per-key color arrays). */
  palette: RolePalette;
}) {
  const admin = createAdminClient();

  // Fetch approved library assets + their color ranges + the event's saves.
  const [{ data: templateRows }, { data: rangeRows }, { data: saveRows }] = await Promise.all([
    admin
      .from('moodboard_library_assets')
      .select('asset_id, asset_type, asset_subtype, label, storage_path')
      .not('approved_at', 'is', null)
      .is('retired_at', null)
      .order('created_at', { ascending: false }),
    admin
      .from('moodboard_asset_color_ranges')
      .select('asset_id, slot_id, sampled_hex, tolerance_de, region_label'),
    admin
      .from('event_moodboard_saves')
      .select('save_id, pillar, pillar_slot, asset_id, palette_snapshot, saved_at')
      .eq('event_id', eventId)
      .order('saved_at', { ascending: false }),
  ]);

  const colorRangesByAsset = new Map<string, ColorRangeMap>();
  for (const r of rangeRows ?? []) {
    const existing = colorRangesByAsset.get(r.asset_id) ?? {};
    existing[r.slot_id] = {
      slotId: r.slot_id,
      sampledHex: r.sampled_hex,
      toleranceDe: Number(r.tolerance_de),
      regionLabel: r.region_label ?? undefined,
    };
    colorRangesByAsset.set(r.asset_id, existing);
  }

  const assets: ChapterAsset[] = (templateRows ?? []).map((r) => {
    // Three storage_path shapes:
    //   • absolute URL (legacy picsum/pexels seeds) → use as-is
    //   • app-relative path starting with "/" (e.g. /moodboard-seed/florals/…,
    //     the Recraft-generated Flowers seed shipped in apps/web/public/) →
    //     use as-is. Same-origin so the Recolor Studio's getImageData never
    //     taints the canvas; no Supabase storage round-trip.
    //   • bucket key (admin uploads) → resolve via Supabase Storage
    const isAbsoluteUrl =
      r.storage_path.startsWith('http://') ||
      r.storage_path.startsWith('https://');
    let publicUrl: string;
    if (isAbsoluteUrl || r.storage_path.startsWith('/')) {
      publicUrl = r.storage_path;
    } else {
      const key = r.storage_path.replace(`${MOODBOARD_BUCKET}/`, '');
      const { data: pub } = admin.storage
        .from(MOODBOARD_BUCKET)
        .getPublicUrl(key);
      publicUrl = pub.publicUrl;
    }
    return {
      asset_id: r.asset_id,
      asset_type: r.asset_type as ChapterAsset['asset_type'],
      asset_subtype: r.asset_subtype,
      label: r.label,
      public_url: publicUrl,
      color_ranges: colorRangesByAsset.get(r.asset_id) ?? {},
    };
  });

  const existingSaves: ChapterSave[] = (saveRows ?? []).map((s) => ({
    save_id: s.save_id,
    pillar: s.pillar as ChapterSave['pillar'],
    pillar_slot: s.pillar_slot,
    asset_id: s.asset_id,
    palette_snapshot: (s.palette_snapshot as Record<string, unknown>) ?? {},
    saved_at: s.saved_at,
  }));

  return (
    <section className="space-y-4 border-t border-ink/10 pt-6">
      <header>
        <h2 className="text-2xl font-semibold text-ink">See it in your colors</h2>
        <p className="text-sm text-ink/65">
          Open any photo, tap a part of it, and recolor — snap to a palette color or
          adjust the hue, brightness, and contrast by hand. Save the looks you love.
        </p>
      </header>
      <MoodboardChapters
        eventId={eventId}
        assets={assets}
        existingSaves={existingSaves}
        palette={palette}
      />
    </section>
  );
}
