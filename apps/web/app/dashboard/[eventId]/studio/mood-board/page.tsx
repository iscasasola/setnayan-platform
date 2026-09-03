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
import type { ColorRangeSlot } from '@/lib/color-recolor';
import {
  RECEPTION_PARTS,
  sanitizeReceptionDesign,
  selAll,
  venueZoneApplies,
  type ReceptionDesign,
} from '@/lib/reception-scene';
import {
  saveRolePalette,
  saveMoodboardTheme,
  applyMoodboardTemplate,
  fetchThemeTemplates,
  readMoodboardThemeDescription,
  applyThemeIntent,
  fetchGalleryAssets,
  applyGalleryPick,
} from './actions';
import {
  GALLERY_SLOT_KEYS,
  creditLine,
  tradeLabelForCredit,
} from '@/lib/moodboard-gallery';
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
import { ThemeStudio } from './_components/theme-studio';
import { InfoButton } from './_components/info-button';
import { PageMasthead } from '@/app/_components/page-masthead';
import { MakeItReal } from './_components/make-it-real';
import {
  RENDER_PARTS,
  renderPartById,
  WHOLE_LOOK_PART_ID,
  type RenderPart,
} from '@/lib/moodboard-render-parts';
import { readEventRenders } from '@/lib/moodboard-render-gallery';
import { r2SignedGet } from '@/lib/r2';
import { R2_BUCKETS } from '@/lib/r2';
import { RENDER_BUCKET_KEY } from '@/lib/bucket-routing';
import {
  MOODBOARD_RENDER_PACK_SKU,
  readMoodboardRenderConfig,
  readMoodboardRenderBalance,
} from '@/lib/moodboard-render-credits';
import { VENUE_SETTING_LABEL, isVenueSetting } from '@/lib/venue-settings';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { formatPhp } from '@/lib/orders';

export const metadata = { title: 'Mood Board' };

type Props = { params: Promise<{ eventId: string }> };

