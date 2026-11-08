import type { ReactNode } from 'react';
import Link from 'next/link';
import { viewerIsInternal } from '@/lib/view-as-free.server';
import { EVENT_DATE_FLOOR_MESSAGE } from '@/lib/event-date-floor';
import { BOOKINGS_CLOSED_SUPPLIER_MESSAGE, BOOKINGS_OPEN_SOON } from '@/lib/bookings-open';
import { areBookingsOpen } from '@/lib/bookings-open.server';
import { isMarketplaceVendorBookable, LOCKED_QR_NEEDS_VERIFIED } from '@/lib/vendor-verification';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { renderUrlQrSvg } from '@/lib/qr';
import { vendorCoverageCategories } from '@/lib/vendor-couple-invite';
import { buildVendorLockUrl, sanitizeLockQuoteLines, sanitizeLockSchedule } from '@/lib/vendor-locked-qr';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { VENDOR_CATEGORY_LABEL } from '@/lib/vendors';
import { formatPhp } from '@/lib/orders';
import { fetchVendorServices } from '@/lib/vendor-services';
import { fetchVendorContracts } from '@/lib/contracts';
import { cardKindLabeller } from '@/lib/card-kind-labeller';
import { rangeWords } from '@/lib/vendor-dates';
import { manilaTodayIso } from '@/lib/vendor-cashflow';
import { siteOrigin } from '@/lib/site-origin';
import { fetchVendorRoomEvents } from '@/lib/vendor-room-access';
import { hubDayWords, hubHref } from '@/lib/hub-events';
import { crewJoinPath } from '@/lib/crew-pass';
import { canManageVendor, resolveVendorRole } from '@/lib/vendor-role';
import { CUSTOMERS_QR_MODES, PROMOTE_HREF, crewQrEvents, isPromoteQrMode, pickCrewQrEvent, supplierQrModeOf } from '@/lib/supplier-qr-codes';
import { LockedQrGenerator, type LockedQrInitial } from './_components/locked-qr-generator';
import { customerCardHref } from '@/lib/upcoming-schedule-door';
import { QrCodes, type CrewQr, type IssuedRow } from './_components/qr-codes';

export const metadata = { title: 'QR codes · Supplier' };
export const dynamic = 'force-dynamic';

/**
 * QR CODES — the shop's two codes on ONE page (S-PR3; plan § 2 "`/invite` + `/locked-qr` — Merge: one 'QR codes'
 * (Shortlist · Booked — one dropdown), ledger inside"; prototype frames 10 · 40; kind 24 QR card).
 *
 *   • Shortlist · free — stateless slug invite; a scan imports the shop onto the couple's shortlist under the picked
 *     event type + service.
 *   • Booked · one-use — the shipped Locked QR: a single-use code that carries the deal (total + first payment +
 *     schedule + proof); a scan locks the booking, freezes the plan and records the first payment
 *     (`vendor_claim_locked_qr()`). Its ledger — every code issued, claimed / pending / void — is the Issued fold
 *     (it was `/locked-qr`, which now forwards here with the fold open).
 *
 * 📣 MOVED 2026-11-05 (owner: the marketing codes belong in Shop, not Customers): Shortlist · free, Check a date · free
 * and My page now live in Shop › Promote (`shop/promote/page.tsx`). Any `?mode=` for one of them — and a bare
 * `/vendor-dashboard/invite`, which always meant the Shortlist code — forwards there with its picks, so an old link or
 * bookmark still lands on its code. Crew for an event stays here (its code is made in Hub › Crew).
 *
 * Reached from Customers › Dates (the QR codes row); back goes there.
 */
const BOOKED_ERRORS: Record<string, string> = {
  category: 'Pick at least one service you actually offer.',
  total: 'Set a total value greater than ₱0.',
  downpayment: 'Record the first payment you received.',
  overpaid: 'The first payment can’t be more than the total value.',
  proof: 'Upload the payment proof before making the code.',
  contract: 'Pick one of your saved contracts to attach.',
  description: 'Describe what the couple availed.',
  event_date: 'Set the agreed event date.',
  event_date_before_first_event: EVENT_DATE_FLOOR_MESSAGE,
  bookings_closed: BOOKINGS_CLOSED_SUPPLIER_MESSAGE,
  not_verified: LOCKED_QR_NEEDS_VERIFIED,
  replaced_claimed:
    'The code you were changing was scanned a moment ago — it is a booking now, so it stays as it was. Nothing new was made.',
  date_unavailable:
    'That date is already booked or blocked on your calendar — you can’t lock a second booking on it. Free it up first, or use the waitlist.',
};

