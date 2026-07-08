import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchGuestsByEvent } from '@/lib/guests';
import {
  sanitizeRolePalette,
  paletteKeyForRole,
  ROLE_FAMILY_KEYS,
  type PaletteKey,
} from '@/lib/mood-board';
import {
  seedPaletteFromColors,
  seedPaletteFromFeel,
  RED_GOLD_PALETTE,
} from '@/lib/feel-palettes';
import { isChineseWedding } from '@/lib/chinese-wedding';
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
import {
  InspirationBoard,
  type InspirationItem,
} from './_components/inspiration-board';
import { ConceptPdfButton } from './_components/concept-pdf-button';
import { PrintablePdfButton } from './_components/printable-pdf-button';
import { ShareWithVendorsButton } from './_components/share-with-vendors-button';

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

  const [
    eventRes,
    guests,
    attireRes,
    venueFlowerRes,
    inspirationRes,
    bookedVendorRes,
  ] = await Promise.all([
    supabase
      .from('events')
      .select(
        'event_id, display_name, role_palette, mood_board_updated_at, reception_design, mood_feel_key, ceremony_type, secondary_ceremony_type',
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
    // The couple's uploaded inspiration photos (per-event, from onboarding's
    // intake) — surfaced here so they can add/manage them, and so they can feed
    // the future "Make it real" render as extra references.
    supabase
      .from('event_inspiration_assets')
      .select('slot_key, slot_position, image_url')
      .eq('event_id', eventId)
      .is('removed_at', null),
    // Booked marketplace vendors for the "Share with vendors" affordance. Mirrors
    // the get_vendor_mood_board RPC's booked-gate EXACTLY (any event_vendors row
    // with a non-null marketplace_vendor_id; no status filter). Distinct rows here
    // can repeat a vendor across categories — we de-dupe below for the count.
    supabase
      .from('event_vendors')
      .select('marketplace_vendor_id')
      .eq('event_id', eventId)
      .not('marketplace_vendor_id', 'is', null),
  ]);
  const event = eventRes.data;
  if (!event) notFound();

  const bookedVendorCount = new Set(
    (bookedVendorRes.data ?? [])
      .map((r) => r.marketplace_vendor_id as string | null)
      .filter((id): id is string => Boolean(id)),
  ).size;

  const inspirations: InspirationItem[] = (inspirationRes.data ?? []).map((r) => ({
    slot_key: r.slot_key,
    slot_position: r.slot_position,
    image_url: r.image_url,
  }));

  const palette = sanitizeRolePalette(event.role_palette ?? {});
  const receptionDesign: ReceptionDesign =
    event.reception_design && typeof event.reception_design === 'object'
      ? (event.reception_design as ReceptionDesign)
      : {};

  // ── present roles drive which palette sections show (taxonomy v2) ────────
  // A role's palette section appears ONLY when the guest list actually contains
  // that role (primary or extra). Each role resolves to its SPECIFIC palette key
  // (paletteKeyForRole), so a Bridesmaid surfaces the Bridesmaids section, the
  // Nikah cast (wali/witness/imam/wakil) surfaces Nikah Principals — the existing
  // Nikah gate, since those roles only appear for muslim weddings — and the
  // parents/immediate-family roles surface Parents & Immediate Family.
  const presentPaletteKeys = new Set<PaletteKey>();
  for (const g of guests) {
    for (const r of [g.role, ...(g.extra_roles ?? [])]) {
      presentPaletteKeys.add(paletteKeyForRole(r));
    }
  }
  const visibleKeys = new Set<PaletteKey>([
    'ceremony',
    'reception',
    'bride',
    'groom',
    'guest',
  ]);
  for (const k of ROLE_FAMILY_KEYS) {
    if (presentPaletteKeys.has(k)) visibleKeys.add(k);
  }
  // The shared Wedding Party fallback shows whenever ANY entourage member is
  // present, so a couple can color the whole party with one palette without
  // opening each split sub-section (paletteKeyForRole never returns the fallback
  // key itself, so add it explicitly).
  if (
    presentPaletteKeys.has('maid_of_honor') ||
    presentPaletteKeys.has('best_man') ||
    presentPaletteKeys.has('bridesmaids') ||
    presentPaletteKeys.has('groomsmen')
  ) {
    visibleKeys.add('wedding_party');
  }

  // Draft, don't blank: when the couple has NO saved palette yet, pre-fill the
  // editor with a starter palette. For a Chinese (Tsinoy) wedding we suggest the
  // auspicious red & gold default; otherwise we derive a starter from the wedding
  // "feel" picked in onboarding. Display-only — the existing Save action remains
  // the ONLY path that writes role_palette; seeded values aren't persisted until
  // the couple explicitly saves, so this is a suggestion, never a forced override.
  const hasSavedPalette = Object.keys(palette).length > 0;
  const isChineseCeremony = isChineseWedding({
    ceremony_type: (event as { ceremony_type?: string | null }).ceremony_type ?? null,
    secondary_ceremony_type:
      (event as { secondary_ceremony_type?: string | null }).secondary_ceremony_type ?? null,
  });
  const seededPalette = hasSavedPalette
    ? {}
    : isChineseCeremony
      ? seedPaletteFromColors(RED_GOLD_PALETTE, Array.from(visibleKeys))
      : seedPaletteFromFeel(
          (event as { mood_feel_key?: string | null }).mood_feel_key,
          Array.from(visibleKeys),
        );
  const isSeeded = Object.keys(seededPalette).length > 0;
  const initialPalette = isSeeded ? seededPalette : palette;
  // True only when the editor is currently pre-filled with the Chinese red & gold
  // default (Chinese event + nothing saved yet) — gates the small Chinese-default
  // note above the editor. Non-Chinese events never set this, so their render is
  // byte-identical.
  const showChineseDefaultNote = isChineseCeremony && isSeeded;

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
        href={`/dashboard/${eventId}/studio`}
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

      {showChineseDefaultNote ? (
        <p className="rounded-lg border border-[#7A1F2B]/25 bg-[#7A1F2B]/[0.05] px-3 py-2 text-sm text-ink/75">
          We&rsquo;ve suggested a red &amp; gold palette — the auspicious colours of a
          Chinese wedding. Tweak it to your taste, then{' '}
          <span className="font-medium">Save palette</span> to keep it. Nothing is saved
          until you do.
        </p>
      ) : null}

      {/* For the Chinese default we surface our own accurate red & gold note
          above, so we suppress the editor's generic "from your wedding feel" hint
          (seeded -> false) to avoid a duplicate, inaccurate message. Non-Chinese
          events keep seeded={isSeeded} exactly as before — byte-identical. */}
      <PaletteEditor
        eventId={eventId}
        initial={initialPalette}
        seeded={isSeeded && !showChineseDefaultNote}
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
            // the guest dress-code palette (multiple approved colors)
            guestPalette: palette.guest ?? [],
          }}
        />
      </section>

      <section className="space-y-4 border-t border-ink/10 pt-6">
        <header>
          <h2 className="text-2xl font-semibold text-ink">Your inspirations</h2>
          <p className="max-w-prose text-sm text-ink/65">
            Drop the looks you love — a venue, a backdrop, a bouquet, an outfit. We pull a
            palette from each, and these references will make your photo-real render match
            your taste, not a generic wedding.
          </p>
        </header>
        <InspirationBoard eventId={eventId} initial={inspirations} />
      </section>

      <section className="space-y-4 border-t border-ink/10 pt-6">
        <header className="space-y-1">
          <h2 className="text-2xl font-semibold text-ink">Share with your vendors</h2>
          <p className="max-w-prose text-sm text-ink/65">
            Send your booked vendors a heads-up that your mood board is ready, so they can
            match their styling, decor, and booth to your palette and reception design. They
            see a read-only view — your palette, design, and inspirations, no guest details.
          </p>
        </header>
        <ShareWithVendorsButton eventId={eventId} bookedVendorCount={bookedVendorCount} />
      </section>

      <section className="space-y-4 rounded-2xl border border-ink/10 bg-white p-5">
        <header className="space-y-1">
          <h2 className="text-2xl font-semibold text-ink">Keep a copy</h2>
          <p className="max-w-prose text-sm text-ink/65">
            Download a one-page printable of your palette and reception design — pin it to a
            board or hand it to a vendor. Or grab your full concept book: palette, reception
            design, custom template, and inspirations gathered into one PDF.
          </p>
        </header>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
          <PrintablePdfButton eventId={eventId} eventName={event.display_name} />
          <ConceptPdfButton eventId={eventId} eventName={event.display_name} />
        </div>
      </section>
    </div>
  );
}
