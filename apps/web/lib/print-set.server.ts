import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { asViewed } from '@/lib/view-as-free.server';
import { INVITE_THEMES, normalizeThemeId, themeMediaKey, type InviteThemeId } from '@/lib/invite-themes';
import { publicUrlForStoredAsset } from '@/lib/uploads';
import { heroMarkSvg } from '@/lib/hero-monogram-data';
import { flattenSvgMark, rasterMarkPayload } from '@/lib/print-mark';
import { resolveMonogram, splitInitials } from '@/lib/monogram';
import { buildEntourage, ENTOURAGE_COLUMNS, ENTOURAGE_COUPLE_FIELDS, ENTOURAGE_ROLES, roleLabel, type EntourageGuestRow } from '@/lib/entourage';
import { resolveStdFinalizedVenues } from '@/lib/std-venues';
import { HERO_EVENT_COLUMNS, resolveHero } from '@/lib/event-hero';
import { heroGroundNeedsOwnership, heroMayBePageGround } from '@/lib/page-ground';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { guestsMaySeeSeatsFor } from '@/lib/guests-may-see-seats';
import { loadEntourageSectionOrder } from '@/app/[slug]/_lib/loaders';
import { eventWordsFor } from '@/app/[slug]/_lib/event-words';
import { sanitizeRoleAttire, ATTIRE_STYLE_LABEL, type RoleAttireRule } from '@/lib/role-dress-code';
import { sanitizeGroupAttire } from '@/lib/role-group-dress-code';
import { ROLE_GROUP_LABELS, roleGroupLabel } from '@/lib/role-groups';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { buildEventLandingUrl, renderEventLandingQrPng, renderInvitationQrPng } from '@/lib/qr';
import type { QrLook } from '@/lib/qr-look';
import { resolveEventQrLook } from '@/lib/qr-look.server';
import { resolveEventOwnerSlug } from '@/lib/public-event-url';
import { printPreviewVersion } from '@/lib/print-preview-cache';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { GuestRole } from '@/lib/guests';
import type { RoleNames } from '@/lib/role-names';
import { readRoleNames } from '@/lib/role-names.server';
import type { PrintImages, PrintMonogram, PrintPass, PrintSetData } from '@/lib/print-layout';
import {
  blockTime,
  ceremonyBlock,
  coupleNames,
  firstBlockOf,
  foodMoments,
  menuHasDishes,
  parsePrintDetails,
  type MenuMoment,
  printedDate,
  printLookFor,
  type PrintLook,
  type PrintMode,
  type PrintParent,
  type RsvpChoice,
} from '@/lib/print-pieces';
import { fetchEgiftMethods } from '@/lib/egift';
import { printStoryChapters } from '@/lib/love-story-moments';
import { VENDOR_PACKAGE_ITEM_SELECT, keptItemRows, resolveVendorCategory, type VendorPackageItemRow } from '@/lib/vendor-packages';
import { PASSED_AWAY, REQUEST_ENTRY_SOURCE } from '@/lib/guests';
import { filterPassCardRows, type PassCardRow } from '@/lib/pass-card';
import { isPlaceholderSeat } from '@/lib/extra-seats';

/**
 * lib/print-set.server.ts — everything a print piece needs, read ONCE.
 *
 * Every read goes through the ADMIN client, and every caller has proven the
 * viewer is a host of the event FIRST (the route handler and the Maker page
 * both do). Nothing here decides who may see it.
 *
 * 🔑 NOTHING IS INVENTED. A card prints only the facts the couple has: no
 * ceremony time when there is no ceremony block, no venue line when no venue is
 * known, no opening line they did not write. Each missing fact is simply not
 * drawn — a printed invitation is the worst place for a placeholder.
 */

// A PLAIN string literal on purpose: `select-column-scan.test.ts` can only check a
// select whose columns it can read. It carries the hero's columns
// (HERO_EVENT_COLUMNS, asserted below) so resolveHero() sees what it needs.
const EVENT_COLUMNS =
  'event_id, display_name, event_type, event_date, slug, invite_theme, venue_name, venue_address, std_film_ceremony_name, std_film_venue_name, dress_code_config, role_palette, print_details, pabuya_message, special_message, love_story, landing_page_hero_image_url, landing_page_hero_video_r2_key, monogram_text, monogram_color, monogram_style, monogram_font_key, monogram_frame_key, monogram_custom_svg, monogram_uploaded_svg, rsvp_ask_config, style_preferences, role_names';

for (const c of HERO_EVENT_COLUMNS) {
  if (!EVENT_COLUMNS.includes(c)) throw new Error(`print-set: EVENT_COLUMNS is missing the hero column ${c}`);
}

