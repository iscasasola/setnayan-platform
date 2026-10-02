import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
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
import { formatCount } from '@/lib/format-number';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { readEventPoolStatus } from '@/lib/papic-event-pool';
import { INVITE_THEMES, resolveInviteTheme } from '@/lib/invite-themes';
import { HUB_FONT_BY_KEY, sanitizeHubFontKey } from '@/lib/hub-fonts';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { resolveDisplayPalette } from '@/lib/room-palette';
import { sanitizeRoleAttire } from '@/lib/role-dress-code';
import { sanitizeGroupAttire } from '@/lib/role-group-dress-code';
import { dressCodeForEveryone } from '@/lib/dress-code-for-everyone';
import { roleLabel } from '@/lib/entourage';
import { resolveMoments } from '@/lib/love-story-moments';
import { resolveReplyBy } from '@/lib/rsvp-ask';
import { detailsItemHref } from '@/lib/maker-details-items';
import { studioHubHref } from '@/lib/studio-hub';
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
import { PutAwayCard } from './_components/put-away-card';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Event Details' };

/**
 * Event Details · /dashboard/[eventId]/details
 *
 * 📋 ONE INFORMATION-ONLY SHEET OF EVERYTHING COLLECTED (owner 2026-10-01,
 * DECISION_LOG "EVENT DETAILS LIVES ON EVENT HOME" → "EVENT DETAILS IS
 * INFORMATION ONLY"; design `event_details_one_page_2026-10-01_fable`). It
 * replaces the shipped Personalization page, whose editors moved WHOLE to
 * `/details/change` ("Event settings") and from there (owner 2026-10-02,
 * "EVERY ANSWER … LIVES IN EVENT DETAILS") into the Maker's Your info › Event
 * settings — one place to change every fact; the old address forwards
 * (`lib/legacy-redirects.ts`).
 *
 *   · SHOWS, NEVER EDITS. Each section carries one quiet "Open … ›" to the page
 *     that handles it — the deliberate exception to "no edit-elsewhere links",
 *     because this page is a read-out. No suggestions, no tips, no next steps.
 *   · EVERY ROW READS ITS APP'S OWN FIELD (the Maker, the Guest list, Budget,
 *     the Schedule, the Bench's locks, the orders) — no copy, no sync — so the
 *     sheet and the app cannot disagree. `lib/event-details-sheet.ts` holds THE
 *     MAP; `event-details-sheet.test.ts` holds this page to it.
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
export default async function EventDetailsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

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
        'site_font_key, site_bg_music_r2_key, site_bg_music_enabled, landing_page_hero_image_url, ' +
        'setnayan_ai_active, rsvp_ask_config, love_story, dress_code_config, ' +
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

  const [vendorsRead, scheduleRead, upcomingRead, guestsRead, ordersRead, vatRead, privateRead, moneyRead, snapshotRead, proRead, poolRead] =
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
    ]);

  // ── Suppliers + venues: the confirmed bookings, one read ───────────────────
  const confirmed = new Set<string>(CONFIRMED_VENDOR_STATUSES as readonly string[]);
  const lockedSuppliers = vendorsRead.ok
    ? vendorsRead.v.filter((r) => r.status != null && confirmed.has(r.status) && (r.vendor_name ?? '').trim())
    : [];
  // The governed facts (kind · date · guest estimate) lock to support once any
  // supplier is confirmed — the same rule `GovernedFields` enforces.
  const bookingLocks = lockedSuppliers.length > 0;
  const venuesWon = vendorsRead.ok ? pickVenueBookingRows(vendorsRead.v) : { ceremony: null, reception: null };

  // ── The look ──────────────────────────────────────────────────────────────
  const ownsPro = proRead.ok && proRead.v === true;
  const theme = INVITE_THEMES[resolveInviteTheme({ saved: e.invite_theme, ownsPro })];
  const headingFontKey = sanitizeHubFontKey(e.site_font_key);
  const storedPalette = sanitizeRolePalette(e.role_palette);
  const board = resolveDisplayPalette(storedPalette);
  const mainColours = (board.reception ?? []).filter((h) => typeof h === 'string' && h.length > 0);
  const dress = dressCodeForEveryone({
    stored: storedPalette,
    board,
    roles: sanitizeRoleAttire((e.dress_code_config as { roles?: unknown } | null)?.roles, (v) => roleLabel(v as GuestRole) !== null),
    groups: sanitizeGroupAttire((e.dress_code_config as { groups?: unknown } | null)?.groups),
    ceremonyType: str('ceremony_type'),
  });
  const moments = resolveMoments(e.love_story).filter((m) => !m.hidden);
  const getIn = howGuestsGetIn(e.rsvp_ask_config);
  const questions = rsvpQuestions(e.rsvp_ask_config);
  const replyBy = resolveReplyBy({ deadline: str('guest_list_edit_deadline'), eventDate: str('event_date') });

  // ── Names ─────────────────────────────────────────────────────────────────
  const personA = str('bride_name');
  const personB = str('groom_name');
  const names = personA && personB ? `${personA} & ${personB}` : (personA ?? personB ?? str('display_name'));
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

  // ── Guests ────────────────────────────────────────────────────────────────
  const stats = guestsRead && guestsRead.ok && guestsRead.v.measured ? computeGuestStats(guestsRead.v.rows) : null;
  const estimate = num('estimated_pax');

  // ── Venues: LOCKED only (the Event Hub reads the same) ────────────────────
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
  const ceremonySheetRow = venueRow('ceremony', venuesWon.ceremony, str('std_film_ceremony_name'), str('ceremony_venue_setting'));
  const receptionSheetRow = venueRow(
    'reception',
    venuesWon.reception,
    str('venue_name') ?? str('std_film_venue_name'),
    str('venue_setting'),
  );

  // ── Services ──────────────────────────────────────────────────────────────
  const pool = poolRead.status;

  const lockNote = (what: string) =>
    `${what} is held by your booking — changing it would change what you booked, so we hold it still. If something has changed, tell us and we will sort it out with your supplier.`;

  return (
    <section className="sn-col space-y-4" data-event-details>
      <PageMasthead title="Event Details" />
      <header className="space-y-1">
        <h2 className="font-display text-[26px] leading-tight text-ink">Event Details</h2>
        <p className="text-sm text-ink/60">
          {names ? `${names} · ` : ''}
          {titleCase(eventWord)}
        </p>
        <p className="text-[13px] text-ink/55">Everything about your event, in one place. Change anything in its own app and it updates here.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {/* ── The basics ── */}
        <Section k="basics" open={maker ? { href: detailsItemHref(eventId, 'settings'), label: 'Open in Your info' } : null}>
          <Row fact="names" label="Names" value={names} />
          <Row
            fact="kind"
            label={`Kind of ${eventWord}`}
            value={kind}
            lock={bookingLocks && eventWord === 'wedding' ? lockNote(`Your kind of ${eventWord}`) : null}
          />
          <Row fact="area" label="Area" value={str('region')} />
          <Row label="Event Hub address" value={str('slug') ? `setnayan.com/${str('slug')}` : null} />
        </Section>

        {/* ── Key dates — one dated list, soonest first ── */}
        <Section k="key-dates" open={{ href: `${base}/schedule`, label: 'Open Schedule' }}>
          {paymentsFailed ? (
            <Row label="Supplier payments" value={COULD_NOT_LOAD} />
          ) : suppliersHidden ? (
            <Row label="Supplier payments" value={HIDDEN_BY_THE_COUPLE} />
          ) : (
            payments.map((p) => (
              <Row
                key={p.id}
                label={sheetDate(p.date.toISOString(), false) ?? '—'}
                value={`${p.vendorBusinessName ?? p.subtitle} · ${p.title}${p.amountCentavos != null ? ` ${formatPhp(p.amountCentavos / 100)}` : ''}`}
                hint="Supplier payment"
              />
            ))
          )}
          <Row
            fact="reply-by"
            label="Guests reply by"
            value={replyBy ? sheetDate(replyBy.date) : null}
            hint={replyBy?.isDefault ? 'Suggested — 30 days before the day. The guest list closes the same day.' : replyBy ? 'The guest list closes the same day.' : null}
          />
          <Row
            fact="date"
            label={`The ${eventWord}`}
            value={describeEventDate(e)}
            lock={bookingLocks ? lockNote(`Your ${eventWord} date`) : null}
          />
          {scheduleRead.ok ? (
            <>
              <Row fact="arrive" label="Guests arrive" value={arrive ? blockTime(arrive) : null} />
              <Row label="Ceremony" value={ceremony ? blockTime(ceremony) : null} />
              <Row label="Reception" value={reception ? blockTime(reception) : null} />
            </>
          ) : (
            <Row fact="arrive" label="Times on the day" value={COULD_NOT_LOAD} />
          )}
        </Section>

        {/* ── Venues — locked only ── */}
        <Section
          k="venues"
          open={maker ? { href: detailsItemHref(eventId, 'venues'), label: 'Open in the Event Hub Maker' } : null}
        >
          {vendorsRead.ok ? (
            <>
              <Row
                fact="venues"
                label={eventWord === 'wedding' ? 'Ceremony' : 'Ceremony venue'}
                value={ceremonySheetRow.value}
                hint={ceremonySheetRow.hint}
                lock={ceremonySheetRow.locked ? lockNote(ceremonySheetRow.value ?? 'This venue') : null}
              />
              <Row
                label="Reception"
                value={receptionSheetRow.value}
                hint={receptionSheetRow.hint}
                lock={receptionSheetRow.locked ? lockNote(receptionSheetRow.value ?? 'This venue') : null}
              />
            </>
          ) : (
            <Row fact="venues" label="Venues" value={COULD_NOT_LOAD} />
          )}
        </Section>

        {/* ── Guests ── */}
        <Section k="guests" open={{ href: `${base}/guests`, label: 'Open Guest list' }}>
          <Row
            fact="estimate"
            label="Your estimate"
            value={estimate != null && estimate > 0 ? `About ${formatCount(estimate)}` : null}
            hint="From onboarding"
            lock={bookingLocks && eventWord === 'wedding' ? lockNote('Your guest estimate') : null}
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
          <Row fact="guests-get-in" label="How guests get in" value={getIn.value} hint={getIn.chosen ? null : 'The default — not chosen yet'} />
          <Row label="Guest list closes" value={sheetDate(str('guest_list_edit_deadline'))} />
          <Row label="How you see costs" value={str('adaptive_pricing_mode') === 'final_only' ? 'Final only' : 'Realtime'} />
        </Section>

        {/* ── Budget — the Budget page's own four numbers ── */}
        <Section k="budget" open={surfaceEnabled(profile, 'budget') ? { href: `${base}/budget`, label: 'Open Budget' } : null}>
          {moneyHidden ? (
            <Row fact="budget-target" label="Budget" value={HIDDEN_BY_THE_COUPLE} />
          ) : (
            <>
              <Row
                fact="budget-target"
                label="Target"
                value={
                  money
                    ? [budgetBand, money.target != null && money.target > 0 ? `about ${formatPhpRounded(money.target)}` : null].filter(Boolean).join(' · ') || null
                    : COULD_NOT_LOAD
                }
              />
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
          <Row
            label="Papic"
            value={
              !poolRead.ok
                ? COULD_NOT_LOAD
                : pool.applies
                  ? `${formatCount(pool.remainingPoints)} of ${formatCount(pool.totalPoints)} credits left`
                  : 'Not added'
            }
          />
          {/* 🗂 The onboarding's answers (owner 2026-10-02) — changed in Your info, obeyed everywhere. */}
          {setupOfType.cameraDefault !== 'off' ? (
            <Row fact="papic-answer" label={papicLabel(words.solemn)} value={answerSub(papicChoices(), answerKeyOf('papic_on', e.papic_on))} />
          ) : null}
          {setupOfType.giftsMode !== 'none' ? (
            <Row fact="gifts-answer" label={giftsLabel(setupOfType.giftsMode)} value={answerSub(giftsChoices(), answerKeyOf('gifts_on', e.gifts_on))} />
          ) : null}
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

        {/* ── Your Event Hub look ── */}
        <Section k="look" open={maker ? { href: detailsItemHref(eventId, 'theme'), label: 'Open in the Event Hub Maker' } : null}>
          <Row fact="cover" label="Cover photo" value={str('landing_page_hero_image_url') ? 'Added' : null} />
          <Row label="Logo / monogram" value={str('monogram_text')} />
          <Row fact="logo-answer" label={LOGO_QUESTION} value={answerSub(logoChoices(words.twoPeople), answerKeyOf('logo_wanted', e.logo_wanted)) || null} />
          <Row fact="cover-answer" label={coverQuestion(words.solemn)} value={answerSub(coverChoices(words.solemn), answerKeyOf('cover_photo_wanted', e.cover_photo_wanted)) || null} />
          <Row fact="theme" label="Theme" value={proRead.ok ? theme.name : COULD_NOT_LOAD} />
          <Row
            fact="colours"
            label="Colours"
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
          <Row
            fact="fonts"
            label="Fonts"
            value={`Header ${headingFontKey ? HUB_FONT_BY_KEY[headingFontKey].family : theme.fonts.heading} · Text ${theme.fonts.body} · Accent ${theme.fonts.script}`}
          />
          <Row
            fact="music"
            label="Music"
            value={str('site_bg_music_r2_key') ? (e.site_bg_music_enabled === false ? 'Added · switched off' : 'Added · plays on open') : null}
          />
        </Section>

        {/* ── Love Story ── */}
        <Section k="love-story" open={maker ? { href: `${base}/website/our-story`, label: 'Open Love Story' } : null}>
          <Row fact="love-story" label="Moments" value={moments.length > 0 ? `${moments.length} moment${moments.length === 1 ? '' : 's'}` : null} />
        </Section>

        {/* ── What everyone wears — the Mood Board's own rows ── */}
        <Section k="wears" open={{ href: `${base}/studio/mood-board`, label: 'Open Mood Board' }}>
          {dress.rows.length === 0 ? (
            <Row fact="wears" label="Dress code" value={null} />
          ) : (
            dress.rows.slice(0, 8).map((r, i) => (
              <Row
                key={r.key}
                fact={i === 0 ? 'wears' : undefined}
                label={r.label}
                value={
                  r.lines.length > 0
                    ? r.lines.map((l) => `${l.styleLabel}${l.note ? ` — ${l.note}` : ''}`).join(' · ')
                    : `${r.hexes.length} colour${r.hexes.length === 1 ? '' : 's'}`
                }
              />
            ))
          )}
        </Section>

        {/* ── RSVP ── */}
        <Section k="rsvp" open={maker ? { href: detailsItemHref(eventId, 'rsvp'), label: 'Open RSVP' } : null}>
          <Row
            fact="rsvp-questions"
            label="Questions"
            value={questions.length > 0 ? `${questions.length} · ${questions.join(' · ')}` : 'No reply needed'}
          />
          <Row label="Reply by" value={replyBy ? sheetDate(replyBy.date) : null} />
          <Row label="Who can reply" value={getIn.value} hint="Same as “How guests get in”" />
        </Section>
      </div>

      {/* ── Put this away — last and quiet, as shipped. ── */}
      <div data-section="put-away">
        <PutAwayCard
          eventId={eventId}
          archived={Boolean(e.archived)}
          eventName={typeof e.display_name === 'string' && e.display_name.trim() ? e.display_name : 'this celebration'}
        />
      </div>
    </section>
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
  open,
  children,
}: {
  k: EventDetailsSectionKey;
  /** The ONE quiet link to the page that handles this part (null = none for this kind of event). */
  open: { href: string; label: string } | null;
  children: ReactNode;
}) {
  return (
    <div className="sn-tile p-4 sm:p-5" data-section={k}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="m-display-tight text-base uppercase tracking-[0.02em] text-ink">{sectionTitle(k)}</h3>
        {open ? (
          <Link href={open.href} className="inline-flex shrink-0 items-center gap-0.5 text-[12.5px] text-ink/55 hover:text-ink">
            {open.label}
            <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Link>
        ) : null}
      </div>
      <dl className="divide-y divide-ink/5">{children}</dl>
    </div>
  );
}

/**
 * One read-out row: label · value. `value` null = "Not set yet". A row with
 * `lock` carries 🔒 and opens "Locked by your booking" in place (zero JS).
 */
function Row({
  fact,
  label,
  value,
  hint,
  lock,
}: {
  /** The MAP fact this row shows (`EVENT_DETAILS_MAP`) — what the guard counts. */
  fact?: string;
  label: string;
  value: ReactNode;
  hint?: string | null;
  lock?: string | null;
}) {
  const shown =
    value == null || value === '' ? <span className="font-normal text-ink/40">{NOT_SET_YET}</span> : value;
  const body = (
    <>
      <dt className="text-sm text-ink/60">{label}</dt>
      <dd className="min-w-0 text-right">
        <span className="text-sm font-medium text-ink/85">{shown}</span>
        {hint ? <span className="block text-[11.5px] text-ink/50">{hint}</span> : null}
      </dd>
    </>
  );
  if (!lock) {
    return (
      <div className="flex items-start justify-between gap-4 py-2.5" data-fact={fact}>
        {body}
      </div>
    );
  }
  return (
    <details className="group py-2.5" data-fact={fact} data-locked>
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
