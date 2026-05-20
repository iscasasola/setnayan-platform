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
      .select('event_id, display_name, role_palette, mood_board_updated_at')
      .eq('event_id', eventId)
      .maybeSingle(),
    fetchGuestsByEvent(supabase, eventId),
  ]);
  const event = eventRes.data;
  if (!event) notFound();

  const palette = sanitizeRolePalette(event.role_palette ?? {});

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

      {/* Flatten the role palette to {role → first color} for the visual
         preview pillars — they pick ONE accent per role for the silhouette
         tint, not the full multi-color list. Pre-existing type mismatch
         spot-fixed 2026-05-21. */}
      <VisualPreviewSection
        eventId={eventId}
        rolePalette={Object.fromEntries(
          Object.entries(palette)
            .map(([role, colors]) => [role, colors?.[0] ?? null])
            .filter((entry): entry is [string, string] => entry[1] !== null),
        )}
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
  rolePalette: rolePaletteSource,
}: {
  eventId: string;
  /**
   * Source role palette from events.role_palette — each role holds an array
   * of hex strings (the couple's full palette). VisualPreview expects a
   * single primary hex per role, so we flatten via the first entry.
   */
  rolePalette: Partial<Record<string, string[]>>;
}) {
  // Flatten arrays → single primary hex per role for the downstream component.
  const rolePalette: Record<string, string> = {};
  for (const [role, colors] of Object.entries(rolePaletteSource)) {
    if (colors && colors.length > 0 && typeof colors[0] === 'string') {
      rolePalette[role] = colors[0];
    }
  }
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
    const key = r.storage_path.replace(`${MOODBOARD_BUCKET}/`, '');
    const { data: pub } = admin.storage.from(MOODBOARD_BUCKET).getPublicUrl(key);
    return {
      asset_id: r.asset_id,
      asset_type: r.asset_type as TemplateAsset['asset_type'],
      asset_subtype: r.asset_subtype,
      label: r.label,
      public_url: pub.publicUrl,
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
