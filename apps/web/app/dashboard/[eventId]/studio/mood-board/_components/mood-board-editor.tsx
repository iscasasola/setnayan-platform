import Link from 'next/link';
import { studioHubHref } from '@/lib/studio-hub';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { MoodPart, MoodPartNote } from './mood-board-parts';
import { createClient } from '@/lib/supabase/server';
import { fetchGuestsByEvent } from '@/lib/guests';
import {
  sanitizeRolePalette,
  paletteKeyForRole,
  PALETTE_LIMITS,
  ROLE_FAMILY_KEYS,
  type PaletteKey,
} from '@/lib/mood-board';
import type { ColorRangeSlot } from '@/lib/color-recolor';
import {
  RECEPTION_PARTS,
  sanitizeReceptionDesign,
  selAll,
  venueZoneApplies,
  type PartId,
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
  fetchRenderPool,
  applyRenderPick,
} from '../actions';
import {
  GALLERY_SLOT_KEYS,
  creditLine,
  tradeLabelForCredit,
} from '@/lib/moodboard-gallery';
/* ⚡ The studio's client pieces load when the board is opened — never with the
   Maker that draws it (`mood-board-lazy.tsx`). Types still come from their files. */
import {
  ConceptPdfButton,
  InspirationBoard,
  MakeItReal,
  MoodboardBoard,
  PaletteBoardProvider,
  PaletteSection,
  PartFinalizationPanel,
  PrintablePdfButton,
  ShareWithVendorsButton,
  ThemeStudio,
  MoodBoardStudio,
} from './mood-board-lazy';
import type { StudioAttireRow, StudioChange } from './mood-board-studio';
import {
  cancelPartFinalization,
  cancelPartReopen,
  requestPartFinalization,
  requestPartReopen,
} from '../finalization-actions';
import {
  eligibleSuppliersForPart,
  finalizeBlocker,
  partFreezesNothing,
  type BookedSupplier,
  type PartFinalizationRecord,
} from '@/lib/moodboard-finalization';
import type { FinalizationPanelPart } from './part-finalization-panel';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import type { BoardSection, BoardCard } from './moodboard-board';
import type { InspirationItem } from './inspiration-board';
import { InfoTip } from '@/app/_components/info-tip';
import { PageMasthead } from '@/app/_components/page-masthead';
import { isStoreShellRequest } from '@/lib/request-platform';
import {
  RENDER_PARTS,
  renderPartById,
  WHOLE_LOOK_PART_ID,
  type RenderPart,
} from '@/lib/moodboard-render-parts';
import { readEventRenders } from '@/lib/moodboard-render-gallery';
import { signOwnRenderImage } from '@/lib/moodboard-render-serve';
import {
  MOODBOARD_RENDER_PACK_SKU,
  readMoodboardRenderConfig,
  readMoodboardRenderBalance,
} from '@/lib/moodboard-render-credits';
import { VENUE_SETTING_LABEL, isVenueSetting } from '@/lib/venue-settings';
import { pickCeremonyScene, pickFiguresByRole } from '@/lib/moodboard-board-picks';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { formatPhp } from '@/lib/orders';
import { draftedEventColumn } from '@/lib/hub-draft-store';
import { normalizeDressCodeConfig } from './dress-code-fields';
import type { DressCodeConfig } from '../dress-code-actions';
import type { GuestRole } from '@/lib/guests';
import { readHubDraft } from '@/lib/hub-draft-store';
import { overlayHubDraftEvent, overlayHubDraftWidgets } from '@/lib/hub-draft';
import { sanitizeHubCanvas } from '@/lib/hub-canvas';
import type { InvitationWidgetRow } from '@/lib/invitation-widgets';
import { HUB_THEMES, normalizeThemeId } from '@/lib/invite-themes';
import { themeSeedPalette } from '@/lib/theme-colours';
import { allRegions, resolveRegion } from '@/lib/region-source';
import { describeColourChange, type ColourChangeRow } from '@/lib/colour-access';
import { frozenNow } from '@/lib/moodboard-finalization-rows';
import { ATTIRE_STYLES, ATTIRE_STYLE_LABEL, formatCallTime } from '@/lib/role-dress-code';
import { roleGroupLabel, roleGroupOf, type RoleGroup } from '@/lib/role-groups';
import { DressCodeListsForm } from './dress-code-lists-form';
import { incDressCodeStarter } from './inc-dress-code-starter';
import { logQueryError } from '@/lib/supabase/error-detect';

/** The suppliers a part may be ASKED — the booked marketplace shop, named by its key (see the read). */
export const BOOKED_SUPPLIER_SELECT = 'vendor_id, vendor_name, shop:vendor_profiles!event_vendors_marketplace_vendor_id_fkey ( services )';
/** Said on each part when the booked suppliers could not be read — never "book one first". */
export const BOOKED_SUPPLIERS_UNREAD = 'Your booked suppliers could not be read just now, so nobody can be asked yet. Nothing was changed — please reopen this in a moment.';

/**
 * THE MOOD BOARD — the whole studio, as ONE component, drawn in two places
 * (Details part 3; owner 2026-09-29, DECISION_LOG "SCHEDULE, MOOD BOARD AND
 * SEAT PLAN MOVE INSIDE THE EVENT HUB (DETAILS)"):
 *
 *   · the Event Hub Maker's Details → Look → Mood Board (`inMaker`), where the
 *     couple opens it now — the Maker's rules apply there: no "Back to" link,
 *     no link out of the Maker, and the save bar sits in the page's flow
 *     instead of over the Maker's own chrome;
 *   · `/dashboard/<id>/studio/mood-board`, its own page, for everyone the
 *     Maker is not for (a coordinator, an event with no Event Hub) — as it
 *     always was, `‹ Back to add-ons` and all.
 *
 * Nothing about the board itself changed in the move: the same reads, the same
 * palette, inspirations, renders, and the supplier side — part finalizations
 * (`moodboard_part_finalizations`) and Share with vendors — unchanged, so Your
 * Team and every booked supplier read exactly what they read before.
 */

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
  // 🔑 MB25 — SORTED BY slot_id, because the ORDER IS THE COUPLE'S COLOUR ORDER.
  // `moodboard-board.tsx` assigns `out[r.slotId] = palette[i % palette.length]`
  // using the ARRAY INDEX i, and neither embedded select above carries an
  // ORDER BY, so the mapping was whatever PostgREST happened to return. That
  // was harmless while every asset had exactly ONE range. The Ceremony aisle
  // (migration 20271206413595) is the first with two — slot 1 the florals,
  // slot 2 the fabric — and unsorted rows would hand the couple's first
  // ceremony colour to the aisle runner on some responses and to the flowers
  // on others, for the same couple and the same data.
  return rows
    .slice()
    .sort((a, b) => a.slot_id - b.slot_id)
    .map((r) => ({
      slotId: r.slot_id,
      sampledHex: r.sampled_hex,
      toleranceDe: Number(r.tolerance_de),
      regionLabel: r.region_label ?? undefined,
    }));
}

