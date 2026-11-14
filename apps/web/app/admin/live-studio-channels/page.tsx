import { notFound } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { Fold } from '@/app/_components/fold';
import { InfoTip } from '@/app/_components/info-tip';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { requireAdmin } from '@/lib/admin/require-admin';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { SubmitButton } from '@/app/_components/submit-button';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import { POOL_CHANNEL_SHARED_STRIKE_NOTICE } from '@/lib/live-studio-pool-only';
import { getYoutubeOAuthConfig } from '@/lib/panood-youtube';
import {
  fetchPoolChannelGrants,
  type PoolChannelGrantView,
} from '@/lib/live-studio-channel-grants';
import {
  disconnectChannel,
  releaseChannel,
  setChannelCap,
  setChannelLabel,
  setChannelStatus,
  setChannelVerified,
} from './actions';
import { formatCount } from '@/lib/format-number';
import { Badge, Facts, One, Row, Rows } from '@/app/admin/app-performance/_components/insights-parts';

/**
 * The press tones (T19), tokens only. Every action keeps exactly the step it had — a plain submit, no confirm added.
 * Drawn to the approved Insights drawing (admin_pub/insights.html › Costs › Setnayan channel pool): the two
 * explanations in ⓘ, the prerequisites in one fold, one fold per channel holding its facts, its two fields and its
 * presses — frames only on what you press.
 */
const PRESS = 'inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors';
const BTN_NEUTRAL = `${PRESS} border border-ink/15 text-ink hover:bg-ink/[0.03]`;
const BTN_WARN = `${PRESS} border border-[var(--sn-warning)] text-[var(--sn-warning-deep)] hover:bg-[var(--sn-warning-soft)]`;
const BTN_DANGER = `${PRESS} border border-[var(--sn-danger)] text-[var(--sn-danger)] hover:bg-[var(--sn-danger-soft)]`;
const BTN_BRAND = `${PRESS} bg-[var(--sn-accent)] text-[var(--sn-on-accent)] hover:opacity-90`;
const FIELD = 'h-11 rounded-lg border border-ink/15 bg-transparent px-3 text-sm text-ink';


/**
 * ADMIN → Live Studio channels. WAVE 9 · Live_Studio_Unified_Spec § 4h.
 *
 * The ops board for the SETNAYAN-OWNED YouTube channel pool. Every event streams
 * on a channel from here; couples never connect a Google account, which is what
 * lets the consent screen be Internal and removes Google app verification.
 *
 * ── FLAG-DARK, PROVABLY ────────────────────────────────────────────────────
 * `notFound()` when the flag is off, and the nav entry is conditional on the same
 * flag — so with the flag off this route does not exist and nothing links to it.
 *
 * ── WHAT IS DELIBERATELY NOT ON THIS PAGE ──────────────────────────────────
 * A token, in any form. The grants table has RLS on and no policy; this page
 * renders `PoolChannelGrantView`, which has no token field. There is no "reveal
 * credentials" affordance for admins either — an admin needs to know a channel is
 * CONNECTED and HEALTHY, never what the secret is.
 */

export const metadata = { title: 'Live Watch channels · Admin' };
export const dynamic = 'force-dynamic';

type PoolRow = {
  id: number;
  youtube_channel_id: string;
  label: string | null;
  status: 'available' | 'checked_out' | 'maintenance' | 'retired';
  checked_out_event_id: string | null;
  checked_out_at: string | null;
  verified: boolean;
  concurrent_cap: number;
};

