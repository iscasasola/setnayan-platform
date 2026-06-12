import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { displayServiceLabel } from '@/lib/vendors';
import {
  SHARE_ARTIFACT_LABEL,
  coupleCreationCaption,
  shareConsentPublishGatePassed,
  shareConsentPostableFrom,
  vendorFeatureCaption,
  type ShareArtifactType,
  type ShareCreditMode,
} from '@/lib/social-sharing';
import {
  markConsentPosted,
  markConsentTakenDown,
  markVendorFeatured,
} from './actions';

export const metadata = { title: 'Social queue · Admin' };

type Props = {
  searchParams: Promise<{
    posted?: string;
    vendor_posted?: string;
    taken_down?: string;
    error?: string;
  }>;
};

type ConsentRow = {
  consent_id: string;
  event_id: string;
  artifact_type: ShareArtifactType;
  artifact_ref: string;
  credit_mode: ShareCreditMode;
  consented_at: string;
  revoked_at: string | null;
  posted_at: string | null;
  post_url: string | null;
};

type ConsentEvent = {
  event_id: string;
  display_name: string | null;
  event_date: string | null;
  monogram_custom_svg: string | null;
};

type VendorQueueRow = {
  vendor_profile_id: string;
  public_id: string;
  business_name: string;
  services: string[];
  location_city: string | null;
  hq_region: string | null;
  tier_state: string | null;
  tier_expires_at: string | null;
  created_at: string;
};

type GreetingUser = {
  user_id: string;
  display_name: string | null;
  birth_date: string | null;
};

/**
 * Admin Social Queue — the manual-posting surface of the Social Sharing &
 * Featuring Program (corpus `03_Strategy/Social_Sharing_Program_2026-06-12.md`
 * + migration 20261130000000). Five render-time panels, NO crons
 * ([[project_setnayan_cron_free]]):
 *
 *   1. Couple creations ready to post — consented + un-posted + past the
 *      app-side publish gate (event_date + 7 days; never before the event).
 *   2. Waiting on publish gate — same query, gate not yet passed.
 *   3. Take-downs needed — couple revoked AFTER a post went live; 24-hour
 *      removal SLA.
 *   4. New verified vendors — verification celebration features. Unnamed
 *      (category + region) for Free, named for Pro+ — the owner-locked hybrid
 *      (tiers sell REACH; mirrors project_setnayan_vendor_hybrid_anonymity).
 *   5. Greetings this week — opted-in birthdays + wedding anniversaries.
 *      Render-only (they recur annually; no posted-stamp in V1).
 *
 * The team copies a drafted caption to the Facebook page by hand, then
 * stamps the row via the actions file so it leaves the queue. Reads use the
 * service-role admin client — same mechanism as /admin/verify.
 */
