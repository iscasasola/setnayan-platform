import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchGuestsByEvent } from '@/lib/guests';
import { roleGroupOf, type RoleGroup } from '@/lib/role-groups';
import { sanitizeRolePalette, type PaletteKey } from '@/lib/mood-board';
import type { ColorRangeSlot } from '@/lib/color-recolor';
import type { ReceptionDesign } from '@/lib/reception-scene';
import { saveRolePalette } from './actions';
import { PaletteEditor } from './_components/palette-editor';
import {
  MoodboardBoard,
  type BoardSection,
  type BoardCard,
} from './_components/moodboard-board';
import { ReceptionDesigner } from './_components/reception-designer';

export const metadata = { title: 'Mood Board' };

type Props = { params: Promise<{ eventId: string }> };

// Attire roles shown as cards — one representative figure each (no variant
// gallery). `key` is the SHARED palette that colors the role (per the
// 2026-06-09 "shared palettes" lock); a card only appears when that palette is
// visible/present, keeping the board in lock-step with the Palette editor.
const ATTIRE_DEFS: ReadonlyArray<{
  subtype: string;
  label: string;
  key: PaletteKey;
}> = [
  { subtype: 'bride', label: 'Bride', key: 'bride' },
  { subtype: 'groom', label: 'Groom', key: 'groom' },
  { subtype: 'bridesmaids', label: 'Bridesmaids', key: 'wedding_party' },
  { subtype: 'groomsmen', label: 'Groomsmen', key: 'wedding_party' },
  { subtype: 'female_ps', label: 'Ninang attire', key: 'principal_sponsors' },
  { subtype: 'male_ps', label: 'Ninong attire', key: 'principal_sponsors' },
  { subtype: 'guests', label: 'Lady guests', key: 'guest' },
  { subtype: 'men_guests', label: 'Gentleman guests', key: 'guest' },
];

type RangeRow = {
  slot_id: number;
  sampled_hex: string;
  tolerance_de: number;
  region_label: string | null;
};

function toRegions(raw: RangeRow[] | RangeRow | null | undefined): ColorRangeSlot[] {
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return rows.map((r) => ({
    slotId: r.slot_id,
    sampledHex: r.sampled_hex,
    toleranceDe: Number(r.tolerance_de),
    regionLabel: r.region_label ?? undefined,
  }));
}