function ago(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return 'under an hour ago';
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function grantSummary(grant: PoolChannelGrantView | undefined): {
  text: string;
  tone: 'ok' | 'warn' | 'bad';
} {
  if (!grant || !grant.connected) return { text: 'Not connected', tone: 'bad' };
  if (grant.health === 'needs_reauth') return { text: 'Needs re-connect', tone: 'warn' };
  return { text: `Connected${grant.displayName ? ` · ${grant.displayName}` : ''}`, tone: 'ok' };
}

export default async function LiveStudioChannelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  if (!liveStudioRoamEnabled()) notFound();

  const sp = await searchParams;
  const flashError = typeof sp.error === 'string' ? sp.error : null;
  const connected = sp.connected === '1';
  const released = sp.released === '1';
  const disconnected = sp.disconnected === '1';

  const admin = createAdminClient();
  const oauth = await getYoutubeOAuthConfig();

  const { data, error } = await admin
    .from('live_studio_roam_channel_pool')
    .select('id, youtube_channel_id, label, status, checked_out_event_id, checked_out_at, verified, concurrent_cap')
    .order('id', { ascending: true });
  // The refusal's own words go to the log, not the screen — they name a column.
  if (error) logQueryError('LiveStudioChannelsPage (channel pool)', error);
  const rows = (data ?? []) as PoolRow[];
  const grants = await fetchPoolChannelGrants(admin);

  // Event titles for the checked-out rows — one query, not one per row.
  const heldEventIds = rows.map((r) => r.checked_out_event_id).filter((v): v is string => Boolean(v));
  const eventNames = new Map<string, string>();
  if (heldEventIds.length > 0) {
    const { data: evts } = await admin
      .from('events')
      .select('event_id, display_name')
      .in('event_id', heldEventIds);
    for (const e of (evts ?? []) as Array<{ event_id: string; display_name: string | null }>) {
      eventNames.set(e.event_id, e.display_name ?? e.event_id);
    }
  }

  const readyCount = rows.filter(
    (r) => r.verified && r.status === 'available' && grants.get(r.id)?.connected,
  ).length;


  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      {/* The page starts at its content.
          ⚖ The sentence survives: it is the reason this pool exists at all —
          couples never connect a Google account, which is what lets our
          consent screen stay Internal and skip Google app verification.
          Somebody about to "simplify" this by asking couples to connect their
          own channel needs to meet that sentence first. It now lives in the
          first ⓘ, whose label says the rule in six words. */}
      <PageMasthead title="Setnayan channel pool" />
      <One
        label="One channel per event, then returned"
        extra={
          // 🚨 THE COST OF "then returned", stated where the placement decision is made.
          // live-studio-roam-provision.ts has said since Wave 9 that one channel per
          // event "isolates concurrency + copyright-strike blast radius" — in a
          // DOCBLOCK, where no admin has ever read it. Reuse is what creates the shared
          // jeopardy: a strike earned by one wedding's processional lands on a channel
          // still holding other couples' archives, and YouTube's penalty at three is
          // termination of the channel with every video on it. The admin choosing which
          // event goes on which channel is the person who creates that exposure, so the
          // sentence belongs here and not only on the buy sheet. Its label is visible,
          // in the warning colour; the whole notice is its ⓘ.
          // ⚠ Whether a channel should instead be retired after one wedding rather than
          // checked back in is an OWNER ruling, deliberately not made in code.
          <span className="inline-flex items-center gap-1 text-[var(--sn-warning-deep)]" data-strike-notice="">
            <AlertCircle aria-hidden className="h-4 w-4" strokeWidth={2} />
            <InfoTip label="Strikes hit every couple on it" align="start">
              {POOL_CHANNEL_SHARED_STRIKE_NOTICE}
            </InfoTip>
          </span>
        }
      >
        Every Live Watch event streams on a Setnayan-owned YouTube channel from this pool. Couples never connect a
        Google account — which is why our consent screen can stay Internal and needs no Google app verification. One
        channel is checked out per event, then returned.
      </One>

      <div className="mt-3">
        {flashError ? <FormFlash tone="error">{flashError}</FormFlash> : null}
        {connected ? <FormFlash tone="success">Channel connected.</FormFlash> : null}
        {released ? <FormFlash tone="success">Channel returned to the pool.</FormFlash> : null}
        {disconnected ? <FormFlash tone="success">Channel disconnected.</FormFlash> : null}
        {error ? (
          <FormFlash tone="error">
            Couldn&rsquo;t read the channel pool, so the list below is not a count of what is in it. Refresh to try again.
          </FormFlash>
        ) : null}
      </div>

      {/* ── Platform prerequisites. Stated as facts, never assumed — one fold, its summary the OAuth state. ── */}
      <div className="border-y border-ink/10" data-pool-prereq="">
        <Fold
          title="Before any of this can work"
          summary={`Google OAuth client: ${oauth.ready ? 'configured' : 'missing'} · G1 · G4 · the encoder`}
          data="pool-prereq"
        >
          <Rows label="Before any of this can work">
            <Row
              title="Google OAuth client"
              tone={oauth.ready ? undefined : 'warn'}
              sub={
                oauth.ready
                  ? 'configured.'
                  : `missing ${oauth.missing.join(', ')} — set these before connecting a channel.`
              }
              trail={oauth.ready ? <Badge tone="ok">✓</Badge> : <Badge tone="warn">missing</Badge>}
            />
            <li className="border-t border-ink/10 py-2.5 text-[14px] text-ink/70">
              <strong className="font-semibold text-ink">G1 (owner, once):</strong> create the Setnayan channel, verify
              it, and enable live streaming — YouTube imposes a <strong className="font-semibold text-ink">24-hour wait</strong>{' '}
              before the first stream. Setnayan cannot detect this; tick <em>Verified</em> only after confirming it in
              YouTube Studio.
            </li>
            <li className="border-t border-ink/10 py-2.5 text-[14px] text-ink/70">
              <strong className="font-semibold text-ink">G4:</strong> YouTube Data API quota caps us at roughly 12–15
              weddings a day. File for an increase early.
            </li>
            <li className="flex items-start gap-2 border-t border-ink/10 py-2.5 text-[14px] text-ink/70">
              <AlertCircle aria-hidden className="mt-px h-4 w-4 shrink-0 text-[var(--sn-warning)]" strokeWidth={1.75} />
              <span>
                <strong className="font-semibold text-ink">This does not make Live Watch turnkey.</strong> Connecting a
                channel removes the couple&rsquo;s need for a YouTube account. It does <em>not</em> remove the encoder:
                browsers cannot push RTMP and the native capture app was never built, so the couple&rsquo;s own OBS
                still has to window-capture the program output and send it to YouTube.
              </span>
            </li>
          </Rows>
        </Fold>
      </div>

      <p className="mb-1 mt-4 text-[13px] text-ink/65" data-pool-count="">
        {error ? '—' : `${rows.length} channel${rows.length === 1 ? '' : 's'} · ${formatCount(readyCount)} ready to claim`}
      </p>

      {error ? null : rows.length === 0 ? (
        <p className="border-t border-ink/10 py-6 text-center text-sm text-ink/55">
          No channels in the pool yet. Connect one to get started.
        </p>
      ) : null}

      <ul className="[&>li:first-child]:border-t-0" aria-label="Channels in the pool">
        {rows.map((row) => {
          const grant = grants.get(row.id);
          const summary = grantSummary(grant);
          const held = row.status === 'checked_out';
          const orphaned = held && !row.checked_out_event_id;
          const name = row.label ?? `Channel #${row.id}`;
          const statusLine = `${summary.text} · ${row.verified ? 'Verified' : 'Not verified'} · ${row.status} · cap ${row.concurrent_cap}`;
          const heldLine = held
            ? orphaned
              ? 'Checked out with no event (the event was deleted) — release it.'
              : `Held by ${eventNames.get(row.checked_out_event_id as string) ?? row.checked_out_event_id} since ${ago(row.checked_out_at)}`
            : null;
          const ready = row.verified && row.status === 'available' && Boolean(grant?.connected);
          return (
            <li key={row.id} className="border-t border-ink/10" data-pool-channel={row.id}>
              <Fold
                title={name}
                line={heldLine ? `${statusLine} · ${heldLine}` : statusLine}
                aside={
                  held ? (
                    <Badge tone="warn">held</Badge>
                  ) : row.status === 'maintenance' ? (
                    <Badge>maintenance</Badge>
                  ) : row.status === 'retired' ? (
                    <Badge>retired</Badge>
                  ) : ready ? (
                    <Badge tone="ok">ready</Badge>
                  ) : (
                    <Badge>{row.status}</Badge>
                  )
                }
                data="pool-channel"
              >
                <Facts
                  rows={[
                    ['YouTube id', <span key="id" className="font-mono text-[13px]">{row.youtube_channel_id}</span>],
                    [
                      'Connection',
                      <span
                        key="conn"
                        className={
                          summary.tone === 'ok'
                            ? 'text-[var(--sn-success-deep)]'
                            : summary.tone === 'warn'
                              ? 'text-[var(--sn-warning-deep)]'
                              : 'text-ink/55'
                        }
                      >
                        {summary.text}
                      </span>,
                    ],
                    ['Status', `${row.verified ? 'Verified' : 'Not verified'} · ${row.status} · cap ${row.concurrent_cap}`],
                    ...(heldLine
                      ? ([
                          [
                            orphaned ? 'Checked out' : 'Held by',
                            <span key="held" className={orphaned ? 'text-[var(--sn-warning-deep)]' : undefined}>
                              {orphaned
                                ? heldLine
                                : `${eventNames.get(row.checked_out_event_id as string) ?? row.checked_out_event_id} · since ${ago(row.checked_out_at)}`}
                            </span>,
                          ],
                        ] as [string, React.ReactNode][])
                      : []),
                  ]}
                />

                <form action={setChannelLabel} className="flex flex-wrap items-center gap-2 border-t border-ink/10 py-2.5">
                  <input type="hidden" name="channel_pool_id" value={row.id} />
                  <label className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-[15px] font-medium text-ink">
                    <span>Nickname</span>
                    <input name="label" defaultValue={row.label ?? ''} maxLength={80} className={`${FIELD} w-44`} />
                  </label>
                  <SubmitButton overlay={false} className={BTN_NEUTRAL}>
                    Save
                  </SubmitButton>
                </form>

                <form action={setChannelCap} className="flex flex-wrap items-center gap-2 border-t border-ink/10 py-2.5">
                  <input type="hidden" name="channel_pool_id" value={row.id} />
                  <label className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-[15px] font-medium text-ink">
                    <span>Max concurrent streams</span>
                    <input
                      name="concurrent_cap"
                      type="number"
                      min={1}
                      max={50}
                      defaultValue={row.concurrent_cap}
                      className={`${FIELD} w-20`}
                    />
                  </label>
                  <SubmitButton overlay={false} className={BTN_NEUTRAL}>
                    Save
                  </SubmitButton>
                </form>

                <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 py-3">
                  {/* A GET link, not a form: /pool/start is admin-guarded and redirects to
                      Google. It is a route handler, not a page. */}
                  {grant?.connected && grant.health === 'needs_reauth' ? (
                    // eslint-disable-next-line @next/next/no-html-link-for-pages
                    <a href={`/api/oauth/youtube/pool/start?channel_pool_id=${row.id}`} className={BTN_WARN}>
                      Re-connect
                    </a>
                  ) : null}
                  {!grant?.connected ? (
                    // eslint-disable-next-line @next/next/no-html-link-for-pages
                    <a href={`/api/oauth/youtube/pool/start?channel_pool_id=${row.id}`} className={BTN_BRAND}>
                      Connect
                    </a>
                  ) : null}

                  <form action={setChannelVerified}>
                    <input type="hidden" name="channel_pool_id" value={row.id} />
                    <input type="hidden" name="verified" value={row.verified ? '0' : '1'} />
                    <SubmitButton overlay={false} className={BTN_NEUTRAL}>
                      {row.verified ? 'Un-verify' : 'Mark verified'}
                    </SubmitButton>
                  </form>

                  {held ? (
                    <form action={releaseChannel}>
                      <input type="hidden" name="channel_pool_id" value={row.id} />
                      <SubmitButton overlay={false} className={BTN_WARN}>
                        Release
                      </SubmitButton>
                    </form>
                  ) : (
                    <form action={setChannelStatus}>
                      <input type="hidden" name="channel_pool_id" value={row.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={row.status === 'available' ? 'maintenance' : 'available'}
                      />
                      <SubmitButton overlay={false} className={BTN_NEUTRAL}>
                        {row.status === 'available' ? 'Take out of service' : 'Return to service'}
                      </SubmitButton>
                    </form>
                  )}

                  {grant?.connected ? (
                    <form action={disconnectChannel}>
                      <input type="hidden" name="channel_pool_id" value={row.id} />
                      <SubmitButton overlay={false} className={BTN_DANGER}>
                        Disconnect
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              </Fold>
            </li>
          );
        })}
      </ul>

      <div className="mt-4">
        {/* A GET link, not a form: /pool/start is admin-guarded and redirects to
            Google. It is a route handler, not a page, so next/link is wrong here —
            same exception the other OAuth "Connect" CTAs take. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/oauth/youtube/pool/start" className={BTN_BRAND}>
          Connect a Setnayan channel
        </a>
      </div>
    </div>
  );
}