export type PrintEventRow = {
  event_id: string;
  display_name: string | null;
  event_type: string | null;
  event_date: string | null;
  slug: string | null;
  invite_theme: string | null;
  venue_name: string | null;
  venue_address: string | null;
  std_film_ceremony_name: string | null;
  std_film_venue_name: string | null;
  dress_code_config: unknown;
  role_palette: unknown;
  print_details: unknown;
  pabuya_message: string | null;
  special_message: string | null;
  love_story: unknown;
  landing_page_hero_image_url: string | null;
  landing_page_hero_video_r2_key: string | null;
  monogram_text: string | null;
  monogram_color: string | null;
  monogram_style: string | null;
  monogram_font_key: string | null;
  monogram_frame_key: string | null;
  monogram_custom_svg: string | null;
  monogram_uploaded_svg: string | null;
  /** Which RSVP-form questions this couple still asks — Details panel toggle (lib/rsvp-ask.ts). */
  rsvp_ask_config: unknown;
  /** The couple's saved QR choices live under `.qr` (lib/qr-look.ts); the rest is onboarding's. */
  style_preferences: unknown;
  /** The couple's own words for roles (owner 2026-09-30 — "Bride's Crew"); read through `readRoleNames`. */
  role_names?: unknown;
};

export async function readPrintEvent(admin: SupabaseClient, eventId: string): Promise<PrintEventRow | null> {
  const { data, error } = await admin.from('events').select(EVENT_COLUMNS).eq('event_id', eventId).maybeSingle();
  if (error) logQueryError('print-set.readPrintEvent', error, { event_id: eventId }, 'graceful_degrade');
  return (data as PrintEventRow | null) ?? null;
}

/** Is Event Hub Pro live for this event right now — the print-ready gate.
 *  👁 As the viewer is SHOWN it (`asViewed`): an internal viewer viewing as a
 *  free couple sees the free set. It gates what is drawn and served, never a
 *  write. */
export async function printOwnsPro(eventId: string): Promise<boolean> {
  return asViewed(eventCoupleWebsiteProActive(createAdminClient(), eventId).catch(() => false));
}

/**
 * The theme on paper. The couple's SAVED theme (a retired id read as its alias:
 * `capiz` → Vintage), or a theme they are previewing in Prints & Tickets.
 *
 * ⚖ Not gated by Pro here, on purpose: everybody sees SAMPLES of their chosen
 * look — that IS the owner's "show them a sample" — and the print-ready file is
 * gated separately (`mayServe`: Classic free, a theme Pro). A preview never
 * writes the choice.
 */
export function printThemeFor(event: Pick<PrintEventRow, 'invite_theme'>, preview?: string | null): InviteThemeId {
  return normalizeThemeId(preview) ?? normalizeThemeId(event.invite_theme) ?? 'house';
}

/**
 * THE COUPLE'S LOGO ON PAPER — the ONE call every surface that stands for the
 * Event Hub hero makes (`heroMarkSvg`: the Maker's Logo composition, then an
 * upload, sanitised, in the couple's reception ink when the mark asks for the
 * palette), never a print-only read of the monogram columns. Owner 2026-09-28:
 * cale-ice's cards printed an "I & C" ring although the couple had made their
 * logo in the Maker — the old reader refused any `transform=`, which every
 * studio logo has. Outlines when the mark is vector (`lib/print-mark.ts`), the
 * uploaded picture when it is the raster wrapper, the initials otherwise.
 */
export async function printMarkFor(event: PrintEventRow): Promise<{ monogram: PrintMonogram | null; image: PrintImages[string] }> {
  const svg = heroMarkSvg(event);
  const raster = rasterMarkPayload(svg);
  if (raster) {
    try {
      const sharp = (await import('sharp')).default;
      const png = new Uint8Array(await sharp(raster.bytes).png().toBuffer());
      return { monogram: { kind: 'image', w: raster.w, h: raster.h }, image: { bytes: png, mime: 'image/png' } };
    } catch (err) {
      console.error('[print-set] raster logo unreadable', String(err));
      return { monogram: null, image: null };
    }
  }
  const flat = flattenSvgMark(svg);
  return { monogram: flat ? { kind: 'outline', ...flat } : null, image: null };
}

type BlockRow = { label: string | null; block_type: string | null; start_at: string | null; location: string | null; parent_block_id: string | null; is_public?: boolean | null };

async function readBlocks(admin: SupabaseClient, eventId: string): Promise<BlockRow[]> {
  const { data, error } = await admin
    .from('event_schedule_blocks')
    .select('label, block_type, start_at, location, parent_block_id, is_public')
    .eq('event_id', eventId)
    .order('start_at', { ascending: true });
  if (error) logQueryError('print-set.readBlocks', error, { event_id: eventId }, 'graceful_degrade');
  return (data as BlockRow[] | null) ?? [];
}

