import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { INVITE_THEMES, normalizeThemeId, themeMediaKey, type InviteThemeId } from '@/lib/invite-themes';
import { publicUrlForStoredAsset } from '@/lib/uploads';
import { resolveEventMonogramSvg } from '@/lib/monogram-svg-safe';
import { resolveMonogram, splitInitials } from '@/lib/monogram';
import { buildEntourage, ENTOURAGE_COLUMNS, ENTOURAGE_ROLES, roleLabel, type EntourageGuestRow } from '@/lib/entourage';
import { resolveStdFinalizedVenues } from '@/lib/std-venues';
import { HERO_EVENT_COLUMNS, resolveHero } from '@/lib/event-hero';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { eventSeatingPublished } from '@/lib/seat-pass';
import { loadEntourageSectionOrder } from '@/app/[slug]/_lib/loaders';
import { sanitizeRoleAttire, ATTIRE_STYLE_LABEL, type RoleAttireRule } from '@/lib/role-dress-code';
import { sanitizeGroupAttire } from '@/lib/role-group-dress-code';
import { ROLE_GROUP_LABELS } from '@/lib/role-groups';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { buildEventLandingUrl, renderEventLandingQrPng, renderInvitationQrPng } from '@/lib/qr';
import { resolveEventOwnerSlug } from '@/lib/public-event-url';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { GuestRole } from '@/lib/guests';
import type { PrintImages, PrintMonogram, PrintPass, PrintSetData } from '@/lib/print-layout';
import {
  blockTime,
  ceremonyBlock,
  coupleNames,
  firstBlockOf,
  parsePrintDetails,
  printedDate,
  printLookFor,
  type PrintLook,
  type PrintMode,
  type PrintParent,
  type RsvpChoice,
} from '@/lib/print-pieces';
import { fetchEgiftMethods } from '@/lib/egift';

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
  'event_id, display_name, event_type, event_date, slug, invite_theme, venue_name, venue_address, std_film_ceremony_name, std_film_venue_name, dress_code_config, role_palette, print_details, pabuya_message, special_message, love_story, landing_page_hero_image_url, landing_page_hero_video_r2_key, monogram_text, monogram_color, monogram_style, monogram_font_key, monogram_frame_key, monogram_custom_svg, monogram_uploaded_svg';

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
};

export async function readPrintEvent(admin: SupabaseClient, eventId: string): Promise<PrintEventRow | null> {
  const { data, error } = await admin.from('events').select(EVENT_COLUMNS).eq('event_id', eventId).maybeSingle();
  if (error) logQueryError('print-set.readPrintEvent', error, { event_id: eventId }, 'graceful_degrade');
  return (data as PrintEventRow | null) ?? null;
}