export default async function MoodBoardPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [eventRes, guests, attireRes, venueFlowerRes] = await Promise.all([
    supabase
      .from('events')
      .select(
        'event_id, display_name, role_palette, mood_board_updated_at, reception_design',
      )
      .eq('event_id', eventId)
      .maybeSingle(),
    fetchGuestsByEvent(supabase, eventId),
    // One representative figure per attire role. These are colored SVG
    // illustrations on a no-CORS host, so they're shown as reference images
    // beside the role's palette swatches (not canvas-recolored).
    supabase
      .from('moodboard_library_assets')
      .select('asset_subtype, label, storage_path')
      .eq('asset_type', 'figure_attire')
      .not('approved_at', 'is', null)
      .is('retired_at', null),
    // Venue scenes + florals + their tagged color regions. These are
    // CORS-clean (picsum / app-served), so the board auto-applies the palette
    // to them in-browser.
    supabase
      .from('moodboard_library_assets')
      .select(
        `asset_id, asset_type, asset_subtype, label, storage_path,
         moodboard_asset_color_ranges ( slot_id, sampled_hex, tolerance_de, region_label )`,
      )
      .in('asset_type', ['venue_scene', 'florals'])
      .not('approved_at', 'is', null)
      .is('retired_at', null),
  ]);
  const event = eventRes.data;
  if (!event) notFound();

  const palette = sanitizeRolePalette(event.role_palette ?? {});
  const receptionDesign: ReceptionDesign =
    event.reception_design && typeof event.reception_design === 'object'
      ? (event.reception_design as ReceptionDesign)
      : {};

  // ── present role groups drive which attire/role cards show ──────────────
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

  // ── one representative figure per attire subtype (first wins) ───────────
  const figureBySubtype: Record<string, { url: string; label: string }> = {};
  for (const row of attireRes.data ?? []) {
    if (!row.asset_subtype) continue;
    if (!figureBySubtype[row.asset_subtype]) {
      figureBySubtype[row.asset_subtype] = {
        url: row.storage_path,
        label: row.label,
      };
    }
  }

  // ── representative venue scenes + bouquet (first match) ─────────────────
  type VFRow = {
    asset_type: string;
    asset_subtype: string | null;
    label: string;
    storage_path: string;
    moodboard_asset_color_ranges: RangeRow[] | RangeRow | null;
  };
  const vfRows = (venueFlowerRes.data ?? []) as VFRow[];
  const findVenue = (match: (s: string) => boolean) =>
    vfRows.find(
      (r) => r.asset_type === 'venue_scene' && match((r.asset_subtype || '').toLowerCase()),
    );
  const churchRow = findVenue((s) => s === 'church' || s === 'ceremony');
  const bouquetRow =
    vfRows.find((r) => r.asset_type === 'florals' && r.asset_subtype === 'bridal_bouquet') ||
    vfRows.find((r) => r.asset_type === 'florals');

  // ── build the board sections ────────────────────────────────────────────
  const attireCards: BoardCard[] = ATTIRE_DEFS.filter(
    (d) => visibleKeys.has(d.key) && figureBySubtype[d.subtype],
  ).map((d) => ({
    key: `attire-${d.subtype}`,
    label: d.label,
    imageUrl: figureBySubtype[d.subtype]!.url,
    paletteColors: palette[d.key] ?? [],
    portrait: true,
  }));

  const ceremonyCards: BoardCard[] = [];
  if (churchRow) {
    ceremonyCards.push({
      key: 'venue-ceremony',
      label: 'Ceremony',
      imageUrl: churchRow.storage_path,
      paletteColors: palette.ceremony ?? [],
      regions: toRegions(churchRow.moodboard_asset_color_ranges),
    });
  }

  const flowerCards: BoardCard[] = [];
  if (bouquetRow) {
    flowerCards.push({
      key: 'flowers-bouquet',
      label: 'Bouquet',
      imageUrl: bouquetRow.storage_path,
      // Shared palettes: the bridal bouquet wears the bride's colors.
      paletteColors: palette.bride ?? [],
      regions: toRegions(bouquetRow.moodboard_asset_color_ranges),
    });
  }

  const sections: BoardSection[] = [
    {
      title: 'Attire',
      blurb: 'One look per role. Set each role’s colors above — the swatches here follow.',
      cards: attireCards,
    },
    {
      title: 'Ceremony',
      blurb: 'Your ceremony space, shown in your palette.',
      cards: ceremonyCards,
    },
    {
      title: 'Flowers',
      blurb: 'Your florals, in your colors.',
      cards: flowerCards,
    },
  ];

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
          Set your palette once, then see it on every part of your day — one look per role,
          your venue, and your flowers. Pick the colors above; the pictures below follow.
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

      <section className="space-y-4 border-t border-ink/10 pt-6">
        <header>
          <h2 className="text-2xl font-semibold text-ink">In your colors</h2>
          <p className="text-sm text-ink/65">
            One picture per thing that needs a color decision — your attire, ceremony, and
            flowers. Ceremony and flowers preview your palette automatically.
          </p>
        </header>
        <MoodboardBoard sections={sections} />
      </section>

      <section className="space-y-4 border-t border-ink/10 pt-6">
        <header>
          <h2 className="text-2xl font-semibold text-ink">Design your reception</h2>
          <p className="text-sm text-ink/65">
            Tap a part of the room — ceiling, backdrop, stage, tables, or the entrance
            tunnel — and choose its treatment. The venue updates live in your colors.
          </p>
        </header>
        <ReceptionDesigner
          eventId={eventId}
          initialDesign={receptionDesign}
          palette={palette.reception ?? []}
          roleColors={{
            bride: palette.bride?.[0],
            groom: palette.groom?.[0],
            party: palette.wedding_party?.[0],
            guest: palette.guest?.[0],
          }}
        />
      </section>

      <section className="space-y-3 rounded-2xl border border-dashed border-ink/15 bg-cream p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Coming next
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-ink/65">
          <li>More treatment options + photo-real swatches per part</li>
          <li>Per-role attire styles you can recolor (photo-real samples)</li>
          <li>Custom role palettes + a curated theme library</li>
          <li>AI Composite Scene — a bespoke photo-real render of your venue (premium)</li>
        </ul>
      </section>
    </div>
  );
}
