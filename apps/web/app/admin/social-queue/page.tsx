import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { runSocialFlush } from '@/lib/social/flush';
import { isFacebookConfigured } from '@/lib/social/facebook';
import { isInstagramConfigured } from '@/lib/social/instagram';
import { isTikTokConfigured } from '@/lib/social/tiktok';
import { socialCardUrl } from '@/lib/social/urls';
import { getChangelogSuggestions } from '@/lib/social/changelog-suggestions';
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
  createAnnouncement,
  markConsentPosted,
  markConsentTakenDown,
  markVendorFeatured,
  postSocialPostNow,
  pullSocialPost,
  retrySocialPost,
  saveEvergreenItem,
  updatePublishSettings,
  updateSocialPostBody,
} from './actions';

export const metadata = { title: 'Social queue · Admin' };

type Props = {
  searchParams: Promise<{
    posted?: string;
    vendor_posted?: string;
    taken_down?: string;
    settings_saved?: string;
    pulled?: string;
    posted_now?: string;
    retried?: string;
    body_saved?: string;
    announcement_created?: string;
    evergreen_saved?: string;
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

// ── Auto-publish pipeline rows (migration 20261204000000_social_autopublish) ─

type SocialSourceType =
  | 'couple_creation'
  | 'vendor_feature'
  | 'milestone'
  | 'announcement'
  | 'evergreen';

type SocialPostRow = {
  post_id: string;
  source_type: SocialSourceType;
  source_ref: string;
  title: string;
  body: string;
  media_url: string | null;
  link_url: string | null;
  publish_after: string | null;
  hold_until: string | null;
  scheduled_for: string | null;
  status: 'scheduled' | 'publishing' | 'published' | 'pulled' | 'failed';
  platform_results: unknown;
  created_at: string;
  updated_at: string;
};

type PublishSettings = {
  autopublish_enabled: boolean;
  facebook_enabled: boolean;
  instagram_enabled: boolean;
  tiktok_enabled: boolean;
  last_flush_at: string | null;
};

type EvergreenItemRow = {
  item_id: string;
  title: string;
  body: string;
  media_url: string | null;
  link_url: string | null;
  is_active: boolean;
  last_used_at: string | null;
  times_used: number;
};

const SOURCE_LABEL: Record<SocialSourceType, string> = {
  couple_creation: 'Couple creation',
  vendor_feature: 'Vendor feature',
  milestone: 'Milestone',
  announcement: 'Announcement',
  evergreen: 'Evergreen',
};

const SOURCE_CHIP: Record<SocialSourceType, string> = {
  couple_creation: 'bg-emerald-100 text-emerald-800',
  vendor_feature: 'bg-amber-100 text-amber-900',
  milestone: 'bg-terracotta/10 text-terracotta-700',
  announcement: 'bg-sky-100 text-sky-800',
  evergreen: 'bg-ink/8 text-ink/65',
};

/**
 * Admin Social Queue — mission control for the Social Sharing & Featuring
 * Program (corpus `03_Strategy/Social_Sharing_Program_2026-06-12.md` § 8 +
 * migrations 20261203000000 + 20261204000000). Cron-free
 * ([[project_setnayan_cron_free]]) — viewing the queue fires the flush via
 * `after()`.
 *
 * Layout, top to bottom:
 *   • Autopilot strip — master switch + per-platform toggles + Meta env
 *     status + last flush time (social_publish_settings, single row).
 *   • Take-downs — couple revoked AFTER a post went live; 24-hour SLA.
 *     Urgent regardless of mode, so it sits right under the switchboard.
 *   • Scheduled — the auto-publish queue (status scheduled/publishing) with
 *     inline copy editing, Pull, and Post-now (content gate not overridable).
 *   • Failed — dispatch errors with the Graph error text + Retry.
 *   • Published — compact audit trail with permalinks.
 *   • Announce composer — hand-written posts at the next governor slot,
 *     seeded by the 5 newest CHANGELOG headlines.
 *   • Evergreen library — the content floor the flush reposts when the page
 *     goes quiet (3-day quiet trigger · 60-day no-repeat).
 *   • Manual workflow & sources — the original copy-paste panels (ready to
 *     post · waiting on gate · vendor features) kept as the fallback
 *     workflow, plus the render-only greetings panel.
 *
 * Reads use the service-role admin client — same mechanism as /admin/verify.
 * Every query soft-degrades (logQueryError + empty fallback) so the page
 * renders even before the migration lands.
 */
export default async function AdminSocialQueuePage({ searchParams }: Props) {
  const search = await searchParams;
  const admin = createAdminClient();

  // Auto-publish flush — cron-free ([[project_setnayan_cron_free]]): viewing
  // the queue is the most natural moment to sweep-compose + dispatch.
  // Fire-and-forget AFTER the response; 10-min throttled; never throws.
  after(() => runSocialFlush().catch(() => {}));

  const fbConfigured = isFacebookConfigured();
  const igConfigured = isInstagramConfigured();
  const ttConfigured = isTikTokConfigured();

  // ── Autopilot switchboard (single row) ──────────────────────────────────
  const { data: settingsData, error: settingsErr } = await admin
    .from('social_publish_settings')
    .select(
      'autopublish_enabled,facebook_enabled,instagram_enabled,tiktok_enabled,last_flush_at',
    )
    .eq('id', true)
    .maybeSingle();
  if (settingsErr) {
    logQueryError('AdminSocialQueuePage (social_publish_settings)', settingsErr);
  }
  const settings: PublishSettings = (settingsData as PublishSettings | null) ?? {
    autopublish_enabled: false,
    facebook_enabled: true,
    instagram_enabled: false,
    tiktok_enabled: false,
    last_flush_at: null,
  };

  // ── Auto-publish queue: scheduled / publishing ──────────────────────────
  const { data: scheduledData, error: scheduledErr } = await admin
    .from('social_posts')
    .select(
      'post_id,source_type,source_ref,title,body,media_url,link_url,publish_after,hold_until,scheduled_for,status,platform_results,created_at,updated_at',
    )
    .in('status', ['scheduled', 'publishing'])
    .order('scheduled_for', { ascending: true, nullsFirst: false })
    .limit(30);
  if (scheduledErr) {
    logQueryError('AdminSocialQueuePage (social_posts scheduled)', scheduledErr);
  }
  const scheduledPosts = (scheduledData ?? []) as SocialPostRow[];

  // ── Auto-publish queue: failed ──────────────────────────────────────────
  const { data: failedData, error: failedErr } = await admin
    .from('social_posts')
    .select(
      'post_id,source_type,source_ref,title,body,media_url,link_url,publish_after,hold_until,scheduled_for,status,platform_results,created_at,updated_at',
    )
    .eq('status', 'failed')
    .order('updated_at', { ascending: false })
    .limit(10);
  if (failedErr) {
    logQueryError('AdminSocialQueuePage (social_posts failed)', failedErr);
  }
  const failedPosts = (failedData ?? []) as SocialPostRow[];

  // ── Auto-publish queue: published (audit trail) ─────────────────────────
  const { data: publishedData, error: publishedErr } = await admin
    .from('social_posts')
    .select(
      'post_id,source_type,source_ref,title,body,media_url,link_url,publish_after,hold_until,scheduled_for,status,platform_results,created_at,updated_at',
    )
    .eq('status', 'published')
    .order('updated_at', { ascending: false })
    .limit(12);
  if (publishedErr) {
    logQueryError('AdminSocialQueuePage (social_posts published)', publishedErr);
  }
  const publishedPosts = (publishedData ?? []) as SocialPostRow[];

  // ── Evergreen library ───────────────────────────────────────────────────
  const { data: evergreenData, error: evergreenErr } = await admin
    .from('social_evergreen_items')
    .select('item_id,title,body,media_url,link_url,is_active,last_used_at,times_used')
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(50);
  if (evergreenErr) {
    logQueryError('AdminSocialQueuePage (social_evergreen_items)', evergreenErr);
  }
  const evergreenItems = (evergreenData ?? []) as EvergreenItemRow[];

  // Announcement-draft seeds — newest CHANGELOG headlines (best-effort: []).
  const changelogSuggestions = getChangelogSuggestions();

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

  const now = Date.now();

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">
          Social Sharing &amp; Featuring Program · § 8 auto-publish · 2026-06-12
        </p>
        <h1 className="m-display-tight text-2xl text-[color:var(--m-ink)] sm:text-3xl">
          Social queue
        </h1>
        <p className="max-w-2xl text-sm text-ink/65">
          Mission control for the Setnayan Facebook page. The pipeline
          composes, schedules, and (when the master switch is on)
          auto-publishes — couple creations only after{' '}
          <span className="font-medium">event date + 7 days</span>, never more
          than 3 posts/day, always inside PH prime windows. The manual
          copy-paste panels below remain the fallback workflow; revoked
          consents must come down within 24 hours.
        </p>
      </header>

      <FlashBanner search={search} />

      {/* In-page anchor nav — the page is long; jump straight to a section. */}
      <nav
        aria-label="Page sections"
        className="mb-6 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55"
      >
        <a href="#scheduled" className="hover:text-ink">Scheduled</a>
        <a href="#failed" className="hover:text-ink">Failed</a>
        <a href="#published" className="hover:text-ink">Published</a>
        <a href="#announce" className="hover:text-ink">Announce</a>
        <a href="#evergreen" className="hover:text-ink">Evergreen</a>
        <a href="#manual" className="hover:text-ink">Manual</a>
      </nav>

      {/* ── Autopilot strip — switchboard + env status + last flush ── */}
      <AutopilotStrip
        settings={settings}
        fbConfigured={fbConfigured}
        igConfigured={igConfigured}
        ttConfigured={ttConfigured}
        loadFailed={Boolean(settingsErr)}
      />

      {/* ── Take-downs — SLA-bound, most urgent regardless of mode ── */}
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

      {/* ── Scheduled — the auto-publish queue ── */}
      <QueueSection
        id="scheduled"
        title="Scheduled"
        hint="Composed by the sweep + slotted by the cadence governor (≤3/day · ≥3h apart · PH prime windows). Pull stops a post; Post now skips the hold but never the content gate."
        count={scheduledPosts.length}
        empty="Nothing queued — the sweep composes posts from new consents, vendor verifications, milestones, and the evergreen floor."
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {scheduledPosts.map((p) => (
            <li key={p.post_id}>
              <ScheduledPostCard post={p} now={now} />
            </li>
          ))}
        </ul>
      </QueueSection>

      {/* ── Failed — dispatch errors ── */}
      <QueueSection
        id="failed"
        title="Failed"
        hint="The Graph API rejected the dispatch — read the error, fix the cause (token, media URL), then retry or pull."
        count={failedPosts.length}
        empty="No failed dispatches. Graph API errors land here with the error text."
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {failedPosts.map((p) => {
            return (
              <li key={p.post_id}>
                <article className="space-y-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-4">
                  <header className="flex items-start gap-3">
                    <CardPreview postId={p.post_id} />
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                      {p.title || firstLine(p.body) || 'Untitled post'}
                    </p>
                    <SourceChip sourceType={p.source_type} />
                  </header>
                  <pre className="whitespace-pre-wrap rounded-md border border-ink/10 bg-ink/[0.03] px-3 py-2 font-sans text-xs text-ink/80">
                    {p.body}
                  </pre>
                  <p className="rounded-md border border-terracotta/30 bg-terracotta/10 px-3 py-2 text-xs text-terracotta-700">
                    <span className="font-medium">Dispatch error:</span>{' '}
                    {dispatchError(p.platform_results) || 'No error detail recorded.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
                    <form action={retrySocialPost}>
                      <input type="hidden" name="post_id" value={p.post_id} />
                      <button type="submit" className="button-primary h-9 px-3 text-xs">
                        Retry
                      </button>
                    </form>
                    <form action={pullSocialPost}>
                      <input type="hidden" name="post_id" value={p.post_id} />
                      <button
                        type="submit"
                        className="inline-flex h-9 items-center rounded-md border border-terracotta/30 bg-terracotta/5 px-3 text-xs text-terracotta-700 hover:bg-terracotta/15"
                      >
                        Pull
                      </button>
                    </form>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </QueueSection>

      {/* ── Published — compact audit trail ── */}
      <QueueSection
        id="published"
        title="Published"
        hint="The 12 most recent auto-published posts, with permalinks."
        count={publishedPosts.length}
        empty="Nothing auto-published yet — successful dispatches land here."
      >
        <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10 bg-cream">
          {publishedPosts.map((p) => {
            const fb = platformResult(p.platform_results, 'facebook');
            const ig = platformResult(p.platform_results, 'instagram');
            const postedAt = fb.posted_at ?? ig.posted_at ?? p.updated_at;
            return (
              <li
                key={p.post_id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <CardPreview postId={p.post_id} size={40} />
                  <SourceChip sourceType={p.source_type} />
                  <span className="min-w-0 truncate text-ink/80">{firstLine(p.body)}</span>
                </span>
                <span className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  <span>{formatPhInstant(postedAt)}</span>
                  {fb.post_url ? (
                    <a
                      href={fb.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-terracotta hover:underline"
                    >
                      FB ↗
                    </a>
                  ) : null}
                  {ig.post_url ? (
                    <a
                      href={ig.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-terracotta hover:underline"
                    >
                      IG ↗
                    </a>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </QueueSection>

      {/* ── TikTok — assisted-manual posting (pre-audit working surface) ── */}
      {settings.tiktok_enabled && !ttConfigured ? (
        <TikTokManualPanel posts={[...scheduledPosts, ...publishedPosts]} />
      ) : null}

      {/* ── Announce something — hand-written posts ── */}
      <section id="announce" className="mb-8 space-y-3">
        <div className="space-y-0.5">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Announce something
          </h2>
          <p className="text-xs text-ink/55">
            Hand-written post — queues at the next governor slot, no hold window.
          </p>
        </div>
        <article className="space-y-4 rounded-xl border border-ink/10 bg-cream p-5">
          {changelogSuggestions.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-ink/70">
                Recent ships you could announce:
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {changelogSuggestions.map((s) => (
                  <li
                    key={`${s.date}-${s.title}`}
                    className="rounded-full border border-ink/15 bg-ink/[0.03] px-2.5 py-1 text-xs text-ink/70"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink/45">
                      {s.date}
                    </span>{' '}
                    {s.title}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <form action={createAnnouncement} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-xs text-ink/65">
                <span>Title (internal)</span>
                <input
                  name="title"
                  type="text"
                  placeholder="e.g. Seat plan editor launch"
                  className="input-field h-9 w-full text-xs"
                />
              </label>
              <label className="block space-y-1 text-xs text-ink/65">
                <span>Link URL (optional)</span>
                <input
                  name="link_url"
                  type="url"
                  placeholder="https://www.setnayan.com/…"
                  className="input-field h-9 w-full text-xs"
                />
              </label>
            </div>
            <label className="block space-y-1 text-xs text-ink/65">
              <span>Post body (this is what the page publishes)</span>
              <textarea
                name="body"
                required
                rows={4}
                placeholder={'Big news from Setnayan… ✨\n\n#Setnayan #SetNaYan'}
                className="block w-full rounded-md border border-ink/20 bg-cream px-3 py-2 text-xs text-ink"
              />
            </label>
            <label className="block space-y-1 text-xs text-ink/65">
              <span>Image URL (optional — photo posts reach further)</span>
              <input
                name="media_url"
                type="url"
                placeholder="https://… .jpg / .png"
                className="input-field h-9 w-full text-xs"
              />
            </label>
            <button type="submit" className="button-primary h-9 px-3 text-xs">
              Queue announcement
            </button>
          </form>
        </article>
      </section>

      {/* ── Evergreen library — the content floor ── */}
      <section id="evergreen" className="mb-8 space-y-3">
        <div className="space-y-0.5">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Evergreen library · {evergreenItems.length}
          </h2>
          <p className="text-xs text-ink/55">
            The scheduler uses these to keep the page alive — if nothing posts
            for 3 days, the least-recently-used active item goes out (60-day
            no-repeat).
          </p>
        </div>

        {evergreenItems.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink/20 bg-cream p-6 text-center text-sm text-ink/55">
            No evergreen items yet — add a few planning tips or feature
            spotlights below so the page never looks abandoned.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {evergreenItems.map((item) => (
              <li key={item.item_id}>
                <EvergreenItemCard item={item} />
              </li>
            ))}
          </ul>
        )}

        {/* Add a new item — same action, no item_id → insert. */}
        <article className="space-y-3 rounded-xl border border-dashed border-ink/20 bg-cream p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Add evergreen item
          </p>
          <form action={saveEvergreenItem} className="space-y-3">
            <input
              name="title"
              type="text"
              required
              placeholder="Title (internal, e.g. Planning tip · guest list first)"
              className="input-field h-9 w-full text-xs"
            />
            <textarea
              name="body"
              required
              rows={3}
              placeholder="The post body the page publishes…"
              className="block w-full rounded-md border border-ink/20 bg-cream px-3 py-2 text-xs text-ink"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                name="media_url"
                type="url"
                placeholder="Image URL (optional)"
                className="input-field h-9 w-full text-xs"
              />
              <input
                name="link_url"
                type="url"
                placeholder="Link URL (optional)"
                className="input-field h-9 w-full text-xs"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-ink/75">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked
                  className="h-4 w-4 rounded border-ink/30 accent-ink"
                />
                Active (in the rotation)
              </label>
              <button type="submit" className="button-primary h-9 px-3 text-xs">
                Add item
              </button>
            </div>
          </form>
        </article>
      </section>

      {/* ── Manual workflow & sources — the original copy-paste lane ── */}
      <div id="manual" className="mb-8 mt-12 space-y-1 border-t border-ink/15 pt-6">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Manual workflow &amp; sources
        </h2>
        <p className="text-xs text-ink/55">
          The fallback lane — copy a drafted caption, post it by hand, then
          stamp the card so it leaves the queue (and so the sweep never
          composes a duplicate).
        </p>
      </div>

      {/* ── Couple creations ready to post ── */}
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

      {/* ── Waiting on the publish gate — compact ── */}
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

      {/* ── New verified vendors ── */}
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

      {/* ── Greetings this week (render-only · recur annually) ── */}
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

// ---------------------------------------------------------------------------
// Autopilot strip
// ---------------------------------------------------------------------------

function AutopilotStrip({
  settings,
  fbConfigured,
  igConfigured,
  ttConfigured,
  loadFailed,
}: {
  settings: PublishSettings;
  fbConfigured: boolean;
  igConfigured: boolean;
  ttConfigured: boolean;
  loadFailed: boolean;
}) {
  const fbChip = !settings.facebook_enabled
    ? { label: 'Facebook · off', tone: 'bg-ink/8 text-ink/55' }
    : fbConfigured
      ? { label: 'Facebook · live', tone: 'bg-emerald-100 text-emerald-800' }
      : { label: 'Facebook · awaiting env', tone: 'bg-amber-100 text-amber-900' };
  // Instagram is live now (Phase B) — same chip logic as Facebook.
  const igChip = !settings.instagram_enabled
    ? { label: 'Instagram · off', tone: 'bg-ink/8 text-ink/55' }
    : igConfigured
      ? { label: 'Instagram · live', tone: 'bg-emerald-100 text-emerald-800' }
      : { label: 'Instagram · awaiting env', tone: 'bg-amber-100 text-amber-900' };
  // TikTok (Phase C): live when a token is present (audited app), else the
  // assisted-manual lane — the realistic pre-audit state.
  const ttChip = !settings.tiktok_enabled
    ? { label: 'TikTok · off', tone: 'bg-ink/8 text-ink/55' }
    : ttConfigured
      ? { label: 'TikTok · live', tone: 'bg-emerald-100 text-emerald-800' }
      : { label: 'TikTok · assisted (audit pending)', tone: 'bg-amber-100 text-amber-900' };

  return (
    <section id="autopilot" className="mb-8 space-y-4 rounded-xl border border-ink/10 bg-cream p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Autopilot
          </h2>
          <p className="text-xs text-ink/55">
            The sweep always composes + schedules; dispatch only runs while the
            master switch is on. Flushes piggyback on page views, ~10 min apart.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
              settings.autopublish_enabled
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-ink/8 text-ink/55'
            }`}
          >
            Autopublish {settings.autopublish_enabled ? 'ON' : 'OFF'}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${fbChip.tone}`}
          >
            {fbChip.label}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${igChip.tone}`}
          >
            {igChip.label}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${ttChip.tone}`}
            title="TikTok posts the 9:16 card as a Photo Mode post. Auto-posting needs an audited app + a per-account token; until then, post manually from the TikTok panel."
          >
            {ttChip.label}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
            {settings.last_flush_at
              ? `last flush ${formatPhInstant(settings.last_flush_at)}`
              : 'no flush yet'}
          </span>
        </div>
      </div>

      {!fbConfigured ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          Paste <span className="font-mono">META_PAGE_ID</span> +{' '}
          <span className="font-mono">META_PAGE_ACCESS_TOKEN</span> into Vercel
          env to activate Facebook — see API_Integration_Checklist #21a. The
          switches below still save; nothing dispatches until the env lands.
        </p>
      ) : null}

      {!igConfigured ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          For Instagram, also paste <span className="font-mono">IG_USER_ID</span>{' '}
          (the IG Business account linked to the Page) — the same{' '}
          <span className="font-mono">META_PAGE_ACCESS_TOKEN</span> authorizes
          it with the <span className="font-mono">instagram_basic</span> +{' '}
          <span className="font-mono">instagram_content_publish</span> scopes.
          Every post now carries a branded card image, which IG requires.
        </p>
      ) : null}

      {settings.tiktok_enabled && !ttConfigured ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          TikTok auto-posting needs an audited app + OAuth token (
          <span className="font-mono">TIKTOK_ACCESS_TOKEN</span>) + a verified{' '}
          <span className="font-mono">PULL_FROM_URL</span> domain — see
          API_Integration_Checklist #21c. Until then, post manually from the
          cards below.
        </p>
      ) : null}

      {loadFailed ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-xs text-terracotta-700"
        >
          Publish settings couldn&apos;t load right now (defaults shown). We&apos;ve
          logged the issue — saving may also fail until it clears.
        </p>
      ) : null}

      {/* All four checkboxes live in the ONE form — updatePublishSettings
          treats absent/unchecked as off. FB + IG (Phase A/B) and TikTok
          (Phase C) are all real toggles now. Enabling TikTok WITHOUT a token
          doesn't auto-post — it turns on the assisted-manual lane below
          (the audit-gated state); auto-post starts once TIKTOK_ACCESS_TOKEN
          lands on an audited app. */}
      <form
        action={updatePublishSettings}
        className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ink/10 pt-4"
      >
        <label className="flex items-center gap-2 text-xs font-medium text-ink/80">
          <input
            type="checkbox"
            name="autopublish_enabled"
            defaultChecked={settings.autopublish_enabled}
            className="h-4 w-4 rounded border-ink/30 accent-ink"
          />
          Autopublish (master)
        </label>
        <label className="flex items-center gap-2 text-xs text-ink/75">
          <input
            type="checkbox"
            name="facebook_enabled"
            defaultChecked={settings.facebook_enabled}
            className="h-4 w-4 rounded border-ink/30 accent-ink"
          />
          Facebook
        </label>
        <label className="flex items-center gap-2 text-xs text-ink/75">
          <input
            type="checkbox"
            name="instagram_enabled"
            defaultChecked={settings.instagram_enabled}
            className="h-4 w-4 rounded border-ink/30 accent-ink"
          />
          Instagram
        </label>
        <label
          className="flex items-center gap-2 text-xs text-ink/75"
          title="On with a token (audited app) → auto-posts the 9:16 card. On without one → the assisted-manual lane."
        >
          <input
            type="checkbox"
            name="tiktok_enabled"
            defaultChecked={settings.tiktok_enabled}
            className="h-4 w-4 rounded border-ink/30 accent-ink"
          />
          TikTok
        </label>
        <button type="submit" className="button-primary h-9 px-3 text-xs">
          Save
        </button>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// TikTok assisted-manual panel (the pre-audit working surface)
// ---------------------------------------------------------------------------

/**
 * TikTok — ready to post manually. Shown when tiktok_enabled is on but no
 * account token is present yet (an unaudited client can only post privately,
 * so we keep auto-posting inert). Each card is the 30-second manual-post
 * affordance: the 9:16 STORY card preview, the caption in a selectable block
 * (copy by selecting), and a "Download 9:16 card" link. The owner opens the
 * TikTok app, attaches the downloaded card as a Photo post, pastes the caption.
 */
function TikTokManualPanel({ posts }: { posts: SocialPostRow[] }) {
  // De-dupe (a post can be in both scheduled + published lists) and show the
  // most recent handful — these are the posts that went (or will go) to FB/IG
  // and the tiktok_enabled ones that need a manual TikTok push.
  const seen = new Set<string>();
  const items = posts
    .filter((p) => (seen.has(p.post_id) ? false : (seen.add(p.post_id), true)))
    .slice(0, 8);

  return (
    <section id="tiktok-manual" className="mb-8 space-y-3">
      <div className="space-y-0.5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          TikTok — ready to post manually · {items.length}
        </h2>
        <p className="text-xs text-ink/55">
          Auto-posting is gated until the app is audited. Until then: download
          the 9:16 card, open TikTok, attach it as a Photo post, paste the
          caption. ~30 seconds each.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink/20 bg-cream p-6 text-center text-sm text-ink/55">
          Nothing to post yet — composed posts appear here with their 9:16 card
          once the sweep has run.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((p) => (
            <li key={p.post_id}>
              <article className="space-y-3 rounded-xl border border-ink/10 bg-cream p-4">
                <header className="flex items-start gap-3">
                  {/* 9:16 STORY card preview — the exact image to attach. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={socialCardUrl(p.post_id, 'story')}
                    alt=""
                    width={45}
                    height={80}
                    className="shrink-0 rounded-md border border-ink/10 bg-cream object-cover"
                    style={{ width: 45, height: 80 }}
                  />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-sm font-semibold text-ink">
                      {p.title || firstLine(p.body) || 'Untitled post'}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                      {SOURCE_LABEL[p.source_type] ?? p.source_type} · 9:16
                    </p>
                  </div>
                  <SourceChip sourceType={p.source_type} />
                </header>

                {/* Caption in a selectable block — click selects all (CSS
                    select-all), copy by hand. A readOnly <textarea> in a
                    server component can't carry an onFocus handler, so the
                    select-all utility does the one-click selection instead. */}
                <pre className="max-h-40 select-all overflow-auto whitespace-pre-wrap rounded-md border border-ink/10 bg-ink/[0.03] px-3 py-2 font-sans text-xs text-ink/80">
                  {p.body}
                </pre>

                <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
                  <a
                    href={socialCardUrl(p.post_id, 'story')}
                    download={`setnayan-tiktok-${p.post_id}.jpg`}
                    className="button-primary inline-flex h-9 items-center px-3 text-xs"
                  >
                    Download 9:16 card
                  </a>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Scheduled post card
// ---------------------------------------------------------------------------

function ScheduledPostCard({ post, now }: { post: SocialPostRow; now: number }) {
  const publishing = post.status === 'publishing';
  const gateAt = post.publish_after ? new Date(post.publish_after).getTime() : null;
  const gateFuture = gateAt !== null && gateAt > now;
  const holdAt = post.hold_until ? new Date(post.hold_until).getTime() : null;
  const holdFuture = holdAt !== null && holdAt > now;
  const holdHours = holdFuture ? Math.max(1, Math.ceil((holdAt - now) / 3_600_000)) : 0;

  return (
    <article className="space-y-3 rounded-xl border border-ink/10 bg-cream p-4">
      <header className="flex items-start gap-3">
        <CardPreview postId={post.post_id} />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
          {post.title || firstLine(post.body) || 'Untitled post'}
        </p>
        <SourceChip sourceType={post.source_type} />
      </header>

      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
        {post.scheduled_for
          ? `slot ${formatPhInstant(post.scheduled_for)}`
          : 'awaiting a governor slot'}
        {holdFuture ? ` · auto-posts in ~${holdHours}h — pull to stop` : ''}
        {gateFuture ? ` · gated until ${formatPhDate(post.publish_after)}` : ''}
      </p>

      <pre className="whitespace-pre-wrap rounded-md border border-ink/10 bg-ink/[0.03] px-3 py-2 font-sans text-xs text-ink/80">
        {post.body}
      </pre>

      {publishing ? (
        <p className="animate-pulse font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
          publishing…
        </p>
      ) : (
        <>
          <details className="rounded-md border border-ink/10 bg-cream/60">
            <summary className="cursor-pointer px-3 py-2 text-xs text-ink/65">
              Edit copy…
            </summary>
            <form action={updateSocialPostBody} className="space-y-2 px-3 pb-3">
              <input type="hidden" name="post_id" value={post.post_id} />
              <input
                name="title"
                type="text"
                defaultValue={post.title}
                placeholder="Internal title"
                className="input-field h-9 w-full text-xs"
              />
              <textarea
                name="body"
                required
                rows={4}
                defaultValue={post.body}
                className="block w-full rounded-md border border-ink/20 bg-cream px-2 py-1 text-xs text-ink"
              />
              <button type="submit" className="button-primary h-9 px-3 text-xs">
                Save copy
              </button>
            </form>
          </details>

          <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
            <form action={pullSocialPost}>
              <input type="hidden" name="post_id" value={post.post_id} />
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-md border border-terracotta/30 bg-terracotta/5 px-3 text-xs text-terracotta-700 hover:bg-terracotta/15"
              >
                Pull
              </button>
            </form>
            {/* Post-now skips the hold window but NEVER the content gate —
                a couple's event-date + 7d is not overridable. */}
            {!gateFuture ? (
              <form action={postSocialPostNow}>
                <input type="hidden" name="post_id" value={post.post_id} />
                <button type="submit" className="button-primary h-9 px-3 text-xs">
                  Post now
                </button>
              </form>
            ) : null}
          </div>
        </>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Evergreen item card (edit-in-place form)
// ---------------------------------------------------------------------------

function EvergreenItemCard({ item }: { item: EvergreenItemRow }) {
  return (
    <article
      className={`space-y-3 rounded-xl border p-4 ${
        item.is_active ? 'border-ink/10 bg-cream' : 'border-ink/10 bg-cream opacity-60'
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-ink">{item.title}</p>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
            item.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-ink/8 text-ink/55'
          }`}
        >
          {item.is_active ? 'Active' : 'Inactive'}
        </span>
      </header>
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
        used {item.times_used}×
        {item.last_used_at ? ` · last ${formatPhDate(item.last_used_at)}` : ' · never used'}
      </p>
      <pre className="line-clamp-3 whitespace-pre-wrap rounded-md border border-ink/10 bg-ink/[0.03] px-3 py-2 font-sans text-xs text-ink/80">
        {item.body}
      </pre>
      <details className="rounded-md border border-ink/10 bg-cream/60">
        <summary className="cursor-pointer px-3 py-2 text-xs text-ink/65">Edit…</summary>
        <form action={saveEvergreenItem} className="space-y-2 px-3 pb-3">
          <input type="hidden" name="item_id" value={item.item_id} />
          <input
            name="title"
            type="text"
            required
            defaultValue={item.title}
            className="input-field h-9 w-full text-xs"
          />
          <textarea
            name="body"
            required
            rows={4}
            defaultValue={item.body}
            className="block w-full rounded-md border border-ink/20 bg-cream px-2 py-1 text-xs text-ink"
          />
          <input
            name="media_url"
            type="url"
            defaultValue={item.media_url ?? ''}
            placeholder="Image URL (optional)"
            className="input-field h-9 w-full text-xs"
          />
          <input
            name="link_url"
            type="url"
            defaultValue={item.link_url ?? ''}
            placeholder="Link URL (optional)"
            className="input-field h-9 w-full text-xs"
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-ink/75">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={item.is_active}
                className="h-4 w-4 rounded border-ink/30 accent-ink"
              />
              Active (in the rotation)
            </label>
            <button type="submit" className="button-primary h-9 px-3 text-xs">
              Save
            </button>
          </div>
        </form>
      </details>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

function SourceChip({ sourceType }: { sourceType: SocialSourceType }) {
  const tone = SOURCE_CHIP[sourceType] ?? 'bg-ink/8 text-ink/65';
  const label = SOURCE_LABEL[sourceType] ?? sourceType;
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${tone}`}
    >
      {label}
    </span>
  );
}

type PlatformLeg = {
  status?: string;
  post_url?: string | null;
  posted_at?: string | null;
  error?: string | null;
};

/** One platform's leg of platform_results — tolerant of any JSONB shape. */
function platformResult(platformResults: unknown, platform: string): PlatformLeg {
  if (
    platformResults &&
    typeof platformResults === 'object' &&
    platform in platformResults
  ) {
    const leg = (platformResults as Record<string, unknown>)[platform];
    if (leg && typeof leg === 'object') {
      return leg as PlatformLeg;
    }
  }
  return {};
}

/** Best dispatch error to surface on a failed card — FB, then IG, then the
 *  generic dispatch leg the catch-all stamps. */
function dispatchError(platformResults: unknown): string | null {
  return (
    platformResult(platformResults, 'facebook').error ||
    platformResult(platformResults, 'instagram').error ||
    platformResult(platformResults, 'dispatch').error ||
    null
  );
}

/**
 * Branded social-card preview thumbnail — pulls the live on-the-fly card from
 * /api/social/card/[postId]. Plain <img> (next/image's loader would 404-cache
 * a non-allowlisted same-origin dynamic route); the route caches hard.
 */
function CardPreview({ postId, size = 56 }: { postId: string; size?: number }) {
  // Plain <img>: live render of an internal dynamic route — next/image adds
  // nothing and its loader rejects a non-allowlisted same-origin route.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={socialCardUrl(postId)}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-md border border-ink/10 bg-cream object-cover"
      style={{ width: size, height: size }}
    />
  );
}

/** First non-empty line of a post body — compact-row display. */
function firstLine(body: string): string {
  return body.split('\n').find((l) => l.trim().length > 0)?.trim() ?? '';
}

/** Instant in PH wall-clock time, e.g. "Jun 13, 6:05 PM PHT". */
function formatPhInstant(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })} PHT`;
}

/** Date-only in PH time, e.g. "Jun 20, 2026". */
function formatPhDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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
  id,
  title,
  hint,
  count,
  empty,
  children,
}: {
  id?: string;
  title: string;
  hint: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-8 space-y-3">
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
  const success: Array<[keyof Awaited<Props['searchParams']>, string]> = [
    ['posted', 'Marked posted — the card left the queue.'],
    ['vendor_posted', 'Vendor feature marked posted — they won’t be queued again.'],
    ['taken_down', 'Take-down recorded. Thank you for keeping the 24-hour promise.'],
    ['settings_saved', 'Autopilot settings saved.'],
    ['pulled', 'Post pulled — it will not publish (and the sweep won’t recompose it).'],
    ['posted_now', 'Dispatched — check the Published section in a moment.'],
    ['retried', 'Post re-queued — the next flush re-dispatches it.'],
    ['body_saved', 'Post copy saved.'],
    ['announcement_created', 'Announcement queued at the next available slot.'],
    ['evergreen_saved', 'Evergreen item saved.'],
  ];
  for (const [flag, message] of success) {
    if (search[flag] === '1') {
      return (
        <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      );
    }
  }
  return null;
}