type TokenRow = {
  token: string;
  public_id: string;
  category: string;
  total_php: number | string | null;
  initial_paid_php: number | string | null;
  status: 'pending' | 'claimed' | 'void';
  created_at: string;
  claimed_at: string | null;
  claimed_event_id: string | null;
  service_description: string | null;
  event_date: string | null;
  voided_at: string | null;
  client_name: string | null;
};

const DATES_HREF = '/vendor-dashboard/customers?seg=dates';

type EditTokenRow = {
  token: string;
  client_name: string | null;
  event_type: string | null;
  event_date: string | null;
  service_description: string | null;
  vendor_service_ids: unknown;
  source_contract_id: string | null;
  total_php: number | string | null;
  initial_paid_php: number | string | null;
  schedule_json: unknown;
  quote_line_items: unknown;
  proof_r2_key: string | null;
  remembrance_r2_key: string | null;
};

/** #34: a waiting code, as the generator's filled-in form (void + reissue on save). Null when there is none to change. */
function lockedQrInitialOf(t: EditTokenRow | null): LockedQrInitial | null {
  if (!t) return null;
  const peso = (v: number | string | null) => (v == null ? '' : String(Number(v)));
  return {
    replaces: t.token,
    clientName: t.client_name ?? '',
    eventType: t.event_type ?? '',
    eventDate: t.event_date ?? '',
    description: t.service_description ?? '',
    serviceRefs: Array.isArray(t.vendor_service_ids) ? t.vendor_service_ids.map(String) : [],
    contractId: t.source_contract_id ?? '',
    total: peso(t.total_php),
    initialPaid: peso(t.initial_paid_php),
    schedule: sanitizeLockSchedule(t.schedule_json).map((r) => ({ label: r.label, amount: String(r.amount_value), date: r.due_date ?? '' })),
    lines: sanitizeLockQuoteLines(t.quote_line_items),
    proofRef: t.proof_r2_key ?? '',
    remembranceRef: t.remembrance_r2_key ?? '',
  };
}
const QR_HREF = '/vendor-dashboard/invite';