async function readEntourage(
  admin: SupabaseClient,
  eventId: string,
  /** The couple's role words — the print says "Bride's Crew" where they do. */
  names?: RoleNames,
): Promise<{ groups: ReturnType<typeof buildEntourage>; passedAway: ReadonlySet<string> }> {
  const { data, error } = await admin
    .from('guests')
    // + `passed_away` for THIS reader only (ENTOURAGE_COLUMNS' own rule: never
    // widen the shared list for one reader) — the parents' "the late …".
    // + who is a real couple — the card prints a pair line exactly as the page does.
    .select(`${ENTOURAGE_COLUMNS}, ${PASSED_AWAY}, ${ENTOURAGE_COUPLE_FIELDS}`)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .or(`role.in.(${ENTOURAGE_ROLES.join(',')}),extra_roles.ov.{${ENTOURAGE_ROLES.join(',')}}`);
  if (error) {
    logQueryError('print-set.readEntourage', error, { event_id: eventId }, 'graceful_degrade');
    return { groups: [], passedAway: new Set() };
  }
  const rows = (data ?? []) as Array<EntourageGuestRow & { passed_away?: boolean | null }>;
  const passedAway = new Set(rows.filter((r) => r.passed_away === true && r.guest_id).map((r) => r.guest_id as string));
  // The couple's own section order, read on ITS OWN (the loader's rule: an
  // unreadable preference prints the built-in order, never breaks the card).
  return { groups: buildEntourage(rows, await loadEntourageSectionOrder(admin, eventId), names), passedAway };
}

function attireLines(raw: unknown, names?: RoleNames): Array<{ label: string; line: string }> {
  const cfg = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const say = (r: RoleAttireRule) => (r.note ? `${ATTIRE_STYLE_LABEL[r.style]}, ${r.note}` : ATTIRE_STYLE_LABEL[r.style]);
  const out: Array<{ label: string; line: string }> = [];
  for (const [group, rule] of Object.entries(sanitizeGroupAttire(cfg.groups))) {
    if (rule) out.push({ label: roleGroupLabel(group as keyof typeof ROLE_GROUP_LABELS, names), line: say(rule) });
  }
  const roles = sanitizeRoleAttire(cfg.roles, (v) => roleLabel(v as GuestRole) !== null || v === 'bride' || v === 'groom');
  for (const [role, rule] of Object.entries(roles)) {
    const label = roleLabel(role as GuestRole, names) ?? (role === 'bride' ? 'Bride' : role === 'groom' ? 'Groom' : null);
    if (rule && label) out.push({ label, line: say(rule) });
  }
  return out;
}

function swatchesFrom(raw: unknown): string[] {
  const palette = sanitizeRolePalette(raw) as Record<string, string[] | undefined>;
  const seen = new Set<string>();
  for (const colors of Object.values(palette)) for (const c of colors ?? []) seen.add(c);
  return [...seen].slice(0, 6);
}


// ─── The words, each from its one home ──────────────────────────────────────

export type RsvpHostOption = { moderatorId: string; label: string; contact: string | null };

/**
 * The people a couple may name as "Kindly reply" — the event's accepted hosts,
 * coordinator included (owner 2026-09-25: *"will either be the host information
 * or coordinator they just pick"*). Name and a phone (else an email) from their
 * own account — read here, never copied into the event.
 */