// Attire roles shown as cards — one representative figure each (no variant
// gallery). `key` is the SHARED palette that colors the role (per the
// 2026-06-09 "shared palettes" lock); a card only appears when that palette is
// visible/present, keeping the board in lock-step with the Palette editor.
//
// ── `specific` — TAXONOMY v2, AND WHY THE CARD WAS SHOWING THE WRONG SWATCHES
// The 2026-07-08 v2 lock SPLIT the wedding party into real per-role keys
// (`bridesmaids` / `groomsmen`), and `resolveAttirePaletteColor` — which is what
// actually dresses a figure in the 3D room — resolves the SPECIFIC key first and
// only then falls back to `wedding_party`. These cards were never updated, so a
// couple who filled the Bridesmaids palette saw the room dress bridesmaids in
// their colour while this card showed the wedding-party swatches, or NOTHING at
// all when `wedding_party` was empty. The board and the room disagreed about the
// same fact.
//
// `specific` restores the same precedence here. It is the resolver's order, not
// a second opinion about it — if `resolveAttirePaletteColor` ever changes, this
// follows.
const ATTIRE_DEFS: ReadonlyArray<{
  subtype: string;
  label: string;
  key: PaletteKey;
  /** v2 split key that takes precedence over `key`, mirroring the 3D resolver. */
  specific?: PaletteKey;
}> = [
  { subtype: 'bride', label: 'Bride', key: 'bride' },
  { subtype: 'groom', label: 'Groom', key: 'groom' },
  { subtype: 'bridesmaids', label: 'Bridesmaids', key: 'wedding_party', specific: 'bridesmaids' },
  { subtype: 'groomsmen', label: 'Groomsmen', key: 'wedding_party', specific: 'groomsmen' },
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
    moodboardRenderConfig,
    moodboardRenderBalance,
    moodboardRenderPackSku,
    platformSettings,
    moodboardRenderRows,
    shareConsentRes,
  ] = await Promise.all([
    supabase
      .from('events')
      .select(
        'event_id, display_name, role_palette, mood_board_updated_at, reception_design, mood_feel_key, ceremony_type, secondary_ceremony_type, moodboard_theme_name, moodboard_theme_description, venue_setting',
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
    // MB10 — the credit rides along. `library_asset_id` is only set on a
    // gallery pick, so a couple's own upload embeds nothing and costs nothing.
    // If RLS refuses the shop (unverified, hidden) the embed comes back null
    // and the tile renders WITHOUT a credit rather than with a guess — the
    // photo is already on their board either way.
    supabase
      .from('event_inspiration_assets')
      .select(
        `slot_key, slot_position, image_url, library_asset_id,
         asset:moodboard_library_assets (
           asset_subtype,
           shop:vendor_profiles ( business_name, services )
         )`,
      )
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
    // MB7 — "Make it real": the admin-editable render parameters (Pattern H,
    // world-readable) and this event's real credit balance
    // (moodboard_render_balance — ZERO ROWS means "not permitted", not a
    // fabricated zero; see readMoodboardRenderBalance's own docblock).
    readMoodboardRenderConfig(supabase),
    readMoodboardRenderBalance(supabase, eventId),
    formatV2Sku(MOODBOARD_RENDER_PACK_SKU).catch(() => null),
    fetchPlatformSettings(supabase),
    // MB8 — the couple's own renders. `null` means the read was REFUSED, and
    // the gallery says so; it must never render as "no renders yet" (see
    // readEventRenders' own docblock — this is the guest-list failure's shape).
    readEventRenders(supabase, eventId),
    // MB8 — the event-level "let Setnayan feature your creation" consent.
    supabase
      .from('event_render_share_consent')
      .select('consented')
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);
  const event = eventRes.data;
  if (!event) notFound();

  const bookedVendorCount = new Set(
    (bookedVendorRes.data ?? [])
      .map((r) => r.marketplace_vendor_id as string | null)
      .filter((id): id is string => Boolean(id)),
  ).size;

  type InspirationRow = {
    slot_key: string;
    slot_position: number;
    image_url: string;
    library_asset_id: string | null;
    asset: {
      asset_subtype: string | null;
      shop: { business_name: string | null; services: string[] | null } | null;
    } | null;
  };
  const inspirations: InspirationItem[] = (
    (inspirationRes.data ?? []) as unknown as InspirationRow[]
  ).map((r) => {
    // The trade is resolved against the SLOT THE PHOTO WAS FILED UNDER
    // (`asset.asset_subtype`), falling back to the board slot it sits in.
    // Those are the same key in every honest row; keeping the asset's own
    // value first means a photo dragged into a neighbouring cell is still
    // credited to the trade it actually came from.
    const shopName = r.asset?.shop?.business_name?.trim() ?? '';
    const slotForTrade = r.asset?.asset_subtype ?? r.slot_key;
    return {
      slot_key: r.slot_key,
      slot_position: r.slot_position,
      image_url: r.image_url,
      credit:
        r.library_asset_id && shopName
          ? creditLine(
              shopName,
              tradeLabelForCredit(slotForTrade, r.asset?.shop?.services ?? null),
            )
          : null,
    };
  });

  const palette = sanitizeRolePalette(event.role_palette ?? {});
  // Through the sanitizer, not a bare cast: it is the one place the
  // per-attribute multi-select cap and the "no unknown option ids" rule are
  // enforced, so a hand-edited JSONB blob can't print nine ceiling treatments
  // into the summary below.
  const receptionDesign: ReceptionDesign = sanitizeReceptionDesign(event.reception_design);

  // ── read-only reception summary (Task: editor relocated to Seat Plan,
  // 2026-09-03) — "Ceiling: Fairy lights · Backdrop: Floral wall · ..." for
  // every part except People (not a materials choice). Generic over
  // RECEPTION_PARTS so the 3 new Filipino-relevant zones (walls, photo wall,
  // welcome & signage) show up here for free the moment a couple sets them —
  // nothing to update when a new zone is added.
  // Multi-select (2026-09-03): an attribute can hold more than one treatment,
  // so its labels join with " + " ("Ceiling: Draped canopy + Fairy lights")
  // while separate attributes keep joining with ", " as before. selAll, not
  // sel — showing only the first of two would read exactly like a couple who
  // only chose one.
  // A zone the venue genuinely lacks (a beach's ceiling, a garden's walls)
  // is dropped from the summary entirely — never printed as "Not set" next
  // to zones the couple could actually design. Same predicate the Seat
  // Plan's drawing and 04's render brief gate on (`venueZoneApplies`).
  const receptionSummary = RECEPTION_PARTS.filter(
    (p) => p.id !== 'people' && venueZoneApplies(event.venue_setting, p.id),
  ).map((p) => ({
    id: p.id,
    label: p.label,
    value: p.attributes
      .map((a) =>
        selAll(receptionDesign, p.id, a.id)
          .map((id) => a.options.find((o) => o.id === id)?.label)
          .filter((l): l is string => Boolean(l))
          .join(' + '),
      )
      .filter((v) => v.length > 0)
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

  // ── MB7: "Make it real" — which RENDER_PARTS this event may offer ───────
  // RENDER_PARTS is derived (lib/moodboard-render-parts.ts) from
  // RECEPTION_PARTS / PALETTE_ORDER / MOODBOARD_SLOT_KEYS, so it offers every
  // attire role the taxonomy knows — including ones this event's guest list
  // has nobody in (e.g. Nikah Principals on a non-Muslim wedding). Room and
  // place parts have no such presence question; attire roles are filtered to
  // the SAME `visibleKeys` the Palette editor above already gates its own
  // sections on, so the two surfaces can never disagree about who is in this
  // wedding.
  const eligibleRenderParts: RenderPart[] = RENDER_PARTS.filter(
    (p) => p.group !== 'people' || visibleKeys.has(p.sourceKey as PaletteKey),
  );

  // Every inspiration slot that holds at least one photo — the same
  // `inspirations` rows InspirationBoard renders, read once here rather than
  // re-fetched, so section 04's render gate can never see a different photo
  // set than the couple does.
  const inspirationPresence = Array.from(new Set(inspirations.map((i) => i.slot_key)));

  // ── MB8: resolve each render's viewing URL, server-side ──────────────────
  //
  // Renders live in the PRIVATE bucket, so they are readable only through a
  // short-lived presigned GET minted here. A row whose URL cannot be minted
  // keeps `imageUrl: null`, and the gallery says "saved — reload to see it"
  // rather than showing a broken image or, worse, treating a photograph the
  // couple owns as if it did not exist.
  //
  // `partLabel` comes from the DERIVED registry, so a render of a zone added
  // later is still labelled properly instead of showing its raw `room:foo` id.
  const moodboardRenders =
    moodboardRenderRows === null
      ? null
      : await Promise.all(
          moodboardRenderRows.map(async (r) => ({
            ...r,
            partLabel:
              r.part_id === WHOLE_LOOK_PART_ID
                ? 'The whole look'
                : (renderPartById(r.part_id)?.label ?? r.part_id),
            imageUrl: r.image_key
              ? await r2SignedGet({
                  bucket: R2_BUCKETS[RENDER_BUCKET_KEY],
                  key: r.image_key,
                  expiresIn: 60 * 60,
                }).catch(() => null)
              : null,
          })),
        );
  const shareConsented = shareConsentRes.data?.consented === true;

  const venueSetting = (event as { venue_setting?: string | null }).venue_setting ?? null;
  const venueLabel = isVenueSetting(venueSetting)
    ? VENUE_SETTING_LABEL[venueSetting]
    : 'Not set yet';

  const moodboardRenderPackPlan = moodboardRenderPackSku
    ? {
        sku_code: MOODBOARD_RENDER_PACK_SKU,
        name: moodboardRenderPackSku.display_name,
        scope: 'One pack of Mood Board render credits, used across every part or the whole look.',
        price: formatPhp(moodboardRenderPackSku.price_php),
        unit: '',
        priceCentavos: String(moodboardRenderPackSku.price_centavos),
      }
    : null;

  // ── the blank-start fork (MB3, 2026-09-03) ──────────────────────────────
  // ⚠ CORRECTED: this page used to pre-fill the editor with a starter palette
  // (a Chinese-wedding red & gold default, or one derived from the
  // onboarding "feel") whenever the couple had NOTHING saved yet — real hex
  // colors, shown as if chosen, before the couple had made any decision at
  // all. That directly contradicted the redesigned board's own on-screen
  // promise: <TemplateGallery>'s "Start with a blank board" step says "Your
  // board stays blank" while this page quietly filled it anyway. The owner's
  // correction is explicit: "why can't i delete the first 3 colors. it is a
  // requirement to have at least 3. but start with blank" — three SLOTS are
  // structural (PALETTE_LIMITS.reception.min), three pre-chosen COLORS are
  // not. `hasChosenMajors` (lib/mood-board.ts) is the one predicate for
  // "has the couple chosen their majors" — every surface reads it, so none
  // can disagree with the fork about whether the board is still blank.
  // ⚠ This page does NOT call `hasChosenMajors` itself and pass the result
  // down as a separate boolean — a peer session's sabotage pass found that
  // exact shape unguarded (hard-code the boolean, every test stays green).
  // `<ThemeStudio>` receives `palette` below and derives the predicate
  // itself, right where it's consumed — see its own comment.
  //
  // The two paths that actually fill `reception` now are: (1) applying a
  // designed theme (writes five real colors via applyMoodboardTemplate /
  // applyThemeIntent), or (2) the couple adding their own in the palette
  // editor below. Neither is a silent page-load side effect.
  //
  // Retired, not replaced in place: a proper "Setnayan AI suggests a
  // starting palette, dismissible" affordance (the prototype's AI starter
  // row) belongs with the palette-style engine landing in MB4/MB5, not as a
  // half-built suggestion here.
  const initialPalette = palette;

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
    // Visible on EITHER key. The split key alone must be enough — a couple with
    // bridesmaids and an empty `wedding_party` still has a Bridesmaids palette.
    (d) =>
      (visibleKeys.has(d.key) || (d.specific ? visibleKeys.has(d.specific) : false)) &&
      figureBySubtype[d.subtype],
  ).map((d) => ({
    key: `attire-${d.subtype}`,
    label: d.label,
    imageUrl: figureBySubtype[d.subtype]!.url,
    // Specific key first, then the shared fallback — the exact precedence
    // `resolveAttirePaletteColor` uses to dress the figure in the 3D room.
    paletteColors:
      (d.specific && palette[d.specific]?.length ? palette[d.specific] : palette[d.key]) ?? [],
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
    { href: '#make-it-real', label: 'Make it real' },
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

        {/* Overall Theme — the card that opens the canvas — and the theme
            gallery under it. They render exactly as before; the wrapper is a
            client boundary so a feeling+setting READ OUT OF THE COUPLE'S OWN
            DESCRIPTION can travel from the card to the gallery (page.tsx is a
            server component and cannot hold that state itself).

            No `templates` prop — the gallery asks for its own rows, ~6 at a
            time, only once the couple has answered both narrowing questions
            (or the reader has answered them from their sentence). See the
            comment on the Promise.all above for why. */}
        <ThemeStudio
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
          saveThemeAction={saveMoodboardTheme}
          readAction={readMoodboardThemeDescription}
          applyIntentAction={applyThemeIntent}
          fetchTemplatesAction={fetchThemeTemplates}
          applyTemplateAction={applyMoodboardTemplate}
        />

        {/* Inspiration + inline palette — presented side by side in the canvas
            flow (was a separate tab). Reuses InspirationBoard/PaletteEditor's
            logic/props unchanged; only the surrounding layout changed. */}
        <div className="grid gap-6 lg:grid-cols-5">
          <section id="inspiration" className="scroll-mt-24 space-y-4 lg:col-span-3">
            <header className="space-y-1">
              <div className="flex items-center gap-1.5">
                <h2 className="text-2xl font-semibold text-ink">Your inspirations</h2>
                <InfoButton label="About inspiration">
                  Upload up to 3 photos per category — drag one onto another slot to reorder.
                  We pull a matching palette colour from each upload automatically, and these
                  references will make your photo-real render match your taste, not a generic
                  wedding.
                </InfoButton>
              </div>
              <p className="max-w-prose text-sm text-ink/65">
                Drop the looks you love — a venue, a backdrop, a bouquet, an outfit.
              </p>
            </header>
            <InspirationBoard
              eventId={eventId}
              initial={inspirations}
              gallerySlots={GALLERY_SLOT_KEYS}
              fetchGalleryAction={fetchGalleryAssets}
              applyGalleryAction={applyGalleryPick}
            />
          </section>

          <section id="palette" className="scroll-mt-24 space-y-4 lg:col-span-2">
            <header>
              <h2 className="text-2xl font-semibold text-ink">Palette</h2>
              <p className="text-sm text-ink/65">
                Set each role&rsquo;s colors — the rest of the board follows.
              </p>
            </header>
            <PaletteEditor
              eventId={eventId}
              initial={initialPalette}
              visibleKeys={Array.from(visibleKeys)}
              saveAction={saveRolePalette}
              venueLabel={venueLabel}
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

        <MakeItReal
          eventId={eventId}
          eligibleParts={eligibleRenderParts}
          palette={palette}
          receptionDesign={receptionDesign}
          inspirationPresence={inspirationPresence}
          venueSetting={venueSetting}
          venueLabel={venueLabel}
          config={moodboardRenderConfig}
          balance={moodboardRenderBalance}
          packPlan={moodboardRenderPackPlan}
          checkoutSettings={platformSettings}
          renders={moodboardRenders}
          shareConsented={shareConsented}
        />

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
