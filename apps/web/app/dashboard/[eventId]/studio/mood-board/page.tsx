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
import { RECEPTION_PARTS, sel, type ReceptionDesign } from '@/lib/reception-scene';
import {
  saveRolePalette,
  saveMoodboardTheme,
  applyMoodboardTemplate,
  fetchThemeTemplates,
} from './actions';
import { PaletteEditor } from './_components/palette-editor';
import {
  MoodboardBoard,
  type BoardSection,
  type BoardCard,
} from './_components/moodboard-board';
import {
  InspirationBoard,
  type InspirationItem,
} from './_components/inspiration-board';
import { ConceptPdfButton } from './_components/concept-pdf-button';
import { PrintablePdfButton } from './_components/printable-pdf-button';
import { ShareWithVendorsButton } from './_components/share-with-vendors-button';
import { ThemeCard } from './_components/theme-card';
import { TemplateGallery } from './_components/template-gallery';
import { PageMasthead } from '@/app/_components/page-masthead';

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

  // ⚠ NO `moodboard_theme_templates` READ HERE — ON PURPOSE (2026-09-03).
  // This list used to carry an unfiltered, unlimited select of that table,
  // handed to <TemplateGallery> as a `templates` prop. At 2,600 rows (100
  // hand-authored + 2,500 generated) that shipped the whole table, including
  // two JSONB blobs per row, into every couple's RSC payload on every load of
  // this page — and the gallery then filtered it client-side. The gallery now
  // fetches ~6 rows on demand through `fetchThemeTemplates`, AFTER the couple
  // has narrowed to one (feeling, style) pair, and the facet vocabulary it
  // needs to draw its first screen is STATIC (MOODBOARD_MOOD_TAGS /
  // MOODBOARD_STYLE_FAMILIES + their label maps in lib/moodboard-templates.ts),
  // so no query is needed here at all — not even a `select distinct`.
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
        'event_id, display_name, role_palette, mood_board_updated_at, reception_design, mood_feel_key, ceremony_type, secondary_ceremony_type, moodboard_theme_name, moodboard_theme_description',
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

  // ── read-only reception summary (Task: editor relocated to Seat Plan,
  // 2026-09-03) — "Ceiling: Fairy lights · Backdrop: Floral wall · ..." for
  // every part except People (not a materials choice). Generic over
  // RECEPTION_PARTS so the 3 new Filipino-relevant zones (walls, photo wall,
  // welcome & signage) show up here for free the moment a couple sets them —
  // nothing to update when a new zone is added.
  const receptionSummary = RECEPTION_PARTS.filter((p) => p.id !== 'people').map((p) => ({
    id: p.id,
    label: p.label,
    value: p.attributes
      .map((a) => {
        const id = sel(receptionDesign, p.id, a.id);
        return a.options.find((o) => o.id === id)?.label;
      })
      .filter((v): v is string => Boolean(v))
      .join(', '),
  }));

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

  // ── redesign (2026-09-02): one scrollable canvas instead of separated
  // tabs/sections. Every existing data-fetching contract above is unchanged;
  // this only restructures how the same data is composed into the page.
  const jumpLinks: ReadonlyArray<{ href: string; label: string }> = [
    { href: '#theme', label: 'Theme' },
    { href: '#inspiration', label: 'Inspiration' },
    { href: '#palette', label: 'Palette' },
    { href: '#reception', label: 'Reception' },
    { href: '#colors', label: 'In your colors' },
    { href: '#share', label: 'Share & export' },
  ];

  return (
    <div className="pb-24">
      <PageMasthead title="Mood Board" />

      <div className="space-y-6">
        <Link
          href={`/dashboard/${eventId}/studio`}
          className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
        >
          ‹ Back to add-ons
        </Link>

        {event.mood_board_updated_at ? (
          <p className="-mt-3 text-xs text-ink/55">
            Last saved {new Date(event.mood_board_updated_at).toLocaleString()}
          </p>
        ) : null}

        {/* Sticky mini-nav — the page is now long, so a quick jump beats a
            scroll from a single-tab layout. */}
        <nav
          aria-label="Jump to a section"
          className="sticky top-0 z-10 -mx-4 flex gap-1 overflow-x-auto border-b border-ink/10 bg-cream/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-full sm:border sm:px-2"
        >
          {jumpLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-ink/60 transition hover:bg-ink/5 hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Overall Theme — the card that opens the canvas. */}
        <ThemeCard
          eventId={eventId}
          initialName={
            (event as { moodboard_theme_name?: string | null }).moodboard_theme_name ?? null
          }
          initialDescription={
            (event as { moodboard_theme_description?: string | null })
              .moodboard_theme_description ?? null
          }
          palette={palette}
          receptionDesign={receptionDesign}
          saveAction={saveMoodboardTheme}
        />

        {/* No `templates` prop — the gallery asks for its own rows, ~6 at a
            time, only once the couple has answered both narrowing questions.
            See the comment on the Promise.all above for why. */}
        <TemplateGallery
          eventId={eventId}
          fetchAction={fetchThemeTemplates}
          applyAction={applyMoodboardTemplate}
        />

        {showChineseDefaultNote ? (
          <p className="rounded-lg border border-[#7A1F2B]/25 bg-[#7A1F2B]/[0.05] px-3 py-2 text-sm text-ink/75">
            We&rsquo;ve suggested a red &amp; gold palette — the auspicious colours of a
            Chinese wedding. Tweak it to your taste, then{' '}
            <span className="font-medium">Save palette</span> to keep it. Nothing is saved
            until you do.
          </p>
        ) : null}

        {/* Inspiration + inline palette — presented side by side in the canvas
            flow (was a separate tab). Reuses InspirationBoard/PaletteEditor's
            logic/props unchanged; only the surrounding layout changed. */}
        <div className="grid gap-6 lg:grid-cols-5">
          <section id="inspiration" className="scroll-mt-24 space-y-4 lg:col-span-3">
            <header>
              <h2 className="text-2xl font-semibold text-ink">Your inspirations</h2>
              <p className="max-w-prose text-sm text-ink/65">
                Drop the looks you love — a venue, a backdrop, a bouquet, an outfit. Drag a
                photo onto another slot to reorder. We pull a palette from each, and these
                references will make your photo-real render match your taste, not a generic
                wedding.
              </p>
            </header>
            <InspirationBoard eventId={eventId} initial={inspirations} />
          </section>

          <section id="palette" className="scroll-mt-24 space-y-4 lg:col-span-2">
            <header>
              <h2 className="text-2xl font-semibold text-ink">Palette</h2>
              <p className="text-sm text-ink/65">
                Set each role&rsquo;s colors — the rest of the board follows.
              </p>
            </header>
            {/* For the Chinese default we surface our own accurate red & gold
                note above, so we suppress the editor's generic "from your
                wedding feel" hint (seeded -> false) to avoid a duplicate,
                inaccurate message. Non-Chinese events keep seeded={isSeeded}
                exactly as before — byte-identical. */}
            <PaletteEditor
              eventId={eventId}
              initial={initialPalette}
              seeded={isSeeded && !showChineseDefaultNote}
              visibleKeys={Array.from(visibleKeys)}
              saveAction={saveRolePalette}
            />
          </section>
        </div>

        <section id="reception" className="scroll-mt-24 space-y-4 border-t border-ink/10 pt-6">
          <header>
            <h2 className="text-2xl font-semibold text-ink">Your reception design</h2>
            <p className="text-sm text-ink/65">
              Ceiling, backdrop, stage, tables, walls, and more — designed together with your
              Seat Plan now, since it&rsquo;s really the same room.
            </p>
          </header>
          <div className="rounded-xl border border-ink/10 bg-white p-4">
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink/75">
              {receptionSummary.map((p) => (
                <span key={p.id}>
                  <span className="font-medium text-ink">{p.label}:</span>{' '}
                  {p.value || <span className="text-ink/45">Not set</span>}
                </span>
              ))}
            </div>
            <Link
              href={`/dashboard/${eventId}/seating/lab`}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-terracotta hover:underline"
            >
              Edit in Seat Plan →
            </Link>
          </div>
        </section>

        {/* "In your colors" — moved down + shrunk (2026-09-03): kept as a
            secondary "here's a taste" gut-check (still reads from
            moodboard_library_assets + the couple's palette and still feeds
            the vendor RPC / concept PDF exactly as before), no longer a
            primary section couples are steered to. */}
        <section id="colors" className="scroll-mt-24 space-y-3 border-t border-ink/10 pt-6">
          <header>
            <h3 className="text-base font-medium text-ink/80">In your colors</h3>
            <p className="text-xs text-ink/55">
              A quick preview of your attire, ceremony, and flowers in your chosen palette.
            </p>
          </header>
          <MoodboardBoard sections={sections} compact />
        </section>

        <section id="share" className="scroll-mt-24 space-y-4 border-t border-ink/10 pt-6">
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
      </div>

      {/* Persistent action bar — Share + both PDF exports stay reachable
          regardless of scroll position now that the page is one long canvas. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-cream/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 sm:gap-3">
          <PrintablePdfButton eventId={eventId} eventName={event.display_name} />
          <ConceptPdfButton eventId={eventId} eventName={event.display_name} />
        </div>
      </div>
    </div>
  );
}