export async function readRsvpHosts(eventId: string): Promise<RsvpHostOption[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('event_moderators')
    .select('moderator_id, user_id, role_subtype, display_label, accepted_at, removed_at')
    .eq('event_id', eventId)
    .not('accepted_at', 'is', null)
    .is('removed_at', null);
  if (error) {
    logQueryError('print-set.readRsvpHosts', error, { event_id: eventId }, 'graceful_degrade');
    return [];
  }
  type M = { moderator_id: string; user_id: string | null; role_subtype: string | null; display_label: string | null };
  const mods = (data ?? []) as M[];
  const ids = mods.map((m) => m.user_id).filter((v): v is string => Boolean(v));
  const users = new Map<string, { display_name: string | null; first_name: string | null; last_name: string | null; phone: string | null; email: string | null }>();
  if (ids.length) {
    const { data: rows } = await admin.from('users').select('user_id, display_name, first_name, last_name, phone, email').in('user_id', ids);
    for (const u of (rows ?? []) as Array<{ user_id: string; display_name: string | null; first_name: string | null; last_name: string | null; phone: string | null; email: string | null }>) users.set(u.user_id, u);
  }
  return mods.map((m) => {
    const u = m.user_id ? users.get(m.user_id) : undefined;
    const name = u?.display_name?.trim() || [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim() || m.display_label?.trim() || 'Host';
    const role = m.role_subtype ? m.role_subtype.replace(/_/g, ' ') : null;
    return { moderatorId: m.moderator_id, label: role ? `${name} · ${role}` : name, contact: u?.phone?.trim() || u?.email?.trim() || null };
  });
}

/** The chosen reply line: a host's name and number, or the couple's own words. */
export function rsvpLine(choice: RsvpChoice | null, hosts: RsvpHostOption[]): string | null {
  if (!choice) return null;
  if (choice.kind === 'manual') return choice.text;
  const h = hosts.find((x) => x.moderatorId === choice.moderatorId);
  if (!h) return null;
  const name = h.label.split(' · ')[0]!;
  return h.contact ? `${name} · ${h.contact}` : name;
}

/** E-Gifts (the Pabuya page) → the printed gift lines, account digits masked by the layout. */
async function readGiftLines(admin: SupabaseClient, eventId: string): Promise<string[]> {
  const methods = await fetchEgiftMethods(admin, eventId, { enabledOnly: true });
  return methods
    .slice(0, 4)
    .map((m) => [m.label, m.account_name, m.handle].filter((v) => v && String(v).trim()).join(' · '))
    .filter(Boolean);
}

/** The couple's story in words — `events.love_story` (the Our Story editor's blob). */
function storyText(raw: unknown): string | null {
  if (typeof raw === 'string') return raw;
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  for (const k of ['how_we_met', 'spark', 'proposal']) {
    const v = r[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return null;
}

/** The first sentence or two of the couple's story — a card has room for a line, not a chapter. */
function excerpt(story: string | null): string | null {
  const t = story?.replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (t.length <= 180) return t;
  const cut = t.slice(0, 180);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return stop > 60 ? cut.slice(0, stop + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}


/**
 * The same parents, each with their GUEST ROW's id — the Maker's Details opens
 * a parent's own guest card from the invitation (a card, never a names-only
 * box: `updateGuest` writes every column). One read, the same groups the print
 * draws from, so the list and the card cannot disagree about who the parents are.
 */
export async function parentGuestsForEvent(eventId: string): Promise<Array<PrintParent & { guestId: string | null }>> {
  const admin = createAdminClient();
  const { groups, passedAway } = await readEntourage(admin, eventId);
  return parentsWithIds(groups, passedAway);
}

/** Does this event have a Mood Board palette to print? */
export function hasPalette(rolePalette: unknown): boolean {
  return swatchesFrom(rolePalette).length > 0;
}

/**
 * The parents, from the guest list's Parents group (groom's side, then bride's).
 * 🕯 A parent the couple marked "Passed away" on the guest card is still printed —
 * as "the late …" (`parentLine`) — never dropped.
 */
export function parentsFromEntourage(
  groups: ReturnType<typeof buildEntourage>,
  passedAway: ReadonlySet<string> = new Set(),
): PrintParent[] {
  return parentsWithIds(groups, passedAway).map(({ guestId: _id, ...p }) => p);
}

function parentsWithIds(
  groups: ReturnType<typeof buildEntourage>,
  passedAway: ReadonlySet<string>,
): Array<PrintParent & { guestId: string | null }> {
  const g = groups.find((x) => x.key === 'parents');
  if (!g) return [];
  const out: Array<PrintParent & { guestId: string | null }> = [];
  for (const row of g.rows) {
    for (const p of row) {
      if (!p) continue;
      out.push({
        guestId: p.id,
        name: p.name,
        deceased: p.id !== null && passedAway.has(p.id),
        side: p.role === 'bride_parents' ? 'bride' : 'groom',
      });
    }
  }
  return out;
}

// ─── The Menu's first source: a booked caterer ──────────────────────────────

/** The supplier kinds whose package lines are food and drink for the guests (crew meals are not). */
const MENU_CATEGORIES = new Set(['catering', 'cake_maker', 'mobile_bar']);

/**
 * THE CATERER'S MENU — owner 2026-09-28: *"from vendors from ceremony, to
 * cocktail to the buffet"*. The dishes a couple's BOOKED supplier sells them:
 * every LOCKED package's lines that survived the couple's own customisation
 * (`keptItemRows`, the one definition the budget uses), where the line is food
 * or drink (`resolveVendorCategory`). One moment per package, named as the
 * supplier named it. Read at print time, never copied — the couple's own typed
 * menu, when they have one, is what prints.
 *
 * A refused read is logged and reads as "no caterer menu" — the couple can
 * still type theirs; nothing here invents a dish.
 */
export async function readCatererMenu(admin: SupabaseClient, eventId: string): Promise<MenuMoment[]> {
  const { data: bookings, error } = await admin
    .from('event_vendor_packages')
    .select('booking_id, package_id, customizations_json')
    .eq('event_id', eventId)
    .eq('status', 'locked');
  if (error) {
    logQueryError('print-set.readCatererMenu', error, { event_id: eventId }, 'graceful_degrade');
    return [];
  }
  const rows = (bookings ?? []) as Array<{ booking_id: string; package_id: string; customizations_json: unknown }>;
  if (!rows.length) return [];
  const ids = [...new Set(rows.map((r) => r.package_id))];
  const [pkgRes, itemRes] = await Promise.all([
    admin.from('vendor_packages').select('package_id, package_name').in('package_id', ids),
    admin.from('vendor_package_items').select(VENDOR_PACKAGE_ITEM_SELECT).in('package_id', ids).order('display_order', { ascending: true }),
  ]);
  if (pkgRes.error) logQueryError('print-set.readCatererMenu.packages', pkgRes.error, { event_id: eventId }, 'graceful_degrade');
  if (itemRes.error) {
    logQueryError('print-set.readCatererMenu.items', itemRes.error, { event_id: eventId }, 'graceful_degrade');
    return [];
  }
  const names = new Map(((pkgRes.data ?? []) as Array<{ package_id: string; package_name: string | null }>).map((p) => [p.package_id, p.package_name]));
  const items = (itemRes.data ?? []) as unknown as VendorPackageItemRow[];
  const out: MenuMoment[] = [];
  for (const b of rows) {
    const cj = b.customizations_json as { removed_item_ids?: unknown } | null;
    const removed = Array.isArray(cj?.removed_item_ids) ? (cj!.removed_item_ids as unknown[]).filter((v): v is string => typeof v === 'string') : [];
    const dishes = keptItemRows(items.filter((i) => i.package_id === b.package_id), removed)
      .filter((i) => MENU_CATEGORIES.has(resolveVendorCategory(i.canonical_service)))
      .map((i) => i.service_description?.replace(/\s+/g, ' ').trim())
      .filter((d): d is string => Boolean(d));
    if (dishes.length) out.push({ title: names.get(b.package_id)?.trim() || '', dishes });
  }
  return out;
}

/**
 * What the Menu editor opens with, beyond the couple's saved menu: their booked
 * caterer's lines (only read when they have typed none) and their schedule's
 * food moments to name the moments by (`foodMoments`).
 */
export async function readMenuSources(eventId: string, saved: readonly MenuMoment[]): Promise<{ caterer: MenuMoment[]; suggestions: string[] }> {
  const admin = createAdminClient();
  const [blocks, caterer] = await Promise.all([
    readBlocks(admin, eventId),
    menuHasDishes(saved) ? Promise.resolve([] as MenuMoment[]) : readCatererMenu(admin, eventId),
  ]);
  return { caterer, suggestions: foodMoments(blocks) };
}

// ─── Images ─────────────────────────────────────────────────────────────────

const stillCache = new Map<string, { at: number; bytes: Uint8Array }>();

/**
 * The theme's still (its loop's first frame), fetched from the public media
 * bucket and cached in memory for an hour. SCREEN and SAMPLE get a
 * recompressed, screen-resolution copy ("just compressed so not print ready");
 * PRINT gets the original bytes.
 */
async function themeStill(theme: InviteThemeId, mode: PrintMode): Promise<Uint8Array | null> {
  const media = INVITE_THEMES[theme].media;
  if (!media) return null;
  const key = themeMediaKey(media.poster);
  if (!key) return null;
  const cacheKey = `${key}:${mode === 'print' ? 'full' : 'low'}`;
  const hit = stillCache.get(cacheKey);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.bytes;
  try {
    const url = publicUrlForStoredAsset(media.poster);
    if (!url) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    let bytes: Uint8Array = new Uint8Array(await res.arrayBuffer());
    const sharp = (await import('sharp')).default;
    if (mode !== 'print') {
      bytes = new Uint8Array(await sharp(bytes).resize({ width: 420, withoutEnlargement: true }).jpeg({ quality: 52 }).toBuffer());
    } else {
      // Normalise to baseline JPEG (pdf-lib embeds JPEG as-is).
      bytes = new Uint8Array(await sharp(bytes).jpeg({ quality: 92 }).toBuffer());
    }
    stillCache.set(cacheKey, { at: Date.now(), bytes });
    return bytes;
  } catch (err) {
    console.error('[print-set] theme still unavailable', { theme, err: String(err) });
    return null;
  }
}

/**
 * THE ONE HERO ON PAPER (Phase 6's resolver — never a hero read of our own).
 * A couple with their own hero photo prints IT where the theme puts its still;
 * `kind: 'card'` (no photo) keeps the theme's first frame. Classic stays paper
 * whatever the hero is (owner: "classic has no photo or video"). The couple's
 * own photo is Pro media — the page's one rule, `heroMayBePageGround`: it
 * prints in a Pro theme (the sample a free couple sees included, as before),
 * and in a free theme (Modern, Cyber Neon) only while the event OWNS Event Hub
 * Pro (`printOwnsPro`, as viewed). A free or lapsed couple's free-theme print
 * carries the theme's own still, the same as its page shows.
 */
async function heroStill(event: PrintEventRow, mode: PrintMode): Promise<Uint8Array | null> {
  const hero = resolveHero(event);
  if (hero.kind !== 'photo' || !hero.photoRef) return null;
  try {
    const url = await displayUrlForStoredAsset(hero.photoRef);
    if (!url) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const sharp = (await import('sharp')).default;
    const src = new Uint8Array(await res.arrayBuffer());
    const out = mode === 'print'
      ? await sharp(src).rotate().jpeg({ quality: 92 }).toBuffer()
      : await sharp(src).rotate().resize({ width: 420, withoutEnlargement: true }).jpeg({ quality: 52 }).toBuffer();
    return new Uint8Array(out);
  } catch (err) {
    console.error('[print-set] hero photo unavailable', String(err));
    return null;
  }
}

/** The couple's chosen poster photo, as the print needs it (screen: small; print: the full picture). */
async function posterPhotoBytes(ref: string, mode: PrintMode): Promise<Uint8Array | null> {
  try {
    const url = await displayUrlForStoredAsset(ref);
    if (!url) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const sharp = (await import('sharp')).default;
    const src = new Uint8Array(await res.arrayBuffer());
    const out = mode === 'print'
      ? await sharp(src).rotate().jpeg({ quality: 92 }).toBuffer()
      : await sharp(src).rotate().resize({ width: 420, withoutEnlargement: true }).jpeg({ quality: 52 }).toBuffer();
    return new Uint8Array(out);
  } catch (err) {
    console.error('[print-set] poster photo unavailable', String(err));
    return null;
  }
}

async function sepia(bytes: Uint8Array): Promise<Uint8Array> {
  const sharp = (await import('sharp')).default;
  return new Uint8Array(
    await sharp(bytes)
      .recomb([
        [0.393 * 0.55 + 0.45, 0.769 * 0.55, 0.189 * 0.55],
        [0.349 * 0.55, 0.686 * 0.55 + 0.45, 0.168 * 0.55],
        [0.272 * 0.55, 0.534 * 0.55, 0.131 * 0.55 + 0.45],
      ])
      .jpeg({ quality: 85 })
      .toBuffer(),
  );
}

// ─── The one loader ─────────────────────────────────────────────────────────

export type LoadedPrintSet = {
  event: PrintEventRow;
  theme: InviteThemeId;
  look: PrintLook;
  data: PrintSetData;
  images: PrintImages;
  appUrl: string;
  ownerSlug: string | null;
  /** The look every code on the set wears — the event's QR look (lib/qr-look.ts),
   *  resolved ONCE here so the corner QR and 200 guest passes agree. */
  qrLook: QrLook;
};

/**
 * EVERY READ A PIECE IS DRAWN FROM, apart from the pictures — ONE function,
 * so `loadPrintSet` (which draws) and `printInputsVersion` (which names the
 * drawing for the browser's cache) can never read different things.
 */
async function readPrintSetInputs(admin: SupabaseClient, eventId: string, event: PrintEventRow) {
  const stored = parsePrintDetails(event.print_details);
  const [blocks, entourage, venues, ownerSlug, giftLines, hosts, catererMenu] = await Promise.all([
    readBlocks(admin, eventId),
    readEntourage(admin, eventId, readRoleNames(event.role_names)),
    resolveStdFinalizedVenues(admin, eventId),
    event.slug ? resolveEventOwnerSlug(admin, eventId).catch(() => null) : Promise.resolve(null),
    readGiftLines(admin, eventId),
    stored.rsvp?.kind === 'host' ? readRsvpHosts(eventId) : Promise.resolve([] as RsvpHostOption[]),
    // The menu's order of sources: the couple's own typed menu, else their booked caterer's lines.
    menuHasDishes(stored.menu) ? Promise.resolve([] as MenuMoment[]) : readCatererMenu(admin, eventId),
  ]);
  return { stored, blocks, entourage, venues, ownerSlug, giftLines, hosts, catererMenu };
}

/**
 * ⚡ THE PREVIEWS' CACHE KEY (owner 2026-09-28: the boarding-pass preview took
 * ~8 s). A hash of the event row and of every read `loadPrintSet` draws from
 * (`readPrintSetInputs` — the same function), the QR's look, and the build
 * (`lib/print-preview-cache.ts`). The Maker puts it in each preview's address
 * as `v`, and a versioned address is answered `immutable`: any change to what
 * a piece is drawn from is a new address. The pictures are named by their refs
 * in the event row (the hero photo, the logo) and by the theme in the address.
 * Null when the event cannot be read — the previews then keep their 60 s.
 */
export async function printInputsVersion(eventId: string): Promise<string | null> {
  const admin = createAdminClient();
  const event = await readPrintEvent(admin, eventId);
  if (!event) return null;
  const [inputs, qrLook] = await Promise.all([
    readPrintSetInputs(admin, eventId, event),
    resolveEventQrLook(admin, eventId, event),
  ]);
  return printPreviewVersion({ event, inputs, qrLook });
}

export async function loadPrintSet(
  eventId: string,
  opts: { mode: PrintMode; previewTheme?: string | null; withEventQr?: boolean },
): Promise<LoadedPrintSet | null> {
  const admin = createAdminClient();
  const event = await readPrintEvent(admin, eventId);
  if (!event) return null;
  const theme = printThemeFor(event, opts.previewTheme);
  const look = printLookFor(theme);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';

  const [{ stored, blocks, entourage, venues, ownerSlug, giftLines, hosts, catererMenu }, stillRaw, printMark] = await Promise.all([
    readPrintSetInputs(admin, eventId, event),
    look.still !== 'none'
      ? heroMayBePageGround(theme, heroGroundNeedsOwnership(theme) ? await printOwnsPro(eventId) : false)
        ? heroStill(event, opts.mode).then((h) => h ?? themeStill(theme, opts.mode))
        : themeStill(theme, opts.mode)
      : Promise.resolve(null),
    printMarkFor(event),
  ]);
  const inc = stored.include;

  const ceremony = ceremonyBlock(blocks);
  const reception = firstBlockOf(blocks, 'reception');
  const mark = resolveMonogram(event);
  const [a, b] = splitInitials(mark.text || event.display_name || '');
  const isWedding = (event.event_type ?? 'wedding') === 'wedding';
  // 🕊 A wake's printed card is never "The celebration of" (audit 2026-09-30) —
  // it takes the post-event cover's own words ("In loving memory", frontKicker).
  const solemn = isWedding ? false : (await eventWordsFor(event.event_type)).solemn;

  const images: PrintImages = {};
  // 🖼 The Our Story poster's own photo (owner 2026-09-29, OWNER ANSWERS (1)) —
  // only when the couple chose one; the theme's picture stays the default.
  const posterBg = stored.posterPhoto ? await posterPhotoBytes(stored.posterPhoto.ref, opts.mode) : null;
  if (posterBg) images.posterBg = { bytes: posterBg, mime: 'image/jpeg' };
  let still = stillRaw;
  if (still && look.sepia) still = await sepia(still);
  if (still) images.still = { bytes: still, mime: 'image/jpeg' };
  if (printMark.image) images.mark = printMark.image;

  // The look every code on this set wears (lib/qr-look.ts): the Setnayan mark
  // for a free event, the couple's own logo · shape · pattern · ink for Pro.
  // Resolved once, here, so the corner QR and every guest pass agree.
  const qrLook = await resolveEventQrLook(admin, eventId, event);

  let hasEventQr = false;
  if (opts.withEventQr !== false && event.slug) {
    try {
      const png = await renderEventLandingQrPng({ appUrl, slug: event.slug, ownerSlug, look: qrLook, width: opts.mode === 'print' ? 900 : 360 });
      images.eventqr = { bytes: new Uint8Array(png), mime: 'image/png' };
      hasEventQr = true;
    } catch (err) {
      console.error('[print-set] event QR failed', String(err));
    }
  }

  const hubAddress = event.slug
    ? buildEventLandingUrl({ appUrl, slug: event.slug, ownerSlug }).replace(/^https?:\/\//, '')
    : null;

  const data: PrintSetData = {
    names: coupleNames(event.display_name),
    eyebrow: isWedding ? 'The wedding of' : solemn ? 'In loving memory of' : 'The celebration of',
    dateLabel: printedDate(event.event_date),
    ceremonyTime: blockTime(ceremony),
    ceremonyVenue: ceremony?.location?.trim() || venues.ceremony || event.std_film_ceremony_name?.trim() || null,
    receptionTime: blockTime(reception),
    receptionVenue: reception?.location?.trim() || venues.reception || event.std_film_venue_name?.trim() || event.venue_name?.trim() || null,
    monogram: printMark.monogram,
    initials: [a, b].filter(Boolean).join(' & ') || 'S',
    // 🔑 THE INCLUDE TOGGLES DECIDE WHAT IS HANDED TO THE LAYOUT — an unticked
    // source is not drawn because it is never passed, not because a layout
    // remembered to check a flag.
    details: {
      parents: inc.parents ? parentsFromEntourage(entourage.groups, entourage.passedAway) : [],
      openingLine: inc.openingLine ? stored.openingLine : null,
      rsvpContact: inc.rsvp ? rsvpLine(stored.rsvp, hosts) : null,
      giftLines: inc.giftDetails ? giftLines : [],
      thankYou: inc.thankYou ? event.pabuya_message?.trim() || null : null,
      specialMessage: inc.specialMessage ? event.special_message?.trim() || null : null,
      program: inc.schedule
        ? blocks
            .filter((b) => b.is_public && !b.parent_block_id && b.start_at && b.label)
            .slice(0, 8)
            .map((b) => `${blockTime(b) ?? ''} · ${b.label}`)
        : [],
      nfc: inc.nfc,
      storyExcerpt: inc.loveStory === 'excerpt' ? excerpt(storyText(event.love_story)) : null,
      guestNames: inc.guestNames,
      // The couple's ONE pick of the pass card's look — the Phone card print
      // and every saved card draw it (lib/pass-card.ts).
      passDesign: stored.passDesign,
    },
    // The parents print on the Invitation card (the owner's sample), not twice.
    entourage: entourage.groups.filter((g) => g.key !== 'parents'),
    attire: attireLines(event.dress_code_config, readRoleNames(event.role_names)),
    swatches: inc.moodBoard ? swatchesFrom(event.role_palette) : [],
    hubAddress,
    menu: menuHasDishes(stored.menu) ? stored.menu : catererMenu,
    // The Our Story poster — the Love Story's one source, read from the same row.
    story: printStoryChapters(event.love_story),
    hasStill: Boolean(images.still),
    hasPosterBg: Boolean(images.posterBg),
    hasEventQr,
    // ⭕ Every slot a code sits in follows the code's shape (`qrPlate`).
    qrShape: qrLook.shape,
    // Paper says which day its facts are from (the pass card's "As of …").
    asOf: opts.mode === 'print' ? `As of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })}` : null,
  };
  return { event, theme, look, data, images, appUrl, ownerSlug, qrLook };
}

/**
 * Every guest's pass (the Pro batch) or every guest's QR (the free sheet) —
 * one QR per guest, the SAME invitation URL their own QR encodes
 * (`renderInvitationQrPng`, so a printed code opens that guest's pass).
 */
export async function loadGuestPasses(
  set: Pick<LoadedPrintSet, 'event' | 'appUrl' | 'ownerSlug' | 'qrLook'>,
  /** `limit` — the first N guests only (the Maker's thumbnail draws page 1, not 200 QRs). */
  opts: {
    width: number;
    limit?: number;
    /**
     * 🎟 PRINTED TICKETS ONLY FOR WHO IS COMING (owner 2026-09-29, DECISION_LOG
     * "OWNER ANSWERS — TEN OPEN QUESTIONS" (9)): the Printed ticket batch
     * (calling card · ticket · boarding · phone card) drops every guest who
     * can't come — the SAME rule the Digital ticket and the zip use
     * (`filterPassCardRows`, lib/pass-card.ts): a decline, a plus-one of a
     * declining bringer, a "+ TBA" seat. The free QR sheet is not a ticket and
     * keeps everyone.
     */
    ticketsOnly?: boolean;
  },
): Promise<{ passes: PrintPass[]; images: PrintImages; measured: boolean }> {
  const admin = createAdminClient();
  const eventId = set.event.event_id;
  const { data, error } = await admin
    .from('guests')
    // The canonical entourage columns (the dup-rule guard's reference list) + the QR token.
    .select(`${ENTOURAGE_COLUMNS}, qr_token, event_id, rsvp_status, plus_one_of_guest_id, plus_one_name_confirmed_at, entry_source, passed_away, deleted_at`)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    // 🛂 No pass for a request until Keep or Link.
    .neq('entry_source', REQUEST_ENTRY_SOURCE).eq(PASSED_AWAY, false)
    .order('last_name', { ascending: true });
  if (error) {
    logQueryError('print-set.loadGuestPasses', error, { event_id: eventId }, 'graceful_degrade');
    return { passes: [], images: {}, measured: false };
  }
  type G = PassCardRow & { guest_id: string; first_name: string | null; last_name: string | null; display_name: string | null; name_prefix: string | null; name_suffix: string | null; qr_token: string | null; plus_one_name_confirmed_at: string | null };
  const listed = ((data ?? []) as unknown as G[]).filter((g) => g.qr_token);
  const all = opts.ticketsOnly
    ? filterPassCardRows(listed, (g) => ({
        ...g,
        tba: Boolean(g.plus_one_of_guest_id) && isPlaceholderSeat({ guest_id: g.guest_id, first_name: g.first_name, confirmed_at: g.plus_one_name_confirmed_at }),
      }))
    : listed;
  const guests = opts.limit ? all.slice(0, opts.limit) : all;

  const seatOf = new Map<string, string>();
  const seatNumberOf = new Map<string, string>();
  // 🎟 A ticket carries the table ON THE DAY (owner 2026-09-30, "THE TICKET
  // GAINS THE SEAT ON THE DAY") — the ticket's half of the one seat rule
  // (`ticketShowsTable`), never the couple's "show early" switch.
  if (await guestsMaySeeSeatsFor(admin, eventId, { ticket: true })) {
    const [{ data: seats }, { data: tables }] = await Promise.all([
      admin.from('event_seat_assignments').select('guest_id, table_id, seat_number').eq('event_id', eventId),
      admin.from('event_tables').select('table_id, table_label').eq('event_id', eventId),
    ]);
    const label = new Map(((tables ?? []) as Array<{ table_id: string; table_label: string | null }>).map((t) => [t.table_id, t.table_label]));
    for (const s of (seats ?? []) as Array<{ guest_id: string; table_id: string; seat_number: number | null }>) {
      if (s.seat_number != null) seatNumberOf.set(s.guest_id, String(s.seat_number));
      const l = label.get(s.table_id);
      if (l) seatOf.set(s.guest_id, /^\d+$/.test(l) ? `Table ${l}` : l);
    }
  }

  const images: PrintImages = {};
  const passes: PrintPass[] = [];
  let n = 0;
  for (const g of guests) {
    n += 1;
    const name =
      [g.name_prefix, g.first_name, g.last_name, g.name_suffix].filter((s) => s && s.trim()).join(' ').trim() ||
      g.display_name?.trim() ||
      'Guest';
    const ref = `qr-${g.guest_id}`;
    try {
      const png = await renderInvitationQrPng({
        appUrl: set.appUrl,
        slug: set.event.slug ?? eventId,
        qrToken: g.qr_token!,
        look: set.qrLook,
        ownerSlug: set.ownerSlug,
        width: opts.width,
      });
      images[ref] = { bytes: new Uint8Array(png), mime: 'image/png' };
    } catch (err) {
      console.error('[print-set] guest QR failed', { guest_id: g.guest_id, err: String(err) });
      continue;
    }
    passes.push({ name, seat: seatOf.get(g.guest_id) ?? null, seatNumber: seatNumberOf.get(g.guest_id) ?? null, qrRef: ref, serial: `Nº ${String(n).padStart(4, '0')}` });
  }
  return { passes, images, measured: true };
}