/**
 * Every read the board makes, and every part of it as a node — ONE build per
 * request (`cache`), drawn either as the page (`MoodBoardEditor`) or as the
 * Maker's three parts (`MoodBoardMakerBody` in the middle, `MoodBoardMakerControls`
 * on the right, `mood-board-parts.tsx` in the navigator).
 */
const buildMoodBoard = cache(async (eventId: string, inMaker: boolean) => {
  const supabase = await createClient();

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
    finalizationRes,
    bookedSupplierRes,
    mayActRes,
  ] = await Promise.all([
    supabase
      .from('events')
      .select(
        'event_id, display_name, role_palette, mood_board_updated_at, reception_design, mood_feel_key, ceremony_type, secondary_ceremony_type, moodboard_theme_name, moodboard_theme_description, venue_setting, ceremony_venue_setting, moodboard_style_family, dress_code_config',
      )
      .eq('event_id', eventId)
      .maybeSingle(),
    fetchGuestsByEvent(supabase, eventId),
    // One representative figure per attire role, WITH its tagged colour ranges
    // so the board can recolour it — see the note on `attireCards` below.
    //
    // ⛔ The comment that used to sit here said these figures are "on a no-CORS
    // host, so they can't be canvas-recolored". THAT WAS FALSE, and it was the
    // only evidence anyone had for the belief. The R2 host echoes every origin
    // we run on; re-measure it in one line:
    //
    //   curl -sI -H "Origin: https://www.setnayan.com" \
    //     https://pub-37d64fe618584c2981a88610a55dd439.r2.dev/moodboard-library/figure_attire/elegant-simple-classic/bride.svg
    //   → 200 · Access-Control-Allow-Origin: https://www.setnayan.com
    //
    // What actually kept attire at stock colours was THIS SELECT: it asked for
    // three columns and never for `moodboard_asset_color_ranges`, so
    // `attireCards` had no `regions` to pass and `BoardCardView`'s `recolorable`
    // was false for every attire card. A query shape, not a hosting problem.
    // All 75 live figures already carry a range (measured on prod 2026-09-05).
    supabase
      .from('moodboard_library_assets')
      .select(
        `asset_subtype, label, storage_path, style_theme,
         moodboard_asset_color_ranges ( slot_id, sampled_hex, tolerance_de, region_label )`,
      )
      .eq('asset_type', 'figure_attire')
      .not('approved_at', 'is', null)
      .is('retired_at', null),
    // Venue scenes + florals + their tagged colour regions, auto-recoloured
    // in-browser. NOTE (MB23): the two `venue_scene` rows that were live here
    // were picsum.photos STOCK PHOTOGRAPHS and are retired by migration
    // 20271205919528. MB25 puts a real one back — the app-served Ceremony
    // DRAWING seeded by migration 20271206413595 — so `ceremonyRow` resolves
    // again, now to our own artwork with two tagged regions.
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
         sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6,
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
    // MB12 — every finalization handshake on this board. Read UNFILTERED by
    // state on purpose: the AGREED rows are what freeze the palette, and the
    // closed ones (declined / expired) are what let a row say "turned down —
    // 'we cannot source that in November'" instead of quietly offering the same
    // supplier again as though nobody had ever answered.
    supabase
      .from('moodboard_part_finalizations')
      .select(
        `finalization_id, part_id, vendor_id, state, expires_at, agreed_at,
         declined_at, decline_reason, reopen_state, reopen_expires_at,
         reopen_decline_reason, frozen_palette_keys, frozen_dressing_fields`,
      )
      .eq('event_id', eventId)
      .order('created_at', { ascending: true }),
    // MB12 — the suppliers who could be ASKED. Filtered to the four CONFIRMED
    // statuses (lib/events.ts) because only a booked supplier may be asked to
    // agree to a design — the same rule `request_part_finalization` enforces in
    // SQL. `services` comes from the shop, which is where the category match is
    // decided; a booking with no shop behind it has none and is correctly
    // ineligible rather than silently allowed.
    supabase
      .from('event_vendors')
      /* 🔗 The embed NAMES its key: event_vendors reaches vendor_profiles twice
         (the booked marketplace shop · a manual row's linked profile), and an
         unnamed embed is refused outright (PGRST201 — every Maker open since
         2026-09-05). The shop that was BOOKED is the marketplace one. */
      .select(BOOKED_SUPPLIER_SELECT)
      .eq('event_id', eventId)
      .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[]),
    // Owner ruling 2026-09-11: only the couple (and Setnayan admins) start a
    // render on the couple's credits or choose to share it. Asked of the SAME
    // database gate the spend/consent functions use (migration 20271221631865),
    // so the page and the refusal cannot disagree. Every other member still
    // sees the balance, the renders and the pool — that is the read gate.
    supabase.rpc('moodboard_render_caller_may_act', { p_event_id: eventId }),
  ]);
  const event = eventRes.data;
  if (!event) {
    /* Inside the Maker a refused read is SAID, never a 404 that takes the
       whole Maker down with it. */
    if (inMaker) return { ok: false as const };
    notFound();
  }

  /* ✅ THE DO'S AND DON'TS (owner 2026-09-30). In the Maker they are read
     through the couple's draft — the same place the Dress code scene saves —
     so the two show one list. A refused draft read is said, never guessed. */
  let dressLists: { dos: string[]; donts: string[]; incStarter: boolean } | null = null;
  /* 🧭 The whole dress code as drafted — Studio's Attire tab writes a role's outfit into it. */
  let dressConfig: DressCodeConfig | null = null;
  try {
    const drafted = inMaker ? await draftedEventColumn(eventId, 'dress_code_config') : { drafted: false as const };
    /* 👗 An INC event's EMPTY dress code starts from the modest guidance
       (owner 2026-10-04) — form defaults only; nothing is written until Save. */
    const { config: cfg, started } = incDressCodeStarter(
      event,
      normalizeDressCodeConfig(
        drafted.drafted ? drafted.value : (event as { dress_code_config?: unknown }).dress_code_config,
      ),
    );
    dressLists = { dos: cfg.dos, donts: cfg.donts, incStarter: started };
    dressConfig = cfg;
  } catch (err) {
    console.error(`[moodBoard] dress-code draft unreadable for event_id=${eventId}:`, err);
  }

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
    sampled_hex_1: string | null;
    sampled_hex_2: string | null;
    sampled_hex_3: string | null;
    sampled_hex_4: string | null;
    sampled_hex_5: string | null;
    sampled_hex_6: string | null;
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
      /* 🎨 The photo's own six sampled colours — Studio reads each part's palette from them. */
      swatches: [r.sampled_hex_1, r.sampled_hex_2, r.sampled_hex_3, r.sampled_hex_4, r.sampled_hex_5, r.sampled_hex_6].filter(
        (h): h is string => typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h),
      ),
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

  // ── MB12: the per-part finalization handshake ───────────────────────────
  // A REFUSED read is not "nobody has asked anybody". `.data` is null on an
  // error, and an empty list renders exactly like a board where no part has
  // been signed off — the failure shape this repo has shipped twice (the guest
  // list and the vendor workspace). So an error is logged and the panels are
  // told, rather than silently drawing the blank state.
  if (finalizationRes.error) {
    console.error(
      `[moodBoard] part finalizations unreadable for event_id=${eventId}:`,
      finalizationRes.error.message,
    );
  }
  const finalizationRecords: PartFinalizationRecord[] = (finalizationRes.data ??
    []) as unknown as PartFinalizationRecord[];

  // The shop's `services[]` is what decides the category match. Supabase types
  // an embedded one-to-one as an object or an array depending on the inferred
  // relationship; both are normalised here rather than cast, because a wrong
  // guess produces an EMPTY services list — which reads as "this shop does not
  // work in that trade" and silently hides every Ask button.
  /* 🚫 A REFUSED READ IS NOT "NOTHING BOOKED". It used to fall to `[]`, and every
     part then told a couple with suppliers to "Book a … first". Logged, and
     said in place of the Ask rows. */
  if (bookedSupplierRes.error) logQueryError('moodBoard.bookedSuppliers', bookedSupplierRes.error, { eventId });
  const bookedUnread = Boolean(bookedSupplierRes.error);
  const bookedSuppliers: BookedSupplier[] = (bookedSupplierRes.data ?? []).map((r) => {
    const raw = (r as { shop?: unknown }).shop;
    const shop = Array.isArray(raw) ? raw[0] : raw;
    return {
      vendorId: (r as { vendor_id: string }).vendor_id,
      name: ((r as { vendor_name: string | null }).vendor_name ?? '').trim() || 'your supplier',
      services: ((shop as { services?: string[] } | null | undefined)?.services ?? []).filter(
        Boolean,
      ),
    };
  });

  // People parts follow the SAME `visibleKeys` gate section 02 renders on, so
  // the sign-off list and the palette editor can never disagree about who is in
  // this wedding. Room parts follow `venueZoneApplies`, the same predicate the
  // reception summary above already uses. Place parts ride with the room: a
  // cake and a bar are things at the venue, not roles in the palette.
  //
  // 🛑 THE ELIGIBILITY IS RESOLVED HERE, ON THE SERVER, AND THAT IS LOAD-BEARING.
  // `finalizeBlocker` / `eligibleSuppliersForPart` compose MB10's slot → trade
  // map, which reaches lib/vendor-counts → lib/taxonomy-db → lib/supabase/server
  // → next/headers. Calling them from the client panel fails the production
  // build, which is the ONLY thing that can see it — `tsc` is not a bundler and
  // `tsx --test` resolves it happily in node. MB12 shipped that chain to CI.
  const asPanelPart = (p: RenderPart): FinalizationPanelPart => ({
    id: p.id,
    label: p.label,
    blockerMessage: bookedUnread ? BOOKED_SUPPLIERS_UNREAD : (finalizeBlocker(p.id, bookedSuppliers)?.message ?? null),
    eligible: (bookedUnread ? [] : eligibleSuppliersForPart(p.id, bookedSuppliers)).map((s) => ({
      vendorId: s.vendorId,
      name: s.name,
    })),
    freezesNothing: partFreezesNothing(p.id),
  });
  const peopleFinalizationParts = eligibleRenderParts
    .filter((p) => p.group === 'people')
    .map(asPanelPart);
  const roomFinalizationParts = eligibleRenderParts
    .filter(
      (p) =>
        (p.group === 'room' && venueZoneApplies(event.venue_setting, p.sourceKey as PartId)) ||
        p.group === 'places',
    )
    .map(asPanelPart);

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
            // 🔒 Only THIS render's own object is ever signed — a key that is
            // not `renders/<this event>/<this render>.<ext>` signs nothing.
            imageUrl: await signOwnRenderImage({
              eventId,
              renderId: r.render_id,
              key: r.image_key,
            }),
          })),
        );
  const shareConsented = shareConsentRes.data?.consented === true;
  // A refused or failed check is "no" — the controls then say who can use them
  // rather than offering a button the database will refuse.
  const mayStartRenders = !mayActRes.error && mayActRes.data === true;

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
  type AttireRow = {
    asset_subtype: string | null;
    label: string;
    storage_path: string;
    /** `moodboard_library_assets.style_theme` — one of MOODBOARD_STYLE_FAMILIES
     *  on all 75 live figures, and what MB28 matches the couple against. */
    style_theme: string | null;
    moodboard_asset_color_ranges: RangeRow[] | RangeRow | null;
  };
  //
  // 🔑 A REPRESENTATIVE THAT CANNOT RECOLOUR IS THE WRONG REPRESENTATIVE.
  // This used to be "first row wins" over a query with no ORDER BY — so which
  // of the five style variants a couple saw was whatever Postgres happened to
  // return. That was harmless while nothing recoloured. It is not harmless now:
  // `modern-minimalist/bride` draws the gown in #ECEBE7, the SAME COLOUR as its
  // own background rect (ΔE 0.0, 76.6% of the figure column — measured
  // 2026-09-05), so no colour range can select the dress without the backdrop.
  // Migration 20271205919528 deletes that false range rather than inventing a
  // tolerance for it, and this prefers a variant that HAS one. First-with-ranges
  // wins; if no variant has any, the first is still used and the card renders as
  // a reference drawing, exactly as before.
  //
  // ── MB28 · AND THE COUPLE'S OWN STYLE FAMILY DECIDES WHICH ONE ────────────
  // Each role has exactly one figure per style family (15 figures × 5
  // families = the 75 live rows), and until now which of the five a couple saw
  // was decided by "first row with a range", i.e. by Postgres row order. A
  // couple who applied a `bridgerton · regal` theme saw whichever bride came
  // back first.
  //
  // The family is `events.moodboard_style_family` (migration 20271197327520),
  // and `pickFiguresByRole` (lib/moodboard-board-picks.ts) validates it through
  // `isMoodboardStyleFamily` — the SAME validate-or-null the seating lab does
  // before handing a family to MB14b's `resolveDecorLayer`. There is
  // deliberately no second mapping anywhere from `mood_feel_key`, or from a
  // theme name, to a family: a mapping that only this page knew would put the
  // attire row and the reception room in different style families for the same
  // couple, and neither surface would report it.
  //
  // 🪤 THE FAMILY NEVER OUTRANKS A COLOUR RANGE. Preference order is
  // (family AND range) → (any range) → (first row). Preferring the family
  // FIRST is the MB23 disease coming back by another door — see `rankFigure`.
  // A couple with no family resolves EXACTLY as before this change.
  const figureBySubtype: Record<
    string,
    { url: string; label: string; regions: ColorRangeSlot[] }
  > = {};
  const figurePicks = pickFiguresByRole(
    ((attireRes.data ?? []) as AttireRow[]).map((row) => ({
      subtype: row.asset_subtype,
      styleTheme: row.style_theme,
      hasRange: toRegions(row.moodboard_asset_color_ranges).length > 0,
      row,
    })),
    (event as { moodboard_style_family?: string | null }).moodboard_style_family,
  );
  for (const [subtype, pick] of Object.entries(figurePicks)) {
    figureBySubtype[subtype] = {
      url: pick.row.storage_path,
      label: pick.row.label,
      regions: toRegions(pick.row.moodboard_asset_color_ranges),
    };
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
  //
  // ── MB28 · THE CEREMONY CARD KNOWS WHERE THE WEDDING IS ───────────────────
  // `events.ceremony_venue_setting` has held the couple's answer since
  // migration 20271197508087 and nothing read it, so a beach wedding and a
  // mosque wedding were both shown MB25's church aisle. Migration
  // 20271208519468 seeds the other eight settings as `venue_scene` rows whose
  // `asset_subtype` is the setting string VERBATIM, and this selects on it.
  //
  // 🪤 THE FALLBACK IS `church`, NEVER "the first venue_scene". MB14b's ten
  // backdrop and ceiling decor layers are `venue_scene` rows too, live, with
  // no ORDER BY on the query above — so "any venue scene" would show a couple
  // a draped reception ceiling labelled "Ceremony", intermittently, on row
  // order.
  //
  // Both the equality match and that fallback are `pickCeremonyScene`
  // (lib/moodboard-board-picks.ts). The decision does NOT live here, and that
  // is deliberate: `attire-recolours-because-the-query-asks.test.ts` used to
  // rebuild this predicate from literals parsed out of page.tsx and assert
  // against its own copy — which is how a guard ends up guarding the copy. It
  // now imports the real function and runs it over the real MB14b decor rows,
  // and holds this file to calling it.
  const ceremonyRow = pickCeremonyScene(
    vfRows,
    (event as { ceremony_venue_setting?: string | null }).ceremony_venue_setting,
  );
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
    // Guests wear ANY ONE of their colors, so they get one figure per color;
    // every other role is one outfit, main color first (owner, 2026-09-21).
    lineup:
      PALETTE_LIMITS[d.specific && palette[d.specific]?.length ? d.specific : d.key].meaning ===
      'options',
    // MB23 — the figure now recolours, exactly as `ceremonyRow`/`bouquetRow` do.
    // The 🔑 risk this carries is the WHITE: four of the forty seeded figures
    // had a range whose tolerance also swallowed their own opaque background
    // rect, so the gown AND the page behind it turned burgundy (measured: 100%
    // of the outer frame). Fixed in the DATA by migration 20271205919528, never
    // by an override here, and pinned by
    // `_components/the-background-never-wears-the-palette.test.ts`.
    regions: figureBySubtype[d.subtype]!.regions,
    portrait: true,
  }));

  // MB23 retired every `internet_placeholder` venue scene, which left this
  // empty and the Ceremony card ABSENT — the correct end state for a card whose
  // asset was a random stock photograph of a church, shown to the couple as
  // their ceremony space "in their colors", but a temporary one.
  //
  // MB25 ends it. Migration 20271206413595 seeds the Ceremony DRAWING this
  // comment was waiting for: our own Recraft V4.1 vector, app-served at
  // `/moodboard-seed/venue_scene/church/ceremony-aisle.svg`, with TWO tagged
  // regions — slot 1 the florals (#D98BA6 ± 10), slot 2 the fabric
  // (#E8D9B5 ± 5). It is the first two-slot asset in the library, so
  // `paletteColors: palette.ceremony` now spends the couple's first TWO
  // ceremony colours rather than one. Nothing here changed to make that work;
  // the card was always built to. Pinned by
  // `_components/the-background-never-wears-the-palette.test.ts`.
  //
  // MB28 makes it NINE drawings — one per `events.ceremony_venue_setting` —
  // seeded by migration 20271208519468 and chosen above. ⚠ EIGHT OF THE NINE
  // HAVE TWO SLOTS; THE BEACH HAS ONE. Its arch is driftwood, 3.5 from the
  // fabric slot in the recolour engine's metric, and `tolerance_de` is CHECKed
  // at a minimum of 5 — so no legal tolerance separates the drapes from the
  // trees, and the fabric slot is deliberately unseeded rather than seeded
  // wrong (MB23's precedent, applied to a slot instead of a whole asset). This
  // block needs no branch for that: `toRegions` returns the one range and
  // `moodboard-board.tsx` spends only the couple's first ceremony colour, the
  // same as every one-slot asset in the library.
  const ceremonyCards: BoardCard[] = [];
  if (ceremonyRow) {
    ceremonyCards.push({
      key: 'venue-ceremony',
      label: 'Ceremony',
      imageUrl: ceremonyRow.storage_path,
      paletteColors: palette.ceremony ?? [],
      regions: toRegions(ceremonyRow.moodboard_asset_color_ranges),
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
  /**
   * 🔒 MAKE IT REAL IS A PAID DIGITAL FEATURE — render credits bought for ₱ and
   * spent here. The App Store / Play Store shell neither sells nor spends them
   * (guideline 3.1.1 / 3.1.3(b); lib/store-shell.ts), so the section and its
   * jump link are not mounted there. The free Mood Board around it — theme,
   * inspiration, palette, reception, share — is the planning surface the app
   * exists for and stays whole. Desktop and the web are unaffected.
   */
  const storeShell = await isStoreShellRequest();
  const jumpLinks: ReadonlyArray<{ href: string; label: string }> = [
    { href: '#theme', label: 'Theme' },
    { href: '#inspiration', label: 'Inspiration' },
    { href: '#palette', label: 'Palette' },
    { href: '#dos-and-donts', label: 'Do’s & don’ts' },
    { href: '#reception', label: 'Reception' },
    { href: '#colors', label: 'In your colors' },
    ...(storeShell ? [] : [{ href: '#make-it-real', label: 'Make it real' }]),
    { href: '#share', label: 'Share & export' },
  ];

  /* ── THE BOARD'S PARTS, each a node — the page stacks them; the Maker splits
     them into its three columns. The same components, reads and actions. ── */
  const provider = {
    eventId,
    initial: initialPalette,
    finalizations: finalizationRecords,
    saveAction: saveRolePalette,
  };
  const lastSaved = event.mood_board_updated_at ? (
    <p className="text-xs text-ink/55">Last saved {new Date(event.mood_board_updated_at).toLocaleString()}</p>
  ) : null;
  /* Overall Theme — the card that opens the canvas — and the theme gallery
     under it. The wrapper is a client boundary so a feeling+setting READ OUT OF
     THE COUPLE'S OWN DESCRIPTION can travel from the card to the gallery. No
     `templates` prop — the gallery asks for its own rows, ~6 at a time (see the
     comment on the Promise.all above). */
  const theme = (
    <ThemeStudio
      eventId={eventId}
      initialName={(event as { moodboard_theme_name?: string | null }).moodboard_theme_name ?? null}
      initialDescription={(event as { moodboard_theme_description?: string | null }).moodboard_theme_description ?? null}
      palette={palette}
      receptionDesign={receptionDesign}
      saveThemeAction={saveMoodboardTheme}
      readAction={readMoodboardThemeDescription}
      applyIntentAction={applyThemeIntent}
      fetchTemplatesAction={fetchThemeTemplates}
      applyTemplateAction={applyMoodboardTemplate}
    />
  );
  const inspiration = (
    <section id="inspiration" className="scroll-mt-24 space-y-4">
      <header className="space-y-1">
        <InfoTip label="Your inspirations" labelAs="h2" labelClassName="text-2xl font-semibold text-ink" ariaLabel="About inspiration">
          Upload up to 3 photos per category — drag one onto another slot to reorder. We pull a matching palette
          colour from each upload automatically, and these references will make your photo-real render match your
          taste, not a generic wedding.
        </InfoTip>
        <p className="max-w-prose text-sm text-ink/65">Drop the looks you love — a venue, a backdrop, a bouquet, an outfit.</p>
      </header>
      <InspirationBoard
        eventId={eventId}
        initial={inspirations}
        gallerySlots={GALLERY_SLOT_KEYS}
        fetchGalleryAction={fetchGalleryAssets}
        applyGalleryAction={applyGalleryPick}
        fetchRenderPoolAction={fetchRenderPool}
        applyRenderPickAction={applyRenderPick}
      />
    </section>
  );
  const paletteSection = (
    <section id="palette" className="scroll-mt-24 space-y-4">
      <header>
        <h2 className="text-2xl font-semibold text-ink">Palette</h2>
        <p className="text-sm text-ink/65">Derived live from your main colours above — change a role to make it yours.</p>
      </header>
      <PaletteSection visibleKeys={Array.from(visibleKeys)} venueLabel={venueLabel} />
    </section>
  );
  /* MB12 — sign-off, per attire role. The palette is what the couple DESIGNS;
     this is what they AGREE with a supplier. A part that has been agreed stops
     following the main colours, which is why the two are shown together. */
  const peopleAgreed = (
    <div className="space-y-2 rounded-xl border border-ink/10 bg-cream/60 p-4">
      <header className="space-y-0.5">
        <h3 className="text-base font-medium text-ink">Agreed with your supplier</h3>
        <p className="max-w-prose text-xs text-ink/60">
          Ask the supplier who will make it to sign off on a look. Once they agree, that part stops changing when you
          edit your main colours — and it takes both of you to re-open it.
        </p>
      </header>
      <PartFinalizationPanel
        parts={peopleFinalizationParts}
        records={finalizationRecords}
        requestAction={requestPartFinalization.bind(null, eventId)}
        cancelAction={cancelPartFinalization.bind(null, eventId)}
        reopenAction={requestPartReopen.bind(null, eventId)}
        cancelReopenAction={cancelPartReopen.bind(null, eventId)}
        emptyHint="Add your entourage to the guest list and their looks will appear here."
      />
    </div>
  );
  const reception = (
    <section id="reception" className="scroll-mt-24 space-y-4">
      <header>
        <h2 className="text-2xl font-semibold text-ink">Your reception design</h2>
        <p className="text-sm text-ink/65">
          Ceiling, backdrop, stage, tables, walls, and more — designed together with your Seat Plan now, since
          it&rsquo;s really the same room.
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
        {/* No link out of the Maker (owner rule: the field sits where you are). */}
        {inMaker ? (
          <p className="mt-3 text-sm text-ink/65">You design the room in your Seat plan.</p>
        ) : (
          <Link
            href={`/dashboard/${eventId}/seating/lab`}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-terracotta hover:underline"
          >
            Edit in Seat Plan →
          </Link>
        )}
      </div>
    </section>
  );
  /* MB12 — the same handshake, for the room and the things in it. */
  const roomAgreed = (
    <div className="space-y-2 rounded-xl border border-ink/10 bg-cream/60 p-4">
      <header className="space-y-0.5">
        <h3 className="text-base font-medium text-ink">Agreed with your supplier</h3>
        <p className="max-w-prose text-xs text-ink/60">
          Ask the stylist, florist or venue who will build it to sign off. Nothing is settled until they say yes, and
          re-opening it takes both of you.
        </p>
      </header>
      <PartFinalizationPanel
        parts={roomFinalizationParts}
        records={finalizationRecords}
        requestAction={requestPartFinalization.bind(null, eventId)}
        cancelAction={cancelPartFinalization.bind(null, eventId)}
        reopenAction={requestPartReopen.bind(null, eventId)}
        cancelReopenAction={cancelPartReopen.bind(null, eventId)}
        emptyHint="Design your reception in the Seat Plan and its parts will appear here."
      />
    </div>
  );
  /* "In your colors" — moved down + shrunk (2026-09-03): a secondary "here's a
     taste" gut-check (still feeds the vendor RPC / concept PDF as before). */
  const colours = (
    <section id="colors" className="scroll-mt-24 space-y-3">
      <header>
        <h3 className="text-base font-medium text-ink/80">In your colors</h3>
        <p className="text-xs text-ink/55">A quick preview of your attire, ceremony, and flowers in your chosen palette.</p>
      </header>
      <MoodboardBoard sections={sections} compact />
    </section>
  );
  const makeItReal = storeShell ? null : (
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
      mayStartRenders={mayStartRenders}
    />
  );
  const shareWords = (
    <header className="space-y-1">
      <h2 className="text-2xl font-semibold text-ink">Share with your suppliers</h2>
      <p className="max-w-prose text-sm text-ink/65">
        Send your booked suppliers a heads-up that your mood board is ready, so they can match their styling, decor,
        and booth to your palette and reception design. They see a read-only view — your palette, design, and
        inspirations, no guest details.
      </p>
    </header>
  );
  const dressListsPart = dressLists ? (
    <DressCodeListsForm
      eventId={eventId}
      dos={dressLists.dos}
      donts={dressLists.donts}
      inMaker={inMaker}
      incStarter={dressLists.incStarter}
    />
  ) : (
    <p role="alert" className="text-sm text-terracotta-700" data-mood-board-unread="">
      Your do&rsquo;s and don&rsquo;ts could not be loaded just now. Nothing was changed — please reopen this in a
      moment.
    </p>
  );
  const shareButton = <ShareWithVendorsButton eventId={eventId} bookedVendorCount={bookedVendorCount} />;
  const pdfs = (
    <>
      <PrintablePdfButton eventId={eventId} eventName={event.display_name} />
      <ConceptPdfButton eventId={eventId} eventName={event.display_name} />
    </>
  );

  return {
    ok: true as const,
    storeShell,
    jumpLinks,
    provider,
    parts: { lastSaved, theme, inspiration, paletteSection, peopleAgreed, dressLists: dressListsPart, reception, roomAgreed, colours, makeItReal, shareWords, shareButton, pdfs },
    /* 🧭 What Studio › Mood Board & Dress Code draws from — the SAME reads, nothing re-fetched. */
    studio: {
      palette,
      inspirations,
      dressConfig,
      dressLists,
      roleTally: guestRoleTally(guests),
      finalizations: finalizationRecords,
    },
  };
});

function CouldNotLoad() {
  return (
    <p role="alert" className="px-1 py-6 text-sm text-terracotta-700" data-mood-board-unread="">
      Your Mood Board could not be loaded just now. Nothing was changed — please reopen this in a moment.
    </p>
  );
}

/** The Mood Board as its own page — for everyone the Maker is not for. */
export async function MoodBoardEditor({ eventId }: { eventId: string }) {
  const board = await buildMoodBoard(eventId, false);
  if (!board.ok) return <CouldNotLoad />;
  const { storeShell, jumpLinks, provider, parts } = board;
  return (
    <div className="pb-24" data-mood-board="page">
      <PageMasthead title="Mood Board" />

      <div className="space-y-6">
        {/* 🔒 Hidden in the store shell (App Review 3.1.1): the studio hub this
            points at is the paid add-ons catalogue — a native reviewer should
            never be one tap from a screen framed as "add-ons". Mood Board itself
            stays open (a free planning tool); only this back-link is withheld. */}
        {storeShell ? null : (
          <Link
            href={studioHubHref(eventId)}
            className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
          >
            ‹ Back to add-ons
          </Link>
        )}

        {parts.lastSaved ? <div className="-mt-3">{parts.lastSaved}</div> : null}

        {/* Sticky mini-nav — the page is long, so a quick jump beats a scroll. */}
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

        {/* 00 (Theme) through 02 (Palette) share one client boundary — MB5's
            live 00 → 02 derivation (palette-board-context.tsx's docblock). */}
        <PaletteBoardProvider {...provider}>
          {parts.theme}
          {parts.inspiration}
          <div className="space-y-4">
            {parts.paletteSection}
            {parts.peopleAgreed}
          </div>
        </PaletteBoardProvider>

        <div className="border-t border-ink/10 pt-6">{parts.dressLists}</div>

        <div className="space-y-4 border-t border-ink/10 pt-6">
          {parts.reception}
          {parts.roomAgreed}
        </div>

        <div className="border-t border-ink/10 pt-6">{parts.colours}</div>

        {parts.makeItReal}

        <section id="share" className="scroll-mt-24 space-y-4 border-t border-ink/10 pt-6">
          {parts.shareWords}
          {parts.shareButton}
        </section>
      </div>

      {/* Persistent action bar — both PDF exports stay reachable at any scroll. */}
      <div data-glass-row="mood-board-pdfs" className="sn-glass-row fixed inset-x-0 bottom-0 z-20 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 sm:gap-3">{parts.pdfs}</div>
      </div>
    </div>
  );
}

/**
 * 🧩 THE MOOD BOARD IN THE MAKER'S THREE PARTS (owner 2026-09-29, DECISION_LOG
 * "A TOOL MOVED INTO THE MAKER IS REBUILT INTO THE THREE PARTS"): the NAVIGATOR
 * lists its parts (`mood-board-parts.tsx`), the MIDDLE draws the picked one —
 * the theme, the inspirations, the palette, the reception, the board in your
 * colours, Make it real, sharing — and the RIGHT holds that part's controls:
 * the supplier sign-offs beside the palette and the reception, Share with
 * vendors, the two PDFs. Every part stays mounted inside ONE palette provider,
 * so the theme's main colours still derive the palette live (MB5).
 */
export async function MoodBoardMakerBody({ eventId }: { eventId: string }) {
  const board = await buildMoodBoard(eventId, true);
  if (!board.ok) return <CouldNotLoad />;
  const { provider, parts } = board;
  return (
    <div data-mood-board="maker" className="pb-6">
      <PaletteBoardProvider {...provider}>
        <MoodPart part="theme">{parts.theme}</MoodPart>
        <MoodPart part="inspiration">{parts.inspiration}</MoodPart>
        <MoodPart part="palette">{parts.paletteSection}</MoodPart>
      </PaletteBoardProvider>
      {/* ✅ Under the colours each role wears — where a couple dresses people. */}
      <MoodPart part="palette">{parts.dressLists}</MoodPart>
      <MoodPart part="reception">{parts.reception}</MoodPart>
      <MoodPart part="colours">{parts.colours}</MoodPart>
      {parts.makeItReal ? <MoodPart part="make-it-real">{parts.makeItReal}</MoodPart> : null}
      <MoodPart part="share">{parts.shareWords}</MoodPart>
    </div>
  );
}

/** The RIGHT column: the picked part's controls, and the exports every part keeps at hand. */
export async function MoodBoardMakerControls({ eventId }: { eventId: string }) {
  const board = await buildMoodBoard(eventId, true);
  if (!board.ok) return <CouldNotLoad />;
  const { parts } = board;
  return (
    <div data-mood-board-controls="" className="flex flex-col gap-3">
      <MoodPart part="palette">{parts.peopleAgreed}</MoodPart>
      <MoodPart part="reception">{parts.roomAgreed}</MoodPart>
      <MoodPart part="share">{parts.shareButton}</MoodPart>
      {/* 🪜 In the Maker's guided flow (a step is a setup control, nothing else):
          no note under the part, no downloads — the board itself is the step's
          picture (owner 2026-10-05). */}
      <div className="contents group-data-[details-mode=guided]/ws:hidden" data-mood-board-note-wrap="">
        <MoodPartNote />
      </div>
      <div className="flex flex-col gap-2 border-t border-ink/10 pt-3 group-data-[details-mode=guided]/ws:hidden" data-mood-board-exports="">
        <p className="text-xs font-semibold text-ink/60">Download your board</p>
        <div className="flex flex-wrap items-center gap-2">{parts.pdfs}</div>
        {parts.lastSaved}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   🧭 STUDIO › MOOD BOARD & DRESS CODE (the new Maker; plan PR 5)
   ═══════════════════════════════════════════════════════════════════════════ */

/** Every role on the guest list (a guest's extra roles included), with how many hold it. */
function guestRoleTally(guests: ReadonlyArray<{ role: GuestRole; extra_roles?: GuestRole[] | null }>): Array<{ role: GuestRole; count: number }> {
  const m = new Map<GuestRole, number>();
  for (const g of guests) for (const r of [g.role, ...(g.extra_roles ?? [])]) m.set(r, (m.get(r) ?? 0) + 1);
  return [...m].map(([role, count]) => ({ role, count }));
}

/**
 * The Attire tab's people, in the Mood Board order (owner 2026-10-06: couple →
 * parents → sponsors → entourage → bearers → guests). The couple and the guests
 * are a ROLE's own line in the shipped dress code (`roles`); everyone else is
 * their GROUP's line (`groups`) — the coarse tier the shipped editor offers.
 * Only the people this guest list has; the guests always.
 */
const STUDIO_ATTIRE_GROUPS: ReadonlyArray<{ group: RoleGroup; paletteKey: PaletteKey | null }> = [
  { group: 'vip_family', paletteKey: 'parents_immediate_family' },
  { group: 'principal_sponsors', paletteKey: 'principal_sponsors' },
  { group: 'secondary_sponsors', paletteKey: 'secondary_sponsors' },
  { group: 'muslim_principals', paletteKey: 'muslim_principals' },
  { group: 'bridesmaids', paletteKey: 'bridesmaids' },
  { group: 'groomsmen', paletteKey: 'groomsmen' },
  { group: 'bearers_flower_girl', paletteKey: 'bearers_flower_girl' },
  { group: 'officiants', paletteKey: 'officiants' },
];

function studioAttireRows(tally: ReadonlyArray<{ role: GuestRole }>, config: DressCodeConfig | null): StudioAttireRow[] {
  const roles = new Set(tally.map((t) => t.role));
  const groups = new Set(tally.map((t) => roleGroupOf(t.role)));
  const callOf = (tier: 'roles' | 'groups', key: string) =>
    formatCallTime(((config?.[tier] ?? {}) as Record<string, { callTime?: string }>)[key]?.callTime ?? null);
  const out: StudioAttireRow[] = [];
  if (roles.has('celebrant')) out.push({ tier: 'roles', key: 'celebrant', label: 'The celebrant', paletteKey: null, arrives: callOf('roles', 'celebrant') });
  out.push({ tier: 'roles', key: 'bride', label: 'The bride', paletteKey: 'bride', arrives: callOf('roles', 'bride') });
  out.push({ tier: 'roles', key: 'groom', label: 'The groom', paletteKey: 'groom', arrives: callOf('roles', 'groom') });
  for (const { group, paletteKey } of STUDIO_ATTIRE_GROUPS) {
    if (!groups.has(group)) continue;
    out.push({ tier: 'groups', key: group, label: roleGroupLabel(group), paletteKey, arrives: callOf('groups', group) });
  }
  out.push({ tier: 'roles', key: 'guest', label: 'Guests', paletteKey: 'guest', arrives: null });
  return out;
}

/** 🧭 The new Maker's Studio › Mood Board & Dress Code — drawn by the launch page in place of `MoodBoardMakerBody` while it is on. */
export async function MoodBoardStudioBody({ eventId }: { eventId: string }) {
  const board = await buildMoodBoard(eventId, true);
  if (!board.ok) return <CouldNotLoad />;
  const { studio } = board;
  const supabase = await createClient();
  const [eventRes, draft, changesRes, lookRes] = await Promise.all([
    supabase.from('events').select('invite_theme, role_palette, region').eq('event_id', eventId).maybeSingle(),
    readHubDraft(supabase, eventId).catch(() => null),
    supabase
      .from('event_colour_changes')
      .select('change_id, domain, target_kind, target_key, target_index, old_value, new_value, actor_kind, actor_label, vendor_id, created_at, reverted_at')
      .eq('event_id', eventId)
      .is('reverted_at', null)
      .not('vendor_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(6),
    /* 🧾 The Dress code scene's canvas — the home of the Do's & Don'ts LOOK (`canvas.dos`), which moved here from the toolbar's Style
       (owner, decided 2026-10-09). One row, read beside the others (not after them); a scene the event does not have is no row. */
    supabase
      .from('invitation_widgets')
      .select('widget_id, widget_type, is_always_on, is_visible, display_order, config_json, mode')
      .eq('event_id', eventId)
      .eq('widget_type', 'dress_code')
      .maybeSingle(),
  ]);
  if (eventRes.error) logQueryError('moodBoardStudio.event', eventRes.error, { eventId });
  /* A refused change log is said nowhere as "no changes" — logged; the board still draws. */
  if (changesRes.error) logQueryError('moodBoardStudio.colourChanges', changesRes.error, { eventId }, 'graceful_degrade');
  if (lookRes.error) logQueryError('moodBoardStudio.dressCodeScene', lookRes.error, { eventId }, 'graceful_degrade');
  /* The scene as the couple is editing it (the draft laid over live, as the toolbar's own row read it); none = no look to pick. */
  const lookRow = lookRes.data ? (lookRes.data as unknown as InvitationWidgetRow) : null;
  const dosLookCanvas = lookRow ? sanitizeHubCanvas(overlayHubDraftWidgets([lookRow], draft)[0]?.config_json) : null;
  const live = (eventRes.data ?? { invite_theme: null, role_palette: null, region: null }) as { invite_theme: string | null; role_palette: unknown; region: string | null };
  const shown = overlayHubDraftEvent(live, draft);
  /* 🎨 The five the board shows while it is not the couple's: a theme's drafted fill, else the worn theme's own. */
  const themeId = normalizeThemeId(typeof shown.invite_theme === 'string' ? shown.invite_theme : null) ?? 'house';
  const drafted = sanitizeRolePalette(shown.role_palette ?? {});
  const fallbackFive = (drafted.reception ?? []).length > 0 ? drafted.reception! : themeSeedPalette(themeId).reception;

  const changes: StudioChange[] = ((changesRes.data ?? []) as ColourChangeRow[]).map((r) => {
    const d = describeColourChange(r);
    return { id: r.change_id, who: r.actor_label?.trim() || 'Your supplier', what: d.what, from: d.from, to: d.to };
  });
  const own = resolveRegion(live.region);
  const regions = [...allRegions()]
    .filter((r) => r.psgc_code)
    .sort((a, b) => (a.slug === own?.slug ? -1 : b.slug === own?.slug ? 1 : 0))
    .map((r) => ({ key: r.psgc_code!, label: r.display_label }));

  return (
    <MoodBoardStudio
      eventId={eventId}
      /* 🎨 The board as the couple is editing it — the draft over live (step 4c: the palette waits for Apply). */
      palette={draft && ('role_palette' in draft.events || 'main_colours' in draft.events) ? drafted : studio.palette}
      fallbackFive={fallbackFive}
      frozenDressing={[...frozenNow(studio.finalizations).dressingFields]}
      changes={changes}
      attire={studioAttireRows(studio.roleTally, studio.dressConfig)}
      dressConfig={studio.dressConfig as unknown as Record<string, unknown> | null}
      attireStyles={ATTIRE_STYLES.map((k) => ({ key: k, label: ATTIRE_STYLE_LABEL[k] }))}
      inspirations={studio.inspirations}
      autoThemes={HUB_THEMES.filter((t) => t.ready).map((t) => ({ name: t.name, five: themeSeedPalette(t.id).reception }))}
      regions={regions}
      dosLists={studio.dressLists ? { dos: studio.dressLists.dos, donts: studio.dressLists.donts, incStarter: studio.dressLists.incStarter } : null}
      dosLookCanvas={dosLookCanvas}
    />
  );
}
