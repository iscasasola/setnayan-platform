import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { PlanMyselfSwitch } from '../launch/_components/plan-myself';
import { planMyselfOn } from '@/lib/plan-myself';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronRight, Lock } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { eventWordsFromProfile } from '@/app/[slug]/_lib/event-words';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveBudgetVisibility } from '@/lib/budget-visibility';
import { fetchEventViewer } from '@/lib/event-viewer.server';
import { isDelegateWithoutArea } from '@/lib/event-viewer';
import { profileSetup, resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import {
  LOGO_QUESTION,
  answerKeyOf,
  answerSub,
  coverChoices,
  coverQuestion,
  giftsChoices,
  giftsLabel,
  logoChoices,
  papicChoices,
  papicLabel,
} from '@/lib/event-answers';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { pickVenueBookingRows, type VenueBookingRow } from '@/lib/event-venues';
import { planGroupLabelForCategory } from '@/lib/lock-impact-inputs';
import { CEREMONY_LABEL, VENUE_LABEL, titleCase } from '@/lib/personalized-menu';
import { CEREMONY_VENUE_SETTING_SHORT_LABEL } from '@/lib/venue-settings';
import { fetchScheduleBlocks } from '@/lib/schedule';
import { blockTime, ceremonyBlock, firstBlockOf } from '@/lib/print-pieces';
import { formatWallClock } from '@/lib/schedule-datetime-local';
import { fetchUpcomingItems, type UpcomingItem } from '@/lib/upcoming-items';
import { computeGuestStats, fetchGuestsByEventMeasured, type GuestRole } from '@/lib/guests';
import { isBudgetTruthEnabled } from '@/lib/budget-truth-flag';
import { resolveEventMoney } from '@/lib/budget-truth';
import { buildBudgetLiveSummary, fetchBudgetSnapshot } from '@/lib/budget';
import { legacyCommittedVendorsPhp } from '@/lib/budget-page-money';
import { ORDER_STATUS_LABEL, fetchOrdersForEvent } from '@/lib/orders';
import { computeVatFromBase } from '@/lib/receipts';
import { getEffectiveVatRatePct } from '@/lib/platform-settings';
import { formatPhp, formatPhpRounded } from '@/lib/php';
import { LastSeenCapture } from '@/app/_components/last-seen/last-seen-capture';
import { formatCount } from '@/lib/format-number';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { readEventPoolStatus } from '@/lib/papic-event-pool';
import { INVITE_THEMES, resolveInviteTheme } from '@/lib/invite-themes';
import { HUB_FONT_BY_KEY, sanitizeHubFontKey } from '@/lib/hub-fonts';
import { HUB_BUTTON_FILL_LABEL, HUB_BUTTON_SHAPE_LABEL, parseHubButtonStyle } from '@/lib/hub-buttons';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { resolveDisplayPalette } from '@/lib/room-palette';
import { sanitizeRoleAttire } from '@/lib/role-dress-code';
import { sanitizeGroupAttire } from '@/lib/role-group-dress-code';
import { dressCodeForEveryone } from '@/lib/dress-code-for-everyone';
import { roleLabel } from '@/lib/entourage';
import { resolveMoments } from '@/lib/love-story-moments';
import { readGuestsReply, resolveReplyBy } from '@/lib/rsvp-ask';
import { studioHubHref } from '@/lib/studio-hub';
import { isStoreShellRequest } from '@/lib/request-platform';
import { readHubDraft } from '@/lib/hub-draft-store';
import { overlayHubDraftEvent, type HubDraft } from '@/lib/hub-draft';
import { HOME_GUIDE_ACTION } from '@/lib/home-first-screen';
import {
  COULD_NOT_LOAD,
  HIDDEN_BY_THE_COUPLE,
  NOT_SET_YET,
  describeEventDate,
  howGuestsGetIn,
  rsvpQuestions,
  sectionTitle,
  sheetDate,
  type EventDetailsSectionKey,
} from '@/lib/event-details-sheet';
import {
  RECORD_GROUPS,
  RECORD_ROW_EDITOR,
  foldSummary,
  recordFieldHref,
  recordHref,
  type RecordGroupKey,
  type RecordRowKey,
} from '@/lib/event-details-record';
import { HubDraftDock } from '../website/_components/hub-draft-dock';
import { readHomeGuide } from '../_components/details-guide-home-card';
import { PutAwayCard } from './_components/put-away-card';
import { PeopleWithAccess } from './_components/people-with-access';
import { RecordFold } from './_components/record-fold';
import { RecordRowLink } from './_components/record-row-link';
import { loadPeopleWithAccess } from '@/lib/people-with-access.server';
import { accessFoldSummary, areaCells, type PersonRow } from '@/lib/people-with-access';

export const dynamic = 'force-dynamic';

/** The words `removeHost` can bring back here — anything else in the address is
 *  not ours, so a hand-edited link cannot print its own message on the sheet. */
const REMOVE_REFUSALS = new Set([
  'You cannot remove yourself.',
  'A celebrant stays a co-host. A celebrant can change their role first.',
  'Could not remove them. Try again.',
]);

export const metadata = { title: 'Event Details' };

/**
 * Event Details · /dashboard/[eventId]/details
 *
 * 📋 THE EVENT'S ONE RECORD — EDITED ON THE PAGE (owner 2026-10-04, DECISION_LOG
 * "YES TO ALL": *"Event Details rows are edited in place (money/supplier rows
 * read-only with their link) — supersedes the 2026-10-01 'information only'
 * line"*; and "EVENT DETAILS / MAKER: FOUR FIXES BEFORE BUILD" (2): four folded
 * groups on the phone). Study `EVENT_DETAILS_STUDY_2026-10-04_fable.md` § 1,
 * § 4, § 6 rows 4·5·19, § 7 PR-1; prototype screens 4 and 5.
 *
 *   · FIVE GROUPS — How it looks · How it works · Your event · Guests & money
 *     · Event access (`RECORD_GROUPS`; the fifth, owner 2026-10-07). Phone: four folds, one line + summary each, one open
 *     at a time (`record-fold.tsx`, the app's one-open mechanism); the
 *     Finish-your-Event-Hub card on top. Desktop: every group open.
 *   · EVERY ROW OPENS ITS FIELD — the SAME editor the Maker opens for that fact
 *     (`RECORD_ROW_EDITOR` → `record-editor.tsx`), on the phone in the Maker's
 *     half sheet, on a desktop in place under the row. A row's address
 *     (`…/details/field/<row>`) arrives in the `@field` slot, so opening writes
 *     nothing and the record stays as it is.
 *   · DRAFTED — what the Event Hub draws saves into the Event Hub draft; this
 *     page carries the Maker's own Undo · Apply (`HubDraftDock`), and a row
 *     shows the drafted value with "Waiting for Apply" until it is applied.
 *     Event settings keep their own Save (they are not Hub publications).
 *   · READ-ONLY, WITH ONE QUIET LINK — Budget, Suppliers, Services, Purchases
 *     and the guest names (the Guest list owns them). The studios (the media
 *     library, the Logo studio, the Schedule, the Mood Board) open as
 *     themselves from their row (`RECORD_ROW_TOOL`).
 *   · EMPTY ≠ FAILED ≠ HIDDEN. An empty fact reads "Not set yet"; a read that
 *     FAILED reads "Could not load this…"; a part the couple did not share with
 *     a helper reads "Hidden by the couple". The three are never drawn alike.
 *   · A row a booking governs carries 🔒; tapping it opens "Locked by your
 *     booking" with Contact support — zero JS (`<details>`).
 *
 * Fixed from the shipped page (measured live on cale-ice, 2026-10-01): the
 * ceremony venue read "Not set" while a parish was booked, the reception row
 * showed its SETTING ("Banquet hall") as the venue, and the copy said
 * "vendors". Venues now come from the confirmed bookings themselves.
 */
export default async function EventDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ host_removed?: string; invite_error?: string }>;
}) {
  const { eventId } = await params;
  const flashParams = (await searchParams) ?? {};

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Every column here is granted to the session (the per-column allowlist,
  // `lint-events-column-grants.mjs`). The two PRIVATE ones (budget target and
  // band) are read through `events_host` below, behind the budget gate.
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(
      'event_id, display_name, event_type, archived, slug, bride_name, groom_name, region, ' +
        'ceremony_type, secondary_ceremony_type, event_date, event_date_precision, date_mode, date_candidates, ' +
        'date_window_start, date_window_end, estimated_pax, venue_setting, ceremony_venue_setting, ' +
        'guest_list_edit_deadline, adaptive_pricing_mode, monogram_text, invite_theme, role_palette, ' +
        'site_font_key, site_button_style, site_button_color, site_bg_music_r2_key, site_bg_music_enabled, landing_page_hero_image_url, ' +
        'setnayan_ai_active, planning_mode, rsvp_ask_config, love_story, dress_code_config, special_message, ' +
        'std_film_ceremony_name, std_film_venue_name, venue_name, ' +
        // 🗂 The onboarding's last answers, each in its own column (owner 2026-10-02).
        'papic_on, gifts_on, logo_wanted, cover_photo_wanted',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (eventError) throw new Error(eventError.message);
  if (!event) notFound();

  const e = event as unknown as Record<string, unknown>;
  const str = (k: string): string | null => {
    const v = e[k];
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
  };
  const num = (k: string): number | null => {
    const v = e[k];
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  };

  const base = `/dashboard/${eventId}`;
  const admin = createAdminClient();
  const now = new Date();
  const budgetTruth = isBudgetTruthEnabled();

  const [profile, viewer, budgetAccess] = await Promise.all([
    resolveProfile(str('event_type') ?? 'wedding'),
    fetchEventViewer(supabase, eventId, user.id),
    resolveBudgetVisibility(supabase, eventId, user.id),
  ]);
  const words = eventWordsFromProfile(profile);
  const setupOfType = profileSetup(profile);
  const eventWord = words.eventWord;
  const maker = surfaceEnabled(profile, 'website');
  // A helper the couple did not give the guest list reads "Hidden by the couple",
  // never an empty list — the guest read below is skipped for them.
  const mayReadGuests = !isDelegateWithoutArea(viewer, 'guest_list');
  const guestsHidden = !mayReadGuests;
  const suppliersHidden = isDelegateWithoutArea(viewer, 'vendors');
  const moneyHidden = !budgetAccess.mayRead;
  /* ✍ Who may open a row's field: who may change that fact in the Maker — the
     couple, on an event whose type has an Event Hub. Event settings save live
     and are not Hub publications, so they only need the couple. */
  const canEditHub = viewer.isCouple && maker;
  const canEditSettings = viewer.isCouple;

  // 👥 People with access (owner 2026-10-03) — the ONE place a host sets who
  // can do what. A host sees every person and sets each area; a delegate sees
  // their own access, as words; anyone else, nothing.
  const accessRead = viewer.isCouple
    ? loadPeopleWithAccess(eventId, user.id).catch((err: unknown) => {
        console.error('[event-details] people with access failed', err);
        return { measured: false as const };
      })
    : null;

  const [vendorsRead, scheduleRead, upcomingRead, guestsRead, ordersRead, vatRead, privateRead, moneyRead, snapshotRead, proRead, poolRead, draftRead, guideRead, storeShell] =
    await Promise.all([
      settle(
        (async () => {
          const { data, error } = await supabase
            .from('event_vendors')
            .select(
              'vendor_id, category, status, vendor_name, updated_at, archived_at, manual_vendor_id, ' +
                'source_venue_directory_id, marketplace_vendor_id, linked_vendor_profile_id',
            )
            .eq('event_id', eventId)
            .is('archived_at', null);
          if (error) throw new Error(error.message);
          return (data ?? []) as unknown as (VenueBookingRow & { vendor_id: string })[];
        })(),
      ),
      settle(fetchScheduleBlocks(supabase, eventId)),
      suppliersHidden
        ? Promise.resolve(null)
        : settle(
            fetchUpcomingItems({
              supabase,
              eventId,
              eventDate: str('event_date'),
              ceremonyType: str('ceremony_type'),
              now,
              remindersEnabled: false,
              statutory: false,
              limit: 50,
            }),
          ),
      mayReadGuests ? settle(fetchGuestsByEventMeasured(supabase, eventId)) : Promise.resolve(null),
      moneyHidden ? Promise.resolve(null) : settle(fetchOrdersForEvent(supabase, eventId)),
      moneyHidden ? Promise.resolve(null) : settle(getEffectiveVatRatePct(supabase)),
      moneyHidden
        ? Promise.resolve(null)
        : settle(
            (async () => {
              const { data, error } = await supabase
                .from('events_host')
                .select('estimated_budget_centavos, budget_band')
                .eq('event_id', eventId)
                .maybeSingle();
              if (error) throw new Error(error.message);
              return (data ?? {}) as { estimated_budget_centavos?: number | string | null; budget_band?: string | null };
            })(),
          ),
      moneyHidden || !budgetTruth ? Promise.resolve(null) : settle(resolveEventMoney(supabase, eventId)),
      moneyHidden || budgetTruth ? Promise.resolve(null) : settle(fetchBudgetSnapshot(supabase, eventId)),
      settle(eventCoupleWebsiteProActive(await eventEntitlementClient(eventId), eventId)),
      readEventPoolStatus(admin, eventId),
      /* 💾 The Event Hub draft — what the couple changed and has not applied.
         A draft that cannot be read shows the live values (no "waiting" marks). */
      canEditHub ? settle(readHubDraft(supabase, eventId)) : Promise.resolve(null),
      /* 🧭 "Finish your Event Hub" — Home's own read of the guided flow. */
      viewer.isCouple ? settle(readHomeGuide({ eventId, memberType: 'couple' })) : Promise.resolve(null),
      isStoreShellRequest(),
    ]);

  /* ✍ As the couple is editing it: the draft laid over the live row (the
     Maker's own overlay). A fact waits for Apply while the two differ. */
  const draft: HubDraft | null = draftRead && draftRead.ok ? draftRead.v : null;
  const shown = overlayHubDraftEvent(e, draft);
  const shownStr = (k: string): string | null => {
    const v = shown[k];
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
  };
  const draftEvents = (draft?.events ?? {}) as Record<string, unknown>;
  const waiting = (...cols: string[]): boolean =>
    cols.some((c) => c in draftEvents && JSON.stringify(draftEvents[c] ?? null) !== JSON.stringify(e[c] ?? null));

  // ── Suppliers + venues: the confirmed bookings, one read ───────────────────
  const confirmed = new Set<string>(CONFIRMED_VENDOR_STATUSES as readonly string[]);
  const lockedSuppliers = vendorsRead.ok
    ? vendorsRead.v.filter((r) => r.status != null && confirmed.has(r.status) && (r.vendor_name ?? '').trim())
    : [];
  // The governed facts (kind · date · guest estimate) lock to support once any
  // supplier is confirmed — the same rule `GovernedFields` enforces.
  const bookingLocks = lockedSuppliers.length > 0;
  const venuesWon = vendorsRead.ok ? pickVenueBookingRows(vendorsRead.v) : { ceremony: null, reception: null };

  // ── The look (as drafted) ─────────────────────────────────────────────────
  const ownsPro = proRead.ok && proRead.v === true;
  const theme = INVITE_THEMES[resolveInviteTheme({ saved: shown.invite_theme, ownsPro: ownsPro || (canEditHub && !storeShell) })];
  const headingFontKey = sanitizeHubFontKey(shown.site_font_key);
  const headingFont = headingFontKey ? HUB_FONT_BY_KEY[headingFontKey].family : theme.fonts.heading;
  const storedPalette = sanitizeRolePalette(e.role_palette);
  const board = resolveDisplayPalette(storedPalette);
  const mainColours = (board.reception ?? []).filter((h) => typeof h === 'string' && h.length > 0);
  const buttonStyle = parseHubButtonStyle(shown.site_button_style);
  const buttons = [
    buttonStyle.shape === 'theme' && buttonStyle.fill === 'theme'
      ? HUB_BUTTON_SHAPE_LABEL.theme
      : `${HUB_BUTTON_SHAPE_LABEL[buttonStyle.shape]} · ${HUB_BUTTON_FILL_LABEL[buttonStyle.fill]}`,
    shownStr('site_button_color') ? 'your colour' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const dress = dressCodeForEveryone({
    stored: storedPalette,
    board,
    roles: sanitizeRoleAttire((e.dress_code_config as { roles?: unknown } | null)?.roles, (v) => roleLabel(v as GuestRole) !== null),
    groups: sanitizeGroupAttire((e.dress_code_config as { groups?: unknown } | null)?.groups),
    ceremonyType: str('ceremony_type'),
  });
  const moments = resolveMoments(shown.love_story).filter((m) => !m.hidden);
  const getIn = howGuestsGetIn(shown.rsvp_ask_config);
  const questions = rsvpQuestions(shown.rsvp_ask_config);
  const guestsReply = readGuestsReply(shown.rsvp_ask_config);
  const replyBy = resolveReplyBy({ deadline: str('guest_list_edit_deadline'), eventDate: shownStr('event_date') });

  // ── Names (as drafted) ────────────────────────────────────────────────────
  const personA = shownStr('bride_name');
  const personB = shownStr('groom_name');
  const names = personA && personB ? `${personA} & ${personB}` : (personA ?? personB ?? shownStr('display_name'));
  const kind =
    eventWord === 'wedding'
      ? (() => {
          const c = str('ceremony_type');
          if (!c) return null;
          const main = CEREMONY_LABEL[c] ?? `${titleCase(c)} ceremony`;
          const also = str('secondary_ceremony_type');
          return also ? `${main} · also ${(CEREMONY_LABEL[also] ?? titleCase(also)).toLowerCase()}` : main;
        })()
      : titleCase(eventWord);

  // ── Key dates, soonest first ──────────────────────────────────────────────
  const payments: UpcomingItem[] =
    upcomingRead && upcomingRead.ok ? upcomingRead.v.items.filter((i) => i.source === 'vendor_payment').slice(0, 2) : [];
  const paymentsFailed =
    !!upcomingRead && (!upcomingRead.ok || upcomingRead.v.unreadableSources.includes('vendor_payment'));
  const blocks = scheduleRead.ok ? scheduleRead.v : [];
  const ceremony = ceremonyBlock(blocks);
  const reception = firstBlockOf(blocks, 'reception');
  const firstPublic = blocks.find((b) => b.is_public && !b.parent_block_id && b.start_at) ?? null;
  const arrive = firstPublic && firstPublic !== ceremony && firstPublic !== reception ? firstPublic : null;
  /* 🕒 The ceremony time as drafted under the Date (`ceremony_time`, HH:MM on
     the venue's wall clock) — else the Ceremony block's own. */
  const draftedCeremonyTime = typeof draftEvents.ceremony_time === 'string' ? draftEvents.ceremony_time : null;
  const ceremonyTime = draftedCeremonyTime
    ? formatWallClock(`2000-01-01T${draftedCeremonyTime}:00`)
    : ceremony
      ? blockTime(ceremony)
      : null;
  const eventDateShown = describeEventDate(shown);

  // ── Money (the Budget page's own four numbers, under either flag state) ───
  const priv = privateRead && privateRead.ok ? privateRead.v : null;
  const targetCentavos = priv?.estimated_budget_centavos != null ? Number(priv.estimated_budget_centavos) : null;
  const orders = ordersRead && ordersRead.ok ? ordersRead.v : null;
  const vat = vatRead && vatRead.ok ? vatRead.v : null;
  const grossOf = (o: { confirmed_total_php: number | null; requested_total_php: number }) =>
    vat == null ? null : computeVatFromBase(Number(o.confirmed_total_php ?? o.requested_total_php), vat).gross;
  let money: { target: number | null; agreed: number; paid: number; owed: number } | null = null;
  if (moneyRead && moneyRead.ok) {
    money = { target: moneyRead.v.targetPhp, agreed: moneyRead.v.committed, paid: moneyRead.v.paid, owed: moneyRead.v.stillOwed };
  } else if (snapshotRead && snapshotRead.ok && orders) {
    // Flag OFF (or the resolver refused): `/budget`'s legacy arithmetic — paid
    // orders + confirmed suppliers for Agreed, the live summary for Paid/Owed.
    const paidOrders = orders
      .filter((o) => o.status === 'paid' || o.status === 'fulfilled')
      .reduce((n, o) => n + Number(o.confirmed_total_php ?? o.requested_total_php ?? 0), 0);
    const live = buildBudgetLiveSummary(snapshotRead.v);
    money = {
      target: targetCentavos != null && targetCentavos > 0 ? targetCentavos / 100 : null,
      agreed: paidOrders + legacyCommittedVendorsPhp(snapshotRead.v.vendors, (s) => confirmed.has(s)),
      paid: live.paid,
      owed: live.remaining,
    };
  }
  const budgetBand = priv?.budget_band ? titleCase(priv.budget_band) : null;
  const shownOrders = (orders ?? []).filter((o) => o.status !== 'draft');
  const totalPaid = shownOrders
    .filter((o) => o.status === 'paid' || o.status === 'fulfilled')
    .reduce((n, o) => n + (grossOf(o) ?? 0), 0);
  const targetWords = money
    ? [budgetBand, money.target != null && money.target > 0 ? `about ${formatPhpRounded(money.target)}` : null].filter(Boolean).join(' · ') || null
    : null;

  // ── Guests ────────────────────────────────────────────────────────────────
  const stats = guestsRead && guestsRead.ok && guestsRead.v.measured ? computeGuestStats(guestsRead.v.rows) : null;
  const estimate = num('estimated_pax');

  // ── Venues: LOCKED first (the Event Hub reads the same), else the typed name as drafted ──
  const venueRow = (
    slot: 'ceremony' | 'reception',
    row: VenueBookingRow | null,
    typed: string | null,
    setting: string | null,
  ) => {
    const settingWord =
      slot === 'ceremony'
        ? setting
          ? (CEREMONY_VENUE_SETTING_SHORT_LABEL[setting as keyof typeof CEREMONY_VENUE_SETTING_SHORT_LABEL] ?? titleCase(setting))
          : null
        : setting
          ? (VENUE_LABEL[setting] ?? titleCase(setting))
          : null;
    if (row) {
      return {
        value: row.vendor_name,
        hint: [row.manual_vendor_id ? 'Added by you · fixed' : 'From your booked supplier · fixed', settingWord].filter(Boolean).join(' · '),
        locked: true,
      };
    }
    const hint = [typed ? `Not booked yet — your Event Hub shows “${typed}”` : null, settingWord ? `Setting: ${settingWord}` : null]
      .filter(Boolean)
      .join(' · ');
    return { value: null, hint: hint || null, locked: false };
  };
  const ceremonySheetRow = venueRow('ceremony', venuesWon.ceremony, shownStr('std_film_ceremony_name'), str('ceremony_venue_setting'));
  const receptionSheetRow = venueRow(
    'reception',
    venuesWon.reception,
    shownStr('venue_name') ?? shownStr('std_film_venue_name'),
    str('venue_setting'),
  );
  const venuesWaiting = waiting('std_film_ceremony_name', 'std_film_venue_name', 'venue_name');

  // ── Services ──────────────────────────────────────────────────────────────
  const pool = poolRead.status;

  const lockNote = (what: string) =>
    `${what} is held by your booking — changing it would change what you booked, so we hold it still. If something has changed, tell us and we will sort it out with your supplier.`;

  /* ✍ The door each row opens: its field (the Maker's own editor) — or nothing
     for a viewer who may not change it. A row never gets an editor of its own. */
  const opens = (row: RecordRowKey): string | null =>
    (RECORD_ROW_EDITOR[row] === 'settings' ? canEditSettings : canEditHub) ? recordFieldHref(eventId, row) : null;
  const record = recordHref(eventId);

  const people = accessRead ? await accessRead : null;
  const ownAccess: PersonRow | null =
    !viewer.isCouple && viewer.delegatePermissions
      ? {
          key: 'me',
          kind: 'helper',
          name: 'You',
          roleWord: 'Your access',
          moderatorId: null,
          guestId: null,
          access: null,
          live: true,
          areas: areaCells(viewer.delegatePermissions),
          lastDay: null,
          ended: false,
          isViewer: true,
          canInviteAsCoordinator: false,
          vendorId: null,
        }
      : null;
  const accessFlash =
    flashParams.host_removed === '1'
      ? 'Removed — their access ended immediately.'
      : flashParams.invite_error && REMOVE_REFUSALS.has(flashParams.invite_error)
        ? flashParams.invite_error
        : null;

  // 💾 A read that failed shows "Could not load…" — never kept as last-seen
  // data. (Money reads are left out: money is never kept at all.)
  const lastSeenFresh =
    vendorsRead.ok &&
    scheduleRead.ok &&
    proRead.ok &&
    poolRead.ok &&
    (people === null || people.measured) &&
    (guestsRead === null || (guestsRead.ok && guestsRead.v.measured));

  /* 📁 Each fold's one line on the phone — built from its own rows' values. */
  const summary: Record<RecordGroupKey, string> = {
    looks: foldSummary([headingFont, mainColours.length > 0 ? `${mainColours.length} colours` : null, buttons]),
    works: foldSummary([
      getIn.value,
      guestsReply ? (questions.length > 1 ? questions.slice(1).join(', ') : null) : null,
      guestsReply && replyBy ? `Reply by ${sheetDate(replyBy.date, false)}` : null,
    ]),
    event: foldSummary([
      eventDateShown,
      ceremonyTime,
      ceremonySheetRow.value ?? shownStr('std_film_ceremony_name'),
      receptionSheetRow.value ?? shownStr('venue_name') ?? shownStr('std_film_venue_name'),
    ]),
    'guests-money': foldSummary([
      stats ? `${formatCount(stats.total)} listed` : null,
      moneyHidden ? null : targetWords,
      lockedSuppliers.length > 0 ? `${formatCount(lockedSuppliers.length)} booked` : null,
    ]),
    // Counted from the rows the fold draws; a failed read says so — never "0".
    access: people ? accessFoldSummary(people.measured ? people.rows : null) : 'Your access',
  };
  const groupTitle = (k: RecordGroupKey) => RECORD_GROUPS.find((g) => g.key === k)!.title;

  const guide = guideRead && guideRead.ok ? guideRead.v : null;

  return (
    /* 💾 Event Details is kept on the phone and shown at once on the next open,
       then refreshed (owner 2026-10-02, DECISION_LOG "LAST-SEEN DATA SHOWS
       INSTANTLY, THEN REFRESHES"). The Budget and Purchases sections and the
       supplier-payment and Papic-credit rows carry `data-money` and are never
       kept (lib/last-seen). */
    <LastSeenCapture page="details" fresh={lastSeenFresh}>
    <section className="sn-col space-y-4" data-event-details>
      <PageMasthead title="Event Details" />
      {/* The slim bar: the record's name and the Maker's own Undo · Apply — a
          change made here is the same waiting change as one made in the Maker. */}
      <div className="sticky top-0 z-20 -mx-4 flex min-h-[52px] items-center gap-2 border-b border-ink/10 bg-cream/95 px-4 py-1.5 backdrop-blur" data-record-bar="">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-[22px] leading-tight text-ink">{names ?? 'Event Details'}</h2>
          <p className="truncate text-[12.5px] text-ink/60">
            {[kind ?? titleCase(eventWord), eventDateShown, str('region')].filter(Boolean).join(' · ')}
          </p>
        </div>
        {canEditHub ? (
          <div className="flex shrink-0 items-center gap-1.5" data-record-draft-bar="">
            <HubDraftDock eventId={eventId} />
          </div>
        ) : null}
      </div>

      {/* 🧭 Finish your Event Hub — on top, while anything is left (Home's own read). */}
      {guide ? (
        <div className="sn-tile flex items-center gap-3 p-4" data-record-finish="">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/60">
              Finish your Event Hub · {formatCount(guide.done)} of {formatCount(guide.total)}
            </p>
            {/* Counted by stage (PR-2, lib/stage-setup.ts) — the same line Home's Next card says. */}
            <p className="mt-1 truncate text-sm text-ink/80">
              Next: {guide.stageTitle} — {formatCount(guide.stageDone)} of {formatCount(guide.stageTotal)} in place
            </p>
          </div>
          <Link
            href={`/dashboard/${eventId}/launch?tool=details&guide=1`}
            className="sn-press inline-flex min-h-11 shrink-0 items-center rounded-full bg-ink px-4 text-sm font-semibold text-cream"
          >
            {HOME_GUIDE_ACTION}
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {/* ══ HOW IT LOOKS ══ */}
        <RecordFold group="looks" title={groupTitle('looks')} summary={summary.looks} recordHref={record}>
          <Section k="look" titled={false}>
            <Row
              row="fonts"
              fact="fonts"
              label="Font"
              value={`Header ${headingFont} · Text ${theme.fonts.body} · Accent ${theme.fonts.script}`}
              open={opens('fonts')}
              record={record}
              waiting={waiting('site_font_key')}
            />
            <Row
              row="colours"
              fact="colours"
              label="Colours"
              open={opens('colours')}
              record={record}
              waiting={waiting('site_bg_color', 'site_art_direction', 'site_magic_traveller')}
              value={
                mainColours.length > 0 ? (
                  <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                    {mainColours.map((h) => (
                      <span key={h} className="inline-flex items-center gap-1">
                        <span aria-hidden className="inline-block h-3.5 w-3.5 rounded-full border border-ink/15" style={{ backgroundColor: h }} />
                        <span className="font-mono text-[11px] text-ink/60">{h.toUpperCase()}</span>
                      </span>
                    ))}
                  </span>
                ) : null
              }
            />
            <Row row="buttons" label="Buttons" value={buttons} open={opens('buttons')} record={record} waiting={waiting('site_button_style', 'site_button_color')} />
            <Row
              row="cover"
              fact="cover"
              label="Cover photo"
              value={shownStr('landing_page_hero_image_url') ? 'Added' : null}
              tool={maker ? `${base}/launch?open=main-background` : null}
              waiting={waiting('landing_page_hero_image_url')}
            />
            <Row row="logo" label="Logo / monogram" value={str('monogram_text')} tool={maker ? `${base}/launch?tool=logo` : null} />
            <Row
              row="music"
              fact="music"
              label="Music"
              value={shownStr('site_bg_music_r2_key') ? (shown.site_bg_music_enabled === false ? 'Added · switched off' : 'Added · plays on open') : null}
              tool={maker ? `${base}/website/site-chrome` : null}
              waiting={waiting('site_bg_music_r2_key', 'site_bg_music_enabled')}
            />
          </Section>
        </RecordFold>

        {/* ══ HOW IT WORKS ══ */}
        <RecordFold group="works" title={groupTitle('works')} summary={summary.works} recordHref={record}>
          <Section k="rsvp">
            {/* "RSVP or not" is NOT a second switch — the "No reply" choices are it (study § 1b). */}
            <Row
              row="guests-get-in"
              fact="guests-get-in"
              label="How guests get in"
              value={getIn.value}
              hint={getIn.chosen ? null : 'The default — not chosen yet'}
              open={opens('guests-get-in')}
              record={record}
              waiting={waiting('rsvp_ask_config')}
            />
            {guestsReply ? (
              <>
                <Row
                  row="rsvp-questions"
                  fact="rsvp-questions"
                  label="What to ask"
                  value={questions.length > 0 ? `${questions.length} · ${questions.join(' · ')}` : null}
                  open={opens('rsvp-questions')}
                  record={record}
                  waiting={waiting('rsvp_ask_config')}
                />
                <Row
                  row="reply-by"
                  fact="reply-by"
                  label="Guests reply by"
                  value={replyBy ? sheetDate(replyBy.date) : null}
                  hint={replyBy?.isDefault ? 'Suggested — 30 days before the day. The guest list closes the same day.' : replyBy ? 'The guest list closes the same day.' : null}
                  open={opens('reply-by')}
                  record={record}
                />
              </>
            ) : null}
          </Section>
          <Section k="hub">
            {setupOfType.cameraDefault !== 'off' ? (
              <Row
                row="papic-answer"
                fact="papic-answer"
                label={papicLabel(words.solemn)}
                value={answerSub(papicChoices(), answerKeyOf('papic_on', shown.papic_on))}
                open={opens('papic-answer')}
                record={record}
                waiting={waiting('papic_on')}
              />
            ) : null}
            {setupOfType.giftsMode !== 'none' ? (
              <Row
                row="gifts-answer"
                fact="gifts-answer"
                label={giftsLabel(setupOfType.giftsMode)}
                value={answerSub(giftsChoices(), answerKeyOf('gifts_on', shown.gifts_on))}
                open={opens('gifts-answer')}
                record={record}
                waiting={waiting('gifts_on')}
              />
            ) : null}
            <Row
              row="logo-answer"
              fact="logo-answer"
              label={LOGO_QUESTION}
              value={answerSub(logoChoices(words.twoPeople), answerKeyOf('logo_wanted', shown.logo_wanted)) || null}
              open={opens('logo-answer')}
              record={record}
              waiting={waiting('logo_wanted')}
            />
            <Row
              row="cover-answer"
              fact="cover-answer"
              label={coverQuestion(words.solemn)}
              value={answerSub(coverChoices(words.solemn), answerKeyOf('cover_photo_wanted', shown.cover_photo_wanted)) || null}
              open={opens('cover-answer')}
              record={record}
              waiting={waiting('cover_photo_wanted')}
            />
            <Row label="Event Hub address" value={str('slug') ? `setnayan.com/${str('slug')}` : null} />
          </Section>
        </RecordFold>

        {/* ══ YOUR EVENT ══ */}
        <RecordFold group="event" title={groupTitle('event')} summary={summary.event} recordHref={record}>
          <Section k="basics">
            <Row row="names" fact="names" label="Names" value={names} open={opens('names')} record={record} waiting={waiting('bride_name', 'groom_name', 'display_name')} />
            <Row
              row="kind"
              fact="kind"
              label={`Kind of ${eventWord}`}
              value={kind}
              lock={bookingLocks && eventWord === 'wedding' ? lockNote(`Your kind of ${eventWord}`) : null}
              open={eventWord === 'wedding' ? opens('kind') : null}
              record={record}
            />
            <Row row="area" fact="area" label="Area" value={str('region')} open={opens('area')} record={record} />
          </Section>

          {/* ── Key dates — the day, its times, and what is due ── */}
          <Section k="key-dates">
            <Row
              row="date"
              fact="date"
              label={`The ${eventWord}`}
              value={eventDateShown}
              lock={bookingLocks ? lockNote(`Your ${eventWord} date`) : null}
              open={opens('date')}
              record={record}
              waiting={waiting('event_date', 'event_date_precision')}
            />
            {scheduleRead.ok ? (
              <>
                <Row row="ceremony-time" label="Ceremony" value={ceremonyTime} open={opens('ceremony-time')} record={record} waiting={draftedCeremonyTime !== null} />
                <Row row="arrive" fact="arrive" label="Guests arrive" value={arrive ? blockTime(arrive) : null} tool={`${base}/schedule`} />
                <Row row="reception-time" label="Reception" value={reception ? blockTime(reception) : null} tool={`${base}/schedule`} />
              </>
            ) : (
              <Row fact="arrive" label="Times on the day" value={COULD_NOT_LOAD} />
            )}
            {paymentsFailed ? (
              <Row money label="Supplier payments" value={COULD_NOT_LOAD} />
            ) : suppliersHidden ? (
              <Row label="Supplier payments" value={HIDDEN_BY_THE_COUPLE} />
            ) : (
              payments.map((p) => (
                <Row
                  money
                  key={p.id}
                  label={sheetDate(p.date.toISOString(), false) ?? '—'}
                  value={`${p.vendorBusinessName ?? p.subtitle} · ${p.title}${p.amountCentavos != null ? ` ${formatPhp(p.amountCentavos / 100)}` : ''}`}
                  hint="Supplier payment"
                />
              ))
            )}
          </Section>

          {/* ── Venues — a booked one is fixed; otherwise the venue is typed here ── */}
          <Section k="venues">
            {vendorsRead.ok ? (
              <>
                <Row
                  row="venues"
                  fact="venues"
                  label={eventWord === 'wedding' ? 'Ceremony' : 'Ceremony venue'}
                  value={ceremonySheetRow.value}
                  hint={ceremonySheetRow.hint}
                  lock={ceremonySheetRow.locked ? lockNote(ceremonySheetRow.value ?? 'This venue') : null}
                  open={opens('venues')}
                  record={record}
                  waiting={venuesWaiting}
                />
                <Row
                  row="reception-venue"
                  label="Reception"
                  value={receptionSheetRow.value}
                  hint={receptionSheetRow.hint}
                  lock={receptionSheetRow.locked ? lockNote(receptionSheetRow.value ?? 'This venue') : null}
                  open={opens('reception-venue')}
                  record={record}
                  waiting={venuesWaiting}
                />
              </>
            ) : (
              <Row fact="venues" label="Venues" value={COULD_NOT_LOAD} />
            )}
          </Section>

          {/* ── Love Story & the special message — the couple's own words ── */}
          <Section k="love-story">
            <Row
              row="love-story"
              fact="love-story"
              label="Love Story"
              value={moments.length > 0 ? `${moments.length} moment${moments.length === 1 ? '' : 's'}` : null}
              open={opens('love-story')}
              record={record}
              waiting={waiting('love_story')}
            />
            <Row
              row="special-message"
              label="Special message"
              value={shownStr('special_message')}
              open={opens('special-message')}
              record={record}
              waiting={waiting('special_message')}
            />
          </Section>

          {/* ── What everyone wears — the Mood Board's own rows ── */}
          <Section k="wears">
            {dress.rows.length === 0 ? (
              <Row row="wears" fact="wears" label="Dress code" value={null} tool={`${base}/studio/mood-board`} />
            ) : (
              dress.rows.slice(0, 8).map((r, i) => (
                <Row
                  key={r.key}
                  row={i === 0 ? 'wears' : undefined}
                  fact={i === 0 ? 'wears' : undefined}
                  label={r.label}
                  tool={`${base}/studio/mood-board`}
                  value={
                    r.lines.length > 0
                      ? r.lines.map((l) => `${l.styleLabel}${l.note ? ` — ${l.note}` : ''}`).join(' · ')
                      : `${r.hexes.length} colour${r.hexes.length === 1 ? '' : 's'}`
                  }
                />
              ))
            )}
          </Section>
        </RecordFold>

        {/* ══ GUESTS & MONEY ══ */}
        <RecordFold group="guests-money" title={groupTitle('guests-money')} summary={summary['guests-money']} recordHref={record}>
          {/* ── Guests — the names are the Guest list's; the numbers are set here ── */}
          <Section k="guests" open={{ href: `${base}/guests`, label: 'Open Guest list' }}>
            <Row
              row="estimate"
              fact="estimate"
              label="Your estimate"
              value={estimate != null && estimate > 0 ? `About ${formatCount(estimate)}` : null}
              lock={bookingLocks && eventWord === 'wedding' ? lockNote('Your guest estimate') : null}
              open={opens('estimate')}
              record={record}
            />
            <Row
              fact="listed"
              label="On your list"
              value={
                guestsHidden
                  ? HIDDEN_BY_THE_COUPLE
                  : stats
                    ? `${formatCount(stats.total)} on your list`
                    : COULD_NOT_LOAD
              }
              hint={stats && stats.plus_ones > 0 ? `${formatCount(stats.total + stats.plus_ones)} expected with their plus-ones` : null}
            />
            <Row row="list-closes" label="Guest list closes" value={sheetDate(str('guest_list_edit_deadline'))} open={opens('list-closes')} record={record} />
            <Row
              row="costs-view"
              label="How you see costs"
              value={str('adaptive_pricing_mode') === 'final_only' ? 'Final only' : 'Realtime'}
              open={opens('costs-view')}
              record={record}
            />
          </Section>

          {/* ── Budget — the Budget page's own four numbers ── */}
          <Section k="budget" open={surfaceEnabled(profile, 'budget') ? { href: `${base}/budget`, label: 'Open Budget' } : null}>
            {moneyHidden ? (
              <Row fact="budget-target" label="Budget" value={HIDDEN_BY_THE_COUPLE} />
            ) : (
              <>
                <Row fact="budget-target" label="Target" value={money ? targetWords : COULD_NOT_LOAD} />
                {money ? (
                  <>
                    <Row label="Agreed" value={formatPhp(money.agreed)} hint={lockedSuppliers.length > 0 ? `with ${lockedSuppliers.length} booked supplier${lockedSuppliers.length === 1 ? '' : 's'}` : null} />
                    <Row label="Paid" value={formatPhp(money.paid)} />
                    <Row label="Still owed" value={formatPhp(money.owed)} />
                  </>
                ) : null}
              </>
            )}
          </Section>

          {/* ── Your suppliers — the locks on the Bench ── */}
          <Section k="suppliers" open={profile.marketplaceEnabled ? { href: `${base}/vendors`, label: 'Open Suppliers' } : null}>
            {suppliersHidden ? (
              <Row label="Suppliers" value={HIDDEN_BY_THE_COUPLE} />
            ) : !vendorsRead.ok ? (
              <Row label="Suppliers" value={COULD_NOT_LOAD} />
            ) : lockedSuppliers.length === 0 ? (
              <Row label="Booked suppliers" value={null} />
            ) : (
              lockedSuppliers.map((s) => (
                <Row
                  key={s.vendor_id}
                  label={planGroupLabelForCategory(s.category)}
                  value={s.vendor_name}
                  lock={lockNote(s.vendor_name ?? 'This supplier')}
                />
              ))
            )}
          </Section>

          {/* ── Services ── */}
          <Section k="services" open={{ href: studioHubHref(eventId), label: 'Open Services' }}>
            <Row fact="services" label="Event Hub Pro" value={proRead.ok ? (ownsPro ? 'Active' : 'Not added') : COULD_NOT_LOAD} />
            <Row label="Setnayan AI" value={e.setnayan_ai_active === true ? 'Active' : 'Not added'} />
            {/* 🙋 PLAN IT MYSELF lives here, in the event's settings (owner 2026-10-06,
                DECISION_LOG "EVENT DETAILS IS REBUILT": it left the Maker). The SAME
                switch and the same one store (`events.planning_mode`, `setPlanningMode`). */}
            <div className="py-2" data-details-plan-myself="">
              <PlanMyselfSwitch eventId={eventId} on={planMyselfOn(typeof e.planning_mode === 'string' ? e.planning_mode : null)} />
            </div>
            <Row
              money
              label="Papic"
              value={
                !poolRead.ok
                  ? COULD_NOT_LOAD
                  : pool.applies
                    ? `${formatCount(pool.remainingPoints)} of ${formatCount(pool.totalPoints)} credits left`
                    : 'Not added'
              }
            />
          </Section>

          {/* ── Purchases — the shipped orders, with their status ── */}
          <Section k="purchases" open={{ href: `${base}/orders`, label: 'Open Purchases' }}>
            {moneyHidden ? (
              <Row fact="purchases" label="Purchases" value={HIDDEN_BY_THE_COUPLE} />
            ) : !orders || vat == null ? (
              <Row fact="purchases" label="Purchases" value={COULD_NOT_LOAD} />
            ) : shownOrders.length === 0 ? (
              <Row fact="purchases" label="Purchases" value={null} />
            ) : (
              <>
                {shownOrders.slice(0, 6).map((o) => (
                  <Row
                    key={o.order_id}
                    label={sheetDate(o.created_at) ?? '—'}
                    value={`${o.description} · ${formatPhp(grossOf(o) ?? 0)}`}
                    hint={ORDER_STATUS_LABEL[o.status]}
                  />
                ))}
                <Row fact="purchases" label="Total paid" value={formatPhp(totalPaid)} hint="Including VAT" />
              </>
            )}
          </Section>
        </RecordFold>

        {/* ══ EVENT ACCESS — its own fold (owner 2026-10-07: *"the Event Access
            is not here: Host: Helper: Vendors"*). People with access, the one
            place access is SET (owner 2026-10-03), grouped Hosts · Helpers ·
            Suppliers. Access is a door, so it changes at once, never on a later
            Apply. ══ */}
        {people || ownAccess ? (
          <RecordFold group="access" title={groupTitle('access')} summary={summary.access} recordHref={record}>
            <PeopleWithAccess
              eventId={eventId}
              rows={people && people.measured ? people.rows : ownAccess ? [ownAccess] : []}
              addable={people && people.measured ? people.addable : []}
              readOnly={!people}
              failed={Boolean(people && !people.measured)}
              flash={accessFlash}
            />
          </RecordFold>
        ) : null}
      </div>

      {/* ── Put this away — last and quiet, as shipped. ── */}
      <div data-section="put-away">
        <PutAwayCard
          eventId={eventId}
          archived={Boolean(e.archived)}
          eventName={typeof e.display_name === 'string' && e.display_name.trim() ? e.display_name : 'this event'}
        />
      </div>
    </section>
    </LastSeenCapture>
  );
}

// ---------------------------------------------------------------------------

type Settled<T> = { ok: true; v: T } | { ok: false };

/** A read that FAILED stays a failure — it is never handed on as an empty answer. */
async function settle<T>(p: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, v: await p };
  } catch (err) {
    console.error('[event-details] read failed', err);
    return { ok: false };
  }
}

function Section({
  k,
  open = null,
  titled = true,
  children,
}: {
  k: EventDetailsSectionKey;
  /**
   * The ONE quiet link — only where another flow owns the part (the guest
   * names, Budget, Suppliers, Services, Purchases). A part the record edits
   * carries none: its rows open their own field.
   */
  open?: { href: string; label: string } | null;
  /** A group with one section needs no heading of its own. */
  titled?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="border-t border-ink/10 pt-3 first:border-t-0 first:pt-0"
      data-section={k}
      // 💾 Money is never kept as last-seen data (lib/last-seen).
      data-money={k === 'budget' || k === 'purchases' ? '' : undefined}
    >
      {titled || open ? (
        <div className="mb-0.5 flex items-baseline justify-between gap-3">
          {titled ? <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/60">{sectionTitle(k)}</h3> : <span />}
          {open ? (
            <Link href={open.href} className="inline-flex min-h-11 shrink-0 items-center gap-0.5 text-[12.5px] text-ink/60 hover:text-ink">
              {open.label}
              <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Link>
          ) : null}
        </div>
      ) : null}
      <div className="divide-y divide-ink/5">{children}</div>
    </div>
  );
}

/**
 * One row: label · value. `value` null = "Not set yet".
 *
 *   · `open` — the row's field address: the whole row opens the Maker's own
 *     editor for that fact (`RecordRowLink`; the field arrives in `@field`).
 *   · `tool` — a fact whose field is a whole studio: the row opens it as itself.
 *   · `lock` — 🔒 and "Locked by your booking" in place (zero JS); a booked fact
 *     never opens a field.
 *   · `waiting` — the draft holds a change guests do not see yet.
 */
function Row({
  row,
  fact,
  label,
  value,
  hint,
  lock,
  money = false,
  open = null,
  tool = null,
  record = '',
  waiting = false,
}: {
  /** The record row (`RECORD_ROW_EDITOR` / `RECORD_ROW_TOOL` key) — what the field sheet scrolls into view. */
  row?: string;
  /** A money figure (a payment, a credit balance) — never kept as last-seen data. */
  money?: boolean;
  /** The MAP fact this row shows (`EVENT_DETAILS_MAP`) — what the guard counts. */
  fact?: string;
  label: string;
  value: ReactNode;
  hint?: string | null;
  lock?: string | null;
  open?: string | null;
  tool?: string | null;
  /** The record with nothing open (where an open row's second tap returns). */
  record?: string;
  waiting?: boolean;
}) {
  const shown =
    value == null || value === '' ? <span className="font-normal text-ink/40">{NOT_SET_YET}</span> : value;
  const body = (
    <>
      <span className="text-sm text-ink/60">{label}</span>
      <span className="min-w-0 flex-1 text-right">
        <span className="text-sm font-medium text-ink/85">{shown}</span>
        {hint ? <span className="block text-[11.5px] text-ink/60">{hint}</span> : null}
        {waiting ? (
          <span className="block text-[11.5px] font-semibold text-ink/60" data-record-waiting="">
            Waiting for Apply
          </span>
        ) : null}
      </span>
    </>
  );
  if (lock) {
    return (
      <details className="group py-2.5" data-fact={fact} data-record-row={row} data-locked data-money={money ? '' : undefined}>
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
          {body}
          <Lock aria-label="Fixed by your booking" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/45" strokeWidth={1.75} />
        </summary>
        <div className="sn-glass-bare mt-2 rounded-xl px-3.5 py-3">
          <p className="text-sm font-medium text-ink">Fixed by your booking</p>
          <p className="mt-1 text-[13px] text-ink/65">{lock}</p>
          <Link href="/help" className="mt-2 inline-block text-[13px] font-medium text-terracotta underline-offset-2 hover:underline">
            Contact support
          </Link>
        </div>
      </details>
    );
  }
  if (open && row) {
    return (
      <div data-fact={fact} data-record-row={row} data-money={money ? '' : undefined}>
        <RecordRowLink row={row} href={open} recordHref={record}>
          {body}
        </RecordRowLink>
      </div>
    );
  }
  if (tool) {
    return (
      <div data-fact={fact} data-record-row={row} data-opens-tool="" data-money={money ? '' : undefined}>
        <Link href={tool} className="sn-press -mx-2 flex min-h-11 items-start justify-between gap-4 rounded-lg px-2 py-2.5 hover:bg-ink/[0.03]">
          {body}
          <ChevronRight aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.75} />
        </Link>
      </div>
    );
  }
  return (
    <div className="flex items-start justify-between gap-4 py-2.5" data-fact={fact} data-record-row={row} data-money={money ? '' : undefined}>
      {body}
    </div>
  );
}
