import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchGuestsByEvent } from '@/lib/guests';
import { roleGroupOf, type RoleGroup } from '@/lib/role-groups';
import { sanitizeRolePalette, type PaletteKey } from '@/lib/mood-board';
import { saveRolePalette } from './actions';
import { PaletteEditor } from './_components/palette-editor';
import {
  VisualPreview,
  type TemplateAsset,
  type ExistingSave,
} from './_components/visual-preview';
import { WeddingAttireGuide } from './_components/wedding-attire-guide';
import type { ColorRangeMap } from '@/app/admin/moodboard-library/_components/color-range-manipulator';

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

  const [eventRes, guests] = await Promise.all([
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
  ]);
  const event = eventRes.data;
  if (!event) notFound();

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
          Three families: Venue (ceremony + reception), Couple (bride + groom), and Roles
          (only the role groups you actually have guests in). The Guest List shows each
          role&rsquo;s first color as a small dot beside the chip. The 20-theme curated
          library + Setnayan Guide rule engine + custom-role palettes ship in a later
          revision.
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

      <VisualPreviewSection eventId={eventId} rolePalette={flatPalette} />

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
      />

      <section className="space-y-3 rounded-2xl border border-dashed border-ink/15 bg-cream p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Coming later
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-ink/65">
          <li>Custom role palettes (define your own role with its own colors)</li>
          <li>20-theme curated library</li>
          <li>Setnayan Guide rule engine (cohesion · contrast · temperature · saturation)</li>
          <li>Venue palette extraction from venue photos</li>
          <li>Guests pick their dress-code color from the &ldquo;Plain guests&rdquo; palette</li>
          <li>Stylist uploads from their own Google Drive (V1.x)</li>
        </ul>
      </section>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Visual preview pillars (Location feel + Dress codes) · locked 2026-05-21
// ----------------------------------------------------------------------------
async function VisualPreviewSection({
  eventId,
  rolePalette,
}: {
  eventId: string;
  /**
   * Already-flattened role → primary hex map. The parent (MoodBoardPage)
   * runs the array→first-color flattening before passing it down because
   * VisualPreview accepts one accent per role for the silhouette tint.
   */
  rolePalette: Record<string, string>;
}) {
  const admin = createAdminClient();

  // Fetch approved templates + their color ranges + the event's existing saves
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

  const templates: TemplateAsset[] = (templateRows ?? []).map((r) => {
    // V1 moodboard seed (migration 20260528000000) writes absolute URLs to
    // `storage_path` for placeholder photos hotlinked from picsum.photos.
    // Real admin uploads land in Supabase Storage with the bucket-prefixed
    // path. Detect the difference cheaply and pick the right resolver.
    const isAbsoluteUrl =
      r.storage_path.startsWith('http://') ||
      r.storage_path.startsWith('https://');
    let publicUrl: string;
    if (isAbsoluteUrl) {
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
      asset_type: r.asset_type as TemplateAsset['asset_type'],
      asset_subtype: r.asset_subtype,
      label: r.label,
      public_url: publicUrl,
      color_ranges: colorRangesByAsset.get(r.asset_id) ?? {},
    };
  });

  const existingSaves: ExistingSave[] = (saveRows ?? []).map((s) => ({
    save_id: s.save_id,
    pillar: s.pillar as ExistingSave['pillar'],
    pillar_slot: s.pillar_slot,
    asset_id: s.asset_id,
    palette_snapshot: (s.palette_snapshot as Record<string, string>) ?? {},
    saved_at: s.saved_at,
  }));

  return (
    <section className="space-y-4 border-t border-ink/10 pt-6">
      <header>
        <h2 className="text-2xl font-semibold text-ink">Visual preview</h2>
        <p className="text-sm text-ink/65">
          See how your palette will land on real venue setups and outfits. Pick the
          looks you want — Setnayan applies your colors automatically.
        </p>
      </header>
      <VisualPreview
        eventId={eventId}
        templates={templates}
        existingSaves={existingSaves}
        rolePalette={rolePalette}
      />
    </section>
  );
}