/** Is Event Hub Pro live for this event right now — the print-ready gate. */
export async function printOwnsPro(eventId: string): Promise<boolean> {
  return eventCoupleWebsiteProActive(createAdminClient(), eventId).catch(() => false);
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

/** An uploaded / composed mark → its path data, when it is plain paths. */
export function monogramPathsFrom(svg: string | null): PrintMonogram | null {
  if (!svg) return null;
  // A transform or a <use> would move the pieces somewhere these paths do
  // not know about — draw the initials instead of a scrambled mark.
  if (/\btransform\s*=|<use\b|<image\b/i.test(svg)) return null;
  const vb = /viewBox\s*=\s*"([-\d.\s,]+)"/i.exec(svg)?.[1]?.trim().split(/[\s,]+/).map(Number);
  const paths = [...svg.matchAll(/<path\b[^>]*?\sd\s*=\s*"([^"]+)"/gi)].map((m) => m[1]!).filter(Boolean);
  if (!paths.length) return null;
  const viewBox: [number, number, number, number] =
    vb && vb.length === 4 && vb.every((v) => Number.isFinite(v)) ? (vb as [number, number, number, number]) : [0, 0, 1024, 1024];
  return { viewBox, paths };
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

async function readEntourage(admin: SupabaseClient, eventId: string) {
  const { data, error } = await admin
    .from('guests')
    .select(ENTOURAGE_COLUMNS)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .or(`role.in.(${ENTOURAGE_ROLES.join(',')}),extra_roles.ov.{${ENTOURAGE_ROLES.join(',')}}`);
  if (error) {
    logQueryError('print-set.readEntourage', error, { event_id: eventId }, 'graceful_degrade');
    return [];
  }
  // The couple's own section order, read on ITS OWN (the loader's rule: an
  // unreadable preference prints the built-in order, never breaks the card).
  return buildEntourage((data ?? []) as EntourageGuestRow[], await loadEntourageSectionOrder(admin, eventId));
}

function attireLines(raw: unknown): Array<{ label: string; line: string }> {
  const cfg = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const say = (r: RoleAttireRule) => (r.note ? `${ATTIRE_STYLE_LABEL[r.style]}, ${r.note}` : ATTIRE_STYLE_LABEL[r.style]);
  const out: Array<{ label: string; line: string }> = [];
  for (const [group, rule] of Object.entries(sanitizeGroupAttire(cfg.groups))) {
    if (rule) out.push({ label: ROLE_GROUP_LABELS[group as keyof typeof ROLE_GROUP_LABELS], line: say(rule) });
  }
  const roles = sanitizeRoleAttire(cfg.roles, (v) => roleLabel(v as GuestRole) !== null || v === 'bride' || v === 'groom');
  for (const [role, rule] of Object.entries(roles)) {
    const label = roleLabel(role as GuestRole) ?? (role === 'bride' ? 'Bride' : role === 'groom' ? 'Groom' : null);
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

/** The parents on this event's guest list — for the Details panel's read-only list. */
export async function parentsFromEntourageForEvent(eventId: string): Promise<PrintParent[]> {
  const admin = createAdminClient();
  return parentsFromEntourage(await readEntourage(admin, eventId));
}

/** Does this event have a Mood Board palette to print? */
export function hasPalette(rolePalette: unknown): boolean {
  return swatchesFrom(rolePalette).length > 0;
}

/** The parents, from the guest list's Parents group (groom's side, then bride's). */
export function parentsFromEntourage(groups: ReturnType<typeof buildEntourage>): PrintParent[] {
  const g = groups.find((x) => x.key === 'parents');
  if (!g) return [];
  const out: PrintParent[] = [];
  for (const row of g.rows) {
    for (const p of row) {
      if (!p) continue;
      out.push({ name: p.name, deceased: false, side: p.role === 'bride_parents' ? 'bride' : 'groom' });
    }
  }
  return out;
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
 * whatever the hero is (owner: "classic has no photo or video").
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
};

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

  const stored = parsePrintDetails(event.print_details);
  const inc = stored.include;
  const [blocks, entourage, venues, ownerSlug, stillRaw, giftLines, hosts] = await Promise.all([
    readBlocks(admin, eventId),
    readEntourage(admin, eventId),
    resolveStdFinalizedVenues(admin, eventId),
    event.slug ? resolveEventOwnerSlug(admin, eventId).catch(() => null) : Promise.resolve(null),
    look.still !== 'none'
      ? heroStill(event, opts.mode).then((h) => h ?? themeStill(theme, opts.mode))
      : Promise.resolve(null),
    readGiftLines(admin, eventId),
    stored.rsvp?.kind === 'host' ? readRsvpHosts(eventId) : Promise.resolve([] as RsvpHostOption[]),
  ]);

  const ceremony = ceremonyBlock(blocks);
  const reception = firstBlockOf(blocks, 'reception');
  const mark = resolveMonogram(event);
  const [a, b] = splitInitials(mark.text || event.display_name || '');
  const isWedding = (event.event_type ?? 'wedding') === 'wedding';

  const images: PrintImages = {};
  let still = stillRaw;
  if (still && look.sepia) still = await sepia(still);
  if (still) images.still = { bytes: still, mime: 'image/jpeg' };

  let hasEventQr = false;
  if (opts.withEventQr !== false && event.slug) {
    try {
      const png = await renderEventLandingQrPng({ appUrl, slug: event.slug, ownerSlug, width: opts.mode === 'print' ? 900 : 360 });
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
    eyebrow: isWedding ? 'The wedding of' : 'The celebration of',
    dateLabel: printedDate(event.event_date),
    ceremonyTime: blockTime(ceremony),
    ceremonyVenue: ceremony?.location?.trim() || venues.ceremony || event.std_film_ceremony_name?.trim() || null,
    receptionTime: blockTime(reception),
    receptionVenue: reception?.location?.trim() || venues.reception || event.std_film_venue_name?.trim() || event.venue_name?.trim() || null,
    monogram: monogramPathsFrom(resolveEventMonogramSvg(event)),
    initials: [a, b].filter(Boolean).join(' & ') || 'S',
    // 🔑 THE INCLUDE TOGGLES DECIDE WHAT IS HANDED TO THE LAYOUT — an unticked
    // source is not drawn because it is never passed, not because a layout
    // remembered to check a flag.
    details: {
      parents: inc.parents ? parentsFromEntourage(entourage) : [],
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
    },
    // The parents print on the Invitation card (the owner's sample), not twice.
    entourage: entourage.filter((g) => g.key !== 'parents'),
    attire: attireLines(event.dress_code_config),
    swatches: inc.moodBoard ? swatchesFrom(event.role_palette) : [],
    hubAddress,
    hasStill: Boolean(images.still),
    hasEventQr,
  };
  return { event, theme, look, data, images, appUrl, ownerSlug };
}

/**
 * Every guest's pass (the Pro batch) or every guest's QR (the free sheet) —
 * one QR per guest, the SAME invitation URL their own QR encodes
 * (`renderInvitationQrPng`, so a printed code opens that guest's pass).
 */
export async function loadGuestPasses(
  set: Pick<LoadedPrintSet, 'event' | 'appUrl' | 'ownerSlug'>,
  /** `limit` — the first N guests only (the Maker's thumbnail draws page 1, not 200 QRs). */
  opts: { width: number; limit?: number },
): Promise<{ passes: PrintPass[]; images: PrintImages; measured: boolean }> {
  const admin = createAdminClient();
  const eventId = set.event.event_id;
  const { data, error } = await admin
    .from('guests')
    // The canonical entourage columns (the dup-rule guard's reference list) + the QR token.
    .select(`${ENTOURAGE_COLUMNS}, qr_token`)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .order('last_name', { ascending: true });
  if (error) {
    logQueryError('print-set.loadGuestPasses', error, { event_id: eventId }, 'graceful_degrade');
    return { passes: [], images: {}, measured: false };
  }
  type G = { guest_id: string; first_name: string | null; last_name: string | null; display_name: string | null; name_prefix: string | null; name_suffix: string | null; qr_token: string | null };
  const all = ((data ?? []) as G[]).filter((g) => g.qr_token);
  const guests = opts.limit ? all.slice(0, opts.limit) : all;

  const seatOf = new Map<string, string>();
  const seatNumberOf = new Map<string, string>();
  // Tables print only once the couple has published seating (the same gate the guest pages use).
  if (await eventSeatingPublished(admin, eventId)) {
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

  const mark = resolveMonogram(set.event);
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
        monogram: mark,
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