export default async function VendorQrCodesPage({
  searchParams,
}: {
  searchParams: Promise<{ et?: string; cat?: string; mode?: string; issued?: string; error?: string; ledger?: string; date?: string; block?: string; event?: string; open?: string; edit?: string }>;
}) {
  const search = await searchParams;
  const asked = supplierQrModeOf(search.mode);
  // 📣 The three marketing codes live in Shop › Promote now — forward with the picks a Shortlist link carried.
  if (isPromoteQrMode(asked)) {
    const q = new URLSearchParams({ mode: asked });
    if (search.et) q.set('et', search.et);
    if (search.cat) q.set('cat', search.cat);
    redirect(`${PROMOTE_HREF}?${q.toString()}`);
  }
  const mode = asked;
  // The outside booking a code is being made for (Customers › People). Shape only — the database refuses one that is
  // not this shop's own outside booking.
  const blockId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search.block ?? '') ? (search.block as string) : null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const slug = (profile as { business_slug?: string | null }).business_slug ?? null;
  // ── A DEAD END, REMOVED 2026-08-09 ─────────────────────────────────────────
  // This used to be `Boolean(slug && is_published)`, and the refusal it rendered
  // read "Publish your business profile first". THERE IS NO SUCH BUTTON: the
  // only `name="is_published"` control in the entire app is on the ADMIN vendor
  // edit page, and the one vendor-side action that ever wrote the column
  // (`saveVendorProfile`) had no caller from the My Shop inline-edit rewrite
  // until it was deleted outright, later the same day as this fix — it wrote the
  // column from an absent checkbox, so any form wired to it would have
  // UNPUBLISHED the shop (`lib/vendor-publish-guard.test.ts` now forbids the
  // shape). Approving a shop doesn't set it either — /admin/verify writes
  // public_visibility + verification_state and never touches this column. So the
  // screen asked the vendor to press something that does not exist for them, and
  // the owner's own fully-verified shop sits at is_published = false today and
  // would have hit exactly this wall.
  //
  // The twin of this QR on My Customers gates on `slug` ALONE and has all along
  // — same generator, same output, one door open and its twin bolted. `slug` is
  // the honest requirement: the QR encodes the shop's public address, and that
  // address is minted by a database trigger the moment a shop is named, so any
  // shop that finished /open-shop has one.
  //
  // Owner rule this restores (2026-08-09): bringing in the customers you already
  // have is FREE and works BEFORE approval. Gating it on an admin-only flag made
  // it wait for approval, which is the opposite.
  const canShare = Boolean(slug);
  const vendorProfileId = (profile as { vendor_profile_id: string }).vendor_profile_id;
  const today = manilaTodayIso();
  // The shop's coverage words ride on the profile already read — no second read of the same row.
  const profileServices = ((profile as { services?: string[] | null }).services ?? []) as string[];
  const kindLabel = await cardKindLabeller();
  // 🔳 ONE "Which code ▾" (owner 2026-10-29 "THE QR DROPDOWN ALREADY EXISTS; EXTEND IT"): since 2026-11-05 this home
  // holds Booked · one-use and Crew for an event; the marketing codes are Shop › Promote's — the split and the words
  // live in `lib/supplier-qr-codes.ts`.
  // 🔳 OPTION B (owner 2026-11-06, *"B"*): Booked and Crew are two ROWS here, in the Promote list's design. This visit
  // reads ONE of them (`mode`); the other row goes to its own address, where its sheet opens (`&open=1`). A link that
  // names something to show — an issued code, a refusal, the ledger, a day, an outside booking, an event — opens the
  // sheet on arrival; a plain visit lands on the list.
  const hrefs = Object.fromEntries(CUSTOMERS_QR_MODES.map((key) => [key, `${QR_HREF}?mode=${key}&open=1`]));
  const open = search.open === '1' || Boolean(search.issued || search.error || search.ledger || search.date || search.block || search.event || search.edit) ? mode : null;

  if (!canShare) {
    return <QrCodes backHref={DATES_HREF} canShare={false} setupHref="/vendor-dashboard/shop" shortlist={null} booked={null} />;
  }

  if (mode === 'crew') {
    return (
      <QrCodes
        open={open}
        hrefs={hrefs}
        backHref={DATES_HREF}
        canShare
        setupHref="/vendor-dashboard/shop"
        shortlist={null}
        booked={null}
        crew={await readCrewQr(supabase, user.id, vendorProfileId, today, search.event ?? null)}
      />
    );
  }

  // ── BOOKED · ONE-USE ──────────────────────────────────────────────────────
  const [ledgerRead, issuedRead] = await Promise.all([
    supabase
      .from('vendor_locked_qr_tokens')
      .select('token, public_id, category, total_php, initial_paid_php, status, created_at, claimed_at, claimed_event_id, service_description, event_date, voided_at, client_name')
      .eq('vendor_profile_id', vendorProfileId)
      .order('created_at', { ascending: false }),
    search.issued
      ? supabase
          .from('vendor_locked_qr_tokens')
          .select('token, category, total_php, initial_paid_php, status, claimed_at')
          .eq('token', search.issued)
          .eq('vendor_profile_id', vendorProfileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  // ⚠ EVERY CODE THIS SHOP HAS ISSUED, each one a customer who already paid a first payment. Refused, the Issued fold
  // ⚠ says so — never "none", which reads as "issue a second one for the same booking".
  if (ledgerRead.error) logQueryError('VendorQrCodesPage.ledger', ledgerRead.error, { vendorProfileId }, 'graceful_degrade');
  if (issuedRead.error) logQueryError('VendorQrCodesPage.issued', issuedRead.error, { vendorProfileId }, 'graceful_degrade');
  const ledgerMeasured = !ledgerRead.error && ledgerRead.data !== null;
  const day = (iso: string | null) => (iso ? rangeWords(iso.slice(0, 10), iso.slice(0, 10), today) : '—');
  const ledger: IssuedRow[] | null = ledgerMeasured
    ? ((ledgerRead.data ?? []) as TokenRow[]).map((t) => {
        const total = t.total_php != null ? Number(t.total_php) : null;
        return {
          token: t.token,
          // 👤 B2-E: who the code is for first ("Ana & Ben"); then #34's deal words ("Full-day coverage"); its kind when it
          // has neither (older codes).
          title: t.client_name?.trim() || t.service_description?.trim() || kindLabel(t.category),
          line: [
            t.client_name?.trim() ? t.service_description?.trim() || kindLabel(t.category) : null,
            t.event_date ? day(t.event_date) : null,
            total != null ? formatPhp(total) : 'No total',
            `${formatPhp(Number(t.initial_paid_php ?? 0))} paid`,
            t.status === 'claimed' ? `used ${day(t.claimed_at)}` : t.status === 'void' ? `deleted ${day(t.voided_at)}` : `made ${day(t.created_at)}`,
          ]
            .filter(Boolean)
            .join(' · '),
          status: t.status,
          showHref: t.status === 'pending' ? `${QR_HREF}?mode=locked&issued=${t.token}` : null,
          // #34 the row's door: a WAITING code opens to be changed (void + reissue); a USED one opens that client (#38:
          // a used Booked QR → Details); a deleted one opens nothing.
          openHref:
            t.status === 'pending'
              ? `${QR_HREF}?mode=locked&edit=${t.token}`
              : t.status === 'claimed' && t.claimed_event_id
                ? customerCardHref(t.claimed_event_id, 'details')
                : null,
        };
      })
    : null;

  const tok = issuedRead.data as { token: string; category: string; total_php: number | string | null; initial_paid_php: number | string | null; status: TokenRow['status']; claimed_at: string | null } | null;
  let issued = null as null | { url: string; svg: string | null; title: string; line: string; used: boolean; stamp?: string };
  if (tok) {
    const url = buildVendorLockUrl(tok.token);
    issued = {
      url,
      svg: await renderUrlQrSvg(url, 220).catch(() => null),
      title: `${kindLabel(tok.category)}${tok.total_php ? ` · ${formatPhp(Number(tok.total_php))}` : ''}`,
      line: `${tok.initial_paid_php ? `${formatPhp(Number(tok.initial_paid_php))} paid · ` : ''}one use — give it to that one customer`,
      used: tok.status !== 'pending',
      stamp: tok.status === 'claimed' ? `Used · ${day(tok.claimed_at)}` : tok.status === 'void' ? 'Void' : undefined,
    };
  }

  // The deal form's choices: the shop's own live services (a coverage fallback when none are published) + contracts.
  let generator: ReactNode = null;
  // 🚪 BOOKINGS CLOSED (owner 2026-11-02): no deal form while closed — one quiet line where it was.
  const bookingsOpen = !issued ? await areBookingsOpen() : true;
  // ✅ An unverified shop is told BEFORE it fills the deal form (audit G8) — the code could only fail at the scan.
  const verified = !issued && bookingsOpen ? await isMarketplaceVendorBookable(supabase, vendorProfileId) : true;
  if (!issued && !bookingsOpen) {
    generator = (
      <p className="text-sm text-ink/70">
        <span className="font-semibold text-ink">{BOOKINGS_OPEN_SOON}.</span> {BOOKINGS_CLOSED_SUPPLIER_MESSAGE}
      </p>
    );
  } else if (!issued && !verified) {
    generator = (
      <p className="text-sm text-ink/70" data-locked-qr-needs-verified="">
        {LOCKED_QR_NEEDS_VERIFIED}{' '}
        <Link href="/vendor-dashboard/profile#docs" className="font-semibold text-ink underline underline-offset-2">
          Your documents
        </Link>
      </p>
    );
  } else if (!issued) {
    const [eventTypes, services, contracts, editRead] = await Promise.all([
      getCreatableEventTypes(),
      fetchVendorServices(supabase, vendorProfileId).catch(() => []),
      fetchVendorContracts(supabase, vendorProfileId).catch(() => []),
      // ✏ #34 CHANGE A WAITING CODE: everything it said, to fill the form in. Only this shop's, only while it waits.
      search.edit
        ? supabase
            .from('vendor_locked_qr_tokens')
            .select('token, client_name, event_type, event_date, service_description, vendor_service_ids, source_contract_id, total_php, initial_paid_php, schedule_json, quote_line_items, proof_r2_key, remembrance_r2_key')
            .eq('token', search.edit)
            .eq('vendor_profile_id', vendorProfileId)
            .eq('status', 'pending')
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (editRead.error) logQueryError('VendorQrCodesPage.edit', editRead.error, { vendorProfileId }, 'graceful_degrade');
    const initial = lockedQrInitialOf(editRead.data as EditTokenRow | null);
    const coverage = vendorCoverageCategories(profileServices);
    const live = services.filter((s) => s.is_active);
    generator = (
      <LockedQrGenerator
        dateExempt={await viewerIsInternal().catch(() => false)}
        eventTypes={eventTypes.map((t) => ({ value: t.key, label: t.label }))}
        services={
          live.length
            ? live.map((s) => ({ value: s.vendor_service_id, label: s.title ?? kindLabel(s.category) }))
            : coverage.map((c) => ({ value: c as string, label: VENDOR_CATEGORY_LABEL[c] ?? kindLabel(c as string) }))
        }
        contracts={contracts.filter((c) => c.status !== 'cancelled').map((c) => ({ value: c.contract_id, label: c.title }))}
        // Dates › a day › "Show a QR" opens here with that day filled (2026-10-14).
        initialDate={/^\d{4}-\d{2}-\d{2}$/.test(search.date ?? '') ? (search.date as string) : ''}
        // Customers › People › an outside booking › "Send their code" (owner 2026-10-28): the code names that booking.
        blockId={blockId}
        initial={initial}
        servicePrices={Object.fromEntries(live.map((s) => [s.vendor_service_id, s.starting_price_php ?? null]))}
      />
    );
  }

  return (
    <QrCodes
      open={open}
      hrefs={hrefs}
      // Came from an outside booking's "Send their code" → back to that customer's row, open (Customers › People).
      backHref={blockId ? `/vendor-dashboard/customers?block=${blockId}#outside` : DATES_HREF}
      canShare
      setupHref="/vendor-dashboard/shop"
      shortlist={null}
      booked={{
        issued,
        error: search.error ? (BOOKED_ERRORS[search.error] ?? 'Could not make the code. Please try again.') : null,
        generator,
        ledger,
        ledgerOpen: search.ledger === '1',
        newHref: `${QR_HREF}?mode=locked`,
      }}
    />
  );
}

/**
 * 📱 CREW FOR AN EVENT — the picked event's ONE crew code, read under the caller's own session (the table's RLS lets
 * only the shop's owner and admins read it, exactly as Hub › Crew). Making, replacing and allowing stay in Hub › Crew;
 * this only shows the code. Every refusal is said: the events list, the code and the waiting count each fail on their
 * own and none of them reads as "none".
 */
async function readCrewQr(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  vendorProfileId: string,
  today: string,
  asked: string | null,
): Promise<CrewQr> {
  const days = await fetchVendorRoomEvents(supabase, vendorProfileId).catch((e: unknown) => {
    logQueryError('VendorQrCodesPage.crewEvents', { message: e instanceof Error ? e.message : String(e) }, { vendorProfileId }, 'graceful_degrade');
    return null;
  });
  if (days === null) return { eventPick: null, eventName: null, code: null, hubHref: null };
  const events = crewQrEvents(days, today, (iso) => hubDayWords(iso));
  const picked = pickCrewQrEvent(events, asked);
  const eventPick = {
    value: picked?.eventId ?? '',
    options: events.map((e) => ({ key: e.eventId, label: e.label, href: `${QR_HREF}?mode=crew&event=${encodeURIComponent(e.eventId)}` })),
  };
  if (!picked) return { eventPick, eventName: null, code: null, hubHref: null };
  const eventName = days.find((d) => d.eventId === picked.eventId)?.eventName?.trim() || null;
  const hub = hubHref(picked.eventId, 'crew');
  if (!canManageVendor(await resolveVendorRole(supabase, userId).catch(() => null))) {
    return { eventPick, eventName, code: { state: 'not-admin' }, hubHref: hub };
  }
  const [codeRes, waitRes] = await Promise.all([
    supabase.from('vendor_crew_codes').select('token, ends_at').eq('vendor_profile_id', vendorProfileId).eq('event_id', picked.eventId).maybeSingle(),
    supabase
      .from('vendor_crew_passes')
      .select('pass_id', { count: 'exact', head: true })
      .eq('vendor_profile_id', vendorProfileId)
      .eq('event_id', picked.eventId)
      .eq('status', 'waiting'),
  ]);
  if (codeRes.error) {
    logQueryError('VendorQrCodesPage.crewCode', codeRes.error, { eventId: picked.eventId }, 'graceful_degrade');
    return { eventPick, eventName, code: { state: 'unread' }, hubHref: hub };
  }
  if (waitRes.error) logQueryError('VendorQrCodesPage.crewWaiting', waitRes.error, { eventId: picked.eventId }, 'graceful_degrade');
  const row = codeRes.data as { token: string; ends_at: string } | null;
  if (!row) return { eventPick, eventName, code: { state: 'none' }, hubHref: hub };
  const url = `${siteOrigin()}${crewJoinPath(row.token)}`;
  const ends = new Date(row.ends_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return {
    eventPick,
    eventName,
    code: {
      state: 'ready',
      url,
      svg: await renderUrlQrSvg(url, 220).catch(() => null),
      endsWords: `ends ${ends}`,
      waiting: waitRes.error ? null : (waitRes.count ?? null),
    },
    hubHref: hub,
  };
}