export default async function AdminSocialQueuePage({ searchParams }: Props) {
  const search = await searchParams;
  const admin = createAdminClient();

  // ── Couple-creation consents (live, un-posted) ──────────────────────────
  const { data: pendingData, error: pendingErr } = await admin
    .from('marketing_share_consents')
    .select(
      'consent_id,event_id,artifact_type,artifact_ref,credit_mode,consented_at,revoked_at,posted_at,post_url',
    )
    .is('revoked_at', null)
    .is('posted_at', null)
    .order('consented_at', { ascending: true })
    .limit(200);
  if (pendingErr) {
    logQueryError('AdminSocialQueuePage (marketing_share_consents pending)', pendingErr);
  }
  const pendingConsents = (pendingData ?? []) as ConsentRow[];

  // ── Take-downs: revoked AFTER posting, not yet removed ──────────────────
  const { data: takedownData, error: takedownErr } = await admin
    .from('marketing_share_consents')
    .select(
      'consent_id,event_id,artifact_type,artifact_ref,credit_mode,consented_at,revoked_at,posted_at,post_url',
    )
    .not('revoked_at', 'is', null)
    .not('posted_at', 'is', null)
    .is('taken_down_at', null)
    .order('revoked_at', { ascending: true })
    .limit(100);
  if (takedownErr) {
    logQueryError('AdminSocialQueuePage (marketing_share_consents takedowns)', takedownErr);
  }
  const takedowns = (takedownData ?? []) as ConsentRow[];

  // Event rows for both consent lists — two round trips, no FK-joined select
  // (relationship not declared in the schema cache; matches /admin/verify).
  const consentEventIds = Array.from(
    new Set([...pendingConsents, ...takedowns].map((c) => c.event_id)),
  );
  let eventMap: Record<string, ConsentEvent> = {};
  if (consentEventIds.length > 0) {
    const { data: eventData } = await admin
      .from('events')
      .select('event_id,display_name,event_date,monogram_custom_svg')
      .in('event_id', consentEventIds);
    eventMap = Object.fromEntries(
      ((eventData ?? []) as ConsentEvent[]).map((e) => [e.event_id, e]),
    );
  }

  // App-side publish gate split (event_date + 7d — see lib/social-sharing.ts).
  const readyToPost = pendingConsents.filter((c) =>
    shareConsentPublishGatePassed(eventMap[c.event_id]?.event_date ?? null),
  );
  const waitingOnGate = pendingConsents.filter(
    (c) => !shareConsentPublishGatePassed(eventMap[c.event_id]?.event_date ?? null),
  );

  // ── New verified vendors awaiting their celebration feature ─────────────
  const { data: vendorData, error: vendorErr } = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id,public_id,business_name,services,location_city,hq_region,tier_state,tier_expires_at,created_at',
    )
    .eq('public_visibility', 'verified')
    .eq('social_feature_opt_out', false)
    .is('social_featured_at', null)
    .order('created_at', { ascending: true })
    .limit(100);
  if (vendorErr) {
    logQueryError('AdminSocialQueuePage (vendor_profiles)', vendorErr);
  }
  const vendorQueue = (vendorData ?? []) as VendorQueueRow[];

  // ── Greetings this week (render-only · recur annually) ──────────────────
  const { data: greetingData, error: greetingErr } = await admin
    .from('users')
    .select('user_id,display_name,birth_date')
    .eq('public_greeting_opt_in', true)
    .limit(2000);
  if (greetingErr) {
    logQueryError('AdminSocialQueuePage (users greetings)', greetingErr);
  }
  const optedIn = (greetingData ?? []) as GreetingUser[];

  // Birthdays — opted-in users whose birth_date month/day lands in the next
  // 7 days. Fetched + filtered in JS — fine at current scale; revisit with a
  // SQL month/day expression index if the opted-in set ever gets big.
  const birthdays = optedIn
    .filter((u) => u.birth_date && monthDayWithinNext7Days(u.birth_date))
    .sort((a, b) => (a.birth_date ?? '').slice(5).localeCompare((b.birth_date ?? '').slice(5)));

  // Anniversaries — past events whose event_date anniversary lands in the
  // next 7 days AND at least one couple member opted in. Opted-in users'
  // couple memberships → event ids → events, intersected in JS.
  let anniversaries: Array<{ event_id: string; display_name: string | null; event_date: string }> = [];
  if (optedIn.length > 0) {
    const { data: memberData } = await admin
      .from('event_members')
      .select('event_id,user_id')
      .eq('member_type', 'couple')
      .in('user_id', optedIn.map((u) => u.user_id))
      .limit(2000);
    const memberEventIds = Array.from(
      new Set(((memberData ?? []) as Array<{ event_id: string }>).map((m) => m.event_id)),
    );
    if (memberEventIds.length > 0) {
      const { data: annivEvents } = await admin
        .from('events')
        .select('event_id,display_name,event_date')
        .in('event_id', memberEventIds)
        .not('event_date', 'is', null);
      anniversaries = (
        (annivEvents ?? []) as Array<{
          event_id: string;
          display_name: string | null;
          event_date: string;
        }>
      ).filter(
        (e) =>
          new Date(`${e.event_date}T00:00:00`).getTime() < Date.now() &&
          monthDayWithinNext7Days(e.event_date),
      );
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">
          Social Sharing &amp; Featuring Program · 2026-06-12
        </p>
        <h1 className="m-display-tight text-2xl text-[color:var(--m-ink)] sm:text-3xl">
          Social queue
        </h1>
        <p className="max-w-2xl text-sm text-ink/65">
          Ready-to-post cards for the Setnayan Facebook page. Posting is{' '}
          <span className="font-medium">manual</span> — copy the drafted caption,
          post it, then mark the card so it leaves the queue. Couple creations
          only become postable <span className="font-medium">7 days after the
          event</span>; revoked consents must come down within 24 hours.
        </p>
      </header>

      <FlashBanner search={search} />

      {/* ── 3. Take-downs first — SLA-bound, most urgent ── */}
      <QueueSection
        title="Take-downs needed"
        hint="Couple revoked consent — remove the post within 24 hours."
        count={takedowns.length}
        empty="No take-downs pending. Revoked-after-posting consents land here."
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {takedowns.map((c) => {
            const ev = eventMap[c.event_id];
            return (
              <li key={c.consent_id}>
                <article className="space-y-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-4">
                  <header className="space-y-0.5">
                    <p className="text-sm font-semibold text-ink">
                      {SHARE_ARTIFACT_LABEL[c.artifact_type] ?? c.artifact_type} ·{' '}
                      {ev?.display_name || 'Unnamed event'}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
                      Revoked {c.revoked_at?.slice(0, 10)} · posted {c.posted_at?.slice(0, 10)}
                    </p>
                  </header>
                  <p className="text-xs text-ink/70">
                    Couple revoked consent — remove the post within 24 hours.
                  </p>
                  {c.post_url ? (
                    <a
                      href={c.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs text-terracotta hover:underline"
                    >
                      Open the live post ↗
                    </a>
                  ) : (
                    <p className="text-xs text-ink/55">
                      No post URL on file — find it on the page timeline near{' '}
                      {c.posted_at?.slice(0, 10)}.
                    </p>
                  )}
                  <form action={markConsentTakenDown}>
                    <input type="hidden" name="consent_id" value={c.consent_id} />
                    <button
                      type="submit"
                      className="inline-flex h-9 items-center rounded-md bg-terracotta/15 px-3 text-xs font-medium text-terracotta-700 hover:bg-terracotta/25"
                    >
                      Mark taken down
                    </button>
                  </form>
                </article>
              </li>
            );
          })}
        </ul>
      </QueueSection>

      {/* ── 1. Couple creations ready to post ── */}
      <QueueSection
        title="Couple creations — ready to post"
        hint="Consented + past the publish gate (event date + 7 days)."
        count={readyToPost.length}
        empty="Nothing postable yet — consented creations appear here once their event is 7+ days past."
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {readyToPost.map((c) => {
            const ev = eventMap[c.event_id];
            const coupleName = ev?.display_name ?? '';
            const credit =
              c.credit_mode === 'first_names' && coupleName
                ? coupleName
                : 'A Setnayan couple';
            const caption = coupleCreationCaption({
              artifactType: c.artifact_type,
              creditMode: c.credit_mode,
              coupleName,
            });
            const monogramSvg =
              c.artifact_type === 'monogram' ? (ev?.monogram_custom_svg ?? null) : null;
            return (
              <li key={c.consent_id}>
                <article className="space-y-3 rounded-xl border border-ink/10 bg-cream p-4">
                  <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-semibold text-ink">
                        {SHARE_ARTIFACT_LABEL[c.artifact_type] ?? c.artifact_type}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                        {credit} · event {ev?.event_date ?? '—'}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-800">
                      Ready
                    </span>
                  </header>

                  {monogramSvg ? (
                    // Same inert data-URI <img> approach BespokeMonogramMark
                    // uses — the SVG was allowlist-sanitized server-side at
                    // generation time; an image context can't run scripts.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:image/svg+xml;utf8,${encodeURIComponent(monogramSvg)}`}
                      alt="Couple monogram"
                      className="h-20 w-20 rounded-full border border-ink/10 bg-cream object-contain"
                    />
                  ) : null}

                  <pre className="whitespace-pre-wrap rounded-md border border-ink/10 bg-ink/[0.03] px-3 py-2 font-sans text-xs text-ink/80">
                    {caption}
                  </pre>

                  <form action={markConsentPosted} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="consent_id" value={c.consent_id} />
                    <input
                      name="post_url"
                      type="url"
                      placeholder="https://facebook.com/… (optional)"
                      className="input-field h-9 min-w-0 flex-1 text-xs"
                    />
                    <button type="submit" className="button-primary h-9 px-3 text-xs">
                      Mark posted
                    </button>
                  </form>
                </article>
              </li>
            );
          })}
        </ul>
      </QueueSection>

      {/* ── 2. Waiting on the publish gate — compact ── */}
      <QueueSection
        title="Waiting on publish gate"
        hint="Consented, but the event isn't 7+ days past yet."
        count={waitingOnGate.length}
        empty="Nothing waiting — every live consent is already postable."
      >
        <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10 bg-cream">
          {waitingOnGate.map((c) => {
            const ev = eventMap[c.event_id];
            const postableFrom = shareConsentPostableFrom(ev?.event_date ?? null);
            return (
              <li
                key={c.consent_id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs"
              >
                <span className="min-w-0 truncate text-ink/80">
                  <span className="font-medium text-ink">
                    {SHARE_ARTIFACT_LABEL[c.artifact_type] ?? c.artifact_type}
                  </span>{' '}
                  · {ev?.display_name || 'Unnamed event'} · event {ev?.event_date ?? 'date not set'}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  {postableFrom ? `posts after ${postableFrom}` : 'needs an event date'}
                </span>
              </li>
            );
          })}
        </ul>
      </QueueSection>

      {/* ── 4. New verified vendors ── */}
      <QueueSection
        title="New verified vendors"
        hint="Verification celebration features — unnamed for Free, named for Pro+."
        count={vendorQueue.length}
        empty="No vendors waiting — newly verified vendors (who haven't opted out) land here."
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {vendorQueue.map((v) => {
            // Pro+ derivation mirrors the app-side canonical source:
            // vendor_profiles.tier_state (stamped by the subscription-approve
            // RPC reading vendor_subscriptions · migration 20261010000000),
            // guarded by tier_expires_at because the downgrade sweep is
            // login-driven (sweep_vendor_tier_expiry) and may not have run.
            const proActive =
              (v.tier_state === 'pro' || v.tier_state === 'enterprise') &&
              (!v.tier_expires_at || new Date(v.tier_expires_at).getTime() > Date.now());
            const categoryLabel = v.services[0]
              ? displayServiceLabel(v.services[0])
              : 'vendor';
            const region = v.hq_region ?? v.location_city ?? 'the Philippines';
            // Unnamed-vs-named is the owner-locked hybrid: tiers sell REACH,
            // not features — Free gets the category mention, Pro+ the named
            // feature (mirrors project_setnayan_vendor_hybrid_anonymity).
            const caption = vendorFeatureCaption({
              named: proActive,
              businessName: v.business_name,
              categoryLabel,
              region,
            });
            return (
              <li key={v.vendor_profile_id}>
                <article className="space-y-3 rounded-xl border border-ink/10 bg-cream p-4">
                  <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-sm font-semibold text-ink">
                        {proActive
                          ? v.business_name || 'Unnamed vendor'
                          : `A new ${categoryLabel.toLowerCase()} in ${region}`}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                        {v.public_id} · verified · {proActive ? 'named (Pro+)' : 'unnamed (Free)'}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                        proActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-ink/8 text-ink/65'
                      }`}
                    >
                      {proActive ? 'Named' : 'Unnamed'}
                    </span>
                  </header>

                  <pre className="whitespace-pre-wrap rounded-md border border-ink/10 bg-ink/[0.03] px-3 py-2 font-sans text-xs text-ink/80">
                    {caption}
                  </pre>

                  <form action={markVendorFeatured} className="flex flex-wrap items-center gap-2">
                    <input
                      type="hidden"
                      name="vendor_profile_id"
                      value={v.vendor_profile_id}
                    />
                    <input
                      name="post_url"
                      type="url"
                      placeholder="https://facebook.com/… (optional)"
                      className="input-field h-9 min-w-0 flex-1 text-xs"
                    />
                    <button type="submit" className="button-primary h-9 px-3 text-xs">
                      Mark posted
                    </button>
                  </form>
                </article>
              </li>
            );
          })}
        </ul>
      </QueueSection>

      {/* ── 5. Greetings this week (render-only · recur annually) ── */}
      <QueueSection
        title="Greetings this week"
        hint="Opted-in public greetings — birthdays + wedding anniversaries in the next 7 days. No mark-posted; these recur every year."
        count={birthdays.length + anniversaries.length}
        empty="No opted-in birthdays or anniversaries in the next 7 days."
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {birthdays.map((u) => (
            <li key={`bday-${u.user_id}`}>
              <article className="space-y-2 rounded-xl border border-ink/10 bg-cream p-4">
                <p className="text-sm font-semibold text-ink">
                  🎂 {u.display_name || 'A Setnayan member'}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  Birthday · {(u.birth_date ?? '').slice(5)}
                </p>
                <pre className="whitespace-pre-wrap rounded-md border border-ink/10 bg-ink/[0.03] px-3 py-2 font-sans text-xs text-ink/80">
                  {`Happy birthday, ${u.display_name || 'friend'}! 🎂 Wishing you a day as wonderful as the celebrations you plan with us. — the Setnayan team`}
                </pre>
              </article>
            </li>
          ))}
          {anniversaries.map((e) => (
            <li key={`anniv-${e.event_id}`}>
              <article className="space-y-2 rounded-xl border border-ink/10 bg-cream p-4">
                <p className="text-sm font-semibold text-ink">
                  💍 {e.display_name || 'A Setnayan couple'}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  Anniversary · married {e.event_date}
                </p>
                <pre className="whitespace-pre-wrap rounded-md border border-ink/10 bg-ink/[0.03] px-3 py-2 font-sans text-xs text-ink/80">
                  {`Happy anniversary, ${e.display_name || 'you two'}! 💍 Another year of "Set na 'yan." — with love, the Setnayan team`}
                </pre>
              </article>
            </li>
          ))}
        </ul>
      </QueueSection>
    </div>
  );
}

/**
 * True when the month/day of `isoDate` (YYYY-MM-DD) falls on one of the next
 * 7 calendar days (today inclusive). Year-wrap safe (Dec → Jan). Feb 29
 * birthdays only match in leap years — acceptable for a weekly manual queue.
 */
function monthDayWithinNext7Days(isoDate: string): boolean {
  const md = isoDate.slice(5, 10);
  if (!/^\d{2}-\d{2}$/.test(md)) return false;
  const now = new Date();
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const candidate = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
    if (candidate === md) return true;
  }
  return false;
}

function QueueSection({
  title,
  hint,
  count,
  empty,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 space-y-3">
      <div className="space-y-0.5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          {title} · {count}
        </h2>
        <p className="text-xs text-ink/55">{hint}</p>
      </div>
      {count === 0 ? (
        <p className="rounded-xl border border-dashed border-ink/20 bg-cream p-6 text-center text-sm text-ink/55">
          {empty}
        </p>
      ) : (
        children
      )}
    </section>
  );
}

function FlashBanner({ search }: { search: Awaited<Props['searchParams']> }) {
  if (search.error) {
    return (
      <p
        role="alert"
        className="mb-4 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
      >
        {decodeURIComponent(search.error)}
      </p>
    );
  }
  if (search.posted === '1') {
    return (
      <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Marked posted — the card left the queue.
      </p>
    );
  }
  if (search.vendor_posted === '1') {
    return (
      <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Vendor feature marked posted — they won&rsquo;t be queued again.
      </p>
    );
  }
  if (search.taken_down === '1') {
    return (
      <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Take-down recorded. Thank you for keeping the 24-hour promise.
      </p>
    );
  }
  return null;
}
