import { notFound } from 'next/navigation';
import { AlertCircle, Radio } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { createAdminClient } from '@/lib/supabase/admin';
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

export const metadata = { title: 'Live Studio channels · Admin' };
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
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      {/* The page starts at its content.
          ⚖ The sentence survives: it is the reason this pool exists at all —
          couples never connect a Google account, which is what lets our
          consent screen stay Internal and skip Google app verification.
          Somebody about to "simplify" this by asking couples to connect their
          own channel needs to meet that sentence first. */}
      <PageMasthead title="Setnayan channel pool" />
      <div className="mb-6">
        <p className="max-w-2xl text-sm text-ink/70">
          Every Live Studio event streams on a Setnayan-owned YouTube channel from this pool. Couples
          never connect a Google account — which is why our consent screen can stay{' '}
          <strong className="font-semibold text-ink/80">Internal</strong> and needs no Google app
          verification. One channel is checked out per event, then returned.
        </p>
        {/* 🚨 THE COST OF "then returned", stated where the placement decision is made.
            live-studio-roam-provision.ts has said since Wave 9 that one channel per
            event "isolates concurrency + copyright-strike blast radius" — in a
            DOCBLOCK, where no admin has ever read it. Reuse is what creates the shared
            jeopardy: a strike earned by one wedding's processional lands on a channel
            still holding other couples' archives, and YouTube's penalty at three is
            termination of the channel with every video on it. The admin choosing which
            event goes on which channel is the person who creates that exposure, so the
            sentence belongs here and not only on the buy sheet.
            ⚠ Whether a channel should instead be retired after one wedding rather than
            checked back in is an OWNER ruling, deliberately not made in code. */}
        <p className="mt-3 max-w-2xl rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2.5 text-sm text-ink/80">
          <AlertCircle aria-hidden className="mr-1.5 inline h-4 w-4 -translate-y-px text-amber-600" strokeWidth={2} />
          {POOL_CHANNEL_SHARED_STRIKE_NOTICE}
        </p>
      </div>

      {flashError ? <FormFlash tone="error">{flashError}</FormFlash> : null}
      {connected ? <FormFlash tone="success">Channel connected.</FormFlash> : null}
      {released ? <FormFlash tone="success">Channel returned to the pool.</FormFlash> : null}
      {disconnected ? <FormFlash tone="success">Channel disconnected.</FormFlash> : null}
      {error ? (
        <FormFlash tone="error">Could not read the channel pool: {error.message}</FormFlash>
      ) : null}

      {/* ── Platform prerequisites. Stated as facts, never assumed. ───────── */}
      <section className="mb-6 rounded-xl border border-ink/15 bg-ink/[0.03] px-4 py-3 text-sm">
        <p className="font-semibold text-ink">Before any of this can work</p>
        <ul className="mt-2 space-y-1.5 text-ink/70">
          <li>
            <strong className="font-semibold text-ink/80">Google OAuth client:</strong>{' '}
            {oauth.ready ? (
              'configured.'
            ) : (
              <span className="text-terracotta-700">
                missing {oauth.missing.join(', ')} — set these before connecting a channel.
              </span>
            )}
          </li>
          <li>
            <strong className="font-semibold text-ink/80">G1 (owner, once):</strong> create the
            Setnayan channel, verify it, and enable live streaming — YouTube imposes a{' '}
            <strong className="font-semibold text-ink/80">24-hour wait</strong> before the first
            stream. Setnayan cannot detect this; tick <em>Verified</em> only after confirming it in
            YouTube Studio.
          </li>
          <li>
            <strong className="font-semibold text-ink/80">G4:</strong> YouTube Data API quota caps us
            at roughly 12–15 weddings a day. File for an increase early.
          </li>
          <li className="flex items-start gap-2 pt-1 text-ink/70">
            <AlertCircle aria-hidden className="mt-px h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
            <span>
              <strong className="font-semibold text-ink/80">This does not make Live Studio turnkey.</strong>{' '}
              Connecting a channel removes the couple&rsquo;s need for a YouTube account. It does{' '}
              <em>not</em> remove the encoder: browsers cannot push RTMP and the native capture app was
              never built, so the couple&rsquo;s own OBS still has to window-capture the program output
              and send it to YouTube.
            </span>
          </li>
        </ul>
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink/65">
          <Radio aria-hidden className="mr-1.5 inline h-4 w-4 text-ink/40" strokeWidth={1.75} />
          {rows.length} channel{rows.length === 1 ? '' : 's'} · {readyCount} ready to claim
        </p>
        {/* A GET link, not a form: /pool/start is admin-guarded and redirects to
            Google. It is a route handler, not a page, so next/link is wrong here —
            same exception the other OAuth "Connect" CTAs take. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/oauth/youtube/pool/start"
          className="rounded-md border border-ink/20 bg-ink px-4 py-2 text-sm font-semibold text-cream hover:bg-ink/90"
        >
          Connect a Setnayan channel
        </a>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink/20 px-4 py-8 text-center text-sm text-ink/55">
          No channels in the pool yet. Connect one to get started.
        </p>
      ) : null}

      <ul className="space-y-3">
        {rows.map((row) => {
          const grant = grants.get(row.id);
          const summary = grantSummary(grant);
          const held = row.status === 'checked_out';
          const orphaned = held && !row.checked_out_event_id;
          return (
            <li key={row.id} className="rounded-xl border border-ink/15 bg-cream px-4 py-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{row.label ?? `Channel #${row.id}`}</p>
                  <p className="mt-0.5 font-mono text-xs text-ink/50">{row.youtube_channel_id}</p>
                  <p className="mt-1 text-xs text-ink/65">
                    <span
                      className={
                        summary.tone === 'ok'
                          ? 'text-success-800'
                          : summary.tone === 'warn'
                            ? 'text-terracotta-700'
                            : 'text-ink/55'
                      }
                    >
                      {summary.text}
                    </span>
                    {' · '}
                    {row.verified ? 'Verified' : 'Not verified'}
                    {' · '}
                    {row.status}
                    {' · cap '}
                    {row.concurrent_cap}
                  </p>
                  {held ? (
                    <p className="mt-1 text-xs text-ink/65">
                      {orphaned ? (
                        <span className="text-terracotta-700">
                          Checked out with no event (the event was deleted) — release it.
                        </span>
                      ) : (
                        <>
                          Held by{' '}
                          <strong className="font-semibold text-ink/80">
                            {eventNames.get(row.checked_out_event_id as string) ?? row.checked_out_event_id}
                          </strong>{' '}
                          since {ago(row.checked_out_at)}
                        </>
                      )}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {grant?.connected && grant.health === 'needs_reauth' ? (
                    <a
                      href={`/api/oauth/youtube/pool/start?channel_pool_id=${row.id}`}
                      className="rounded-md border border-terracotta/40 px-3 py-1.5 text-xs font-semibold text-terracotta-700"
                    >
                      Re-connect
                    </a>
                  ) : null}
                  {!grant?.connected ? (
                    <a
                      href={`/api/oauth/youtube/pool/start?channel_pool_id=${row.id}`}
                      className="rounded-md border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink/75"
                    >
                      Connect
                    </a>
                  ) : null}

                  <form action={setChannelVerified}>
                    <input type="hidden" name="channel_pool_id" value={row.id} />
                    <input type="hidden" name="verified" value={row.verified ? '0' : '1'} />
                    <SubmitButton
                      overlay={false}
                      className="rounded-md border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink/75"
                    >
                      {row.verified ? 'Un-verify' : 'Mark verified'}
                    </SubmitButton>
                  </form>

                  {held ? (
                    <form action={releaseChannel}>
                      <input type="hidden" name="channel_pool_id" value={row.id} />
                      <SubmitButton
                        overlay={false}
                        className="rounded-md border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink/75"
                      >
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
                      <SubmitButton
                        overlay={false}
                        className="rounded-md border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink/75"
                      >
                        {row.status === 'available' ? 'Take out of service' : 'Return to service'}
                      </SubmitButton>
                    </form>
                  )}

                  {grant?.connected ? (
                    <form action={disconnectChannel}>
                      <input type="hidden" name="channel_pool_id" value={row.id} />
                      <SubmitButton
                        overlay={false}
                        className="rounded-md border border-terracotta/40 px-3 py-1.5 text-xs font-semibold text-terracotta-700"
                      >
                        Disconnect
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-4 border-t border-ink/10 pt-3">
                <form action={setChannelLabel} className="flex items-end gap-2">
                  <input type="hidden" name="channel_pool_id" value={row.id} />
                  <label className="text-xs text-ink/60">
                    <span className="mb-1 block">Nickname</span>
                    <input
                      name="label"
                      defaultValue={row.label ?? ''}
                      maxLength={80}
                      className="w-44 rounded-md border border-ink/20 px-2 py-1 text-xs text-ink"
                    />
                  </label>
                  <SubmitButton
                    overlay={false}
                    className="rounded-md border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink/75"
                  >
                    Save
                  </SubmitButton>
                </form>

                <form action={setChannelCap} className="flex items-end gap-2">
                  <input type="hidden" name="channel_pool_id" value={row.id} />
                  <label className="text-xs text-ink/60">
                    <span className="mb-1 block">Max concurrent streams</span>
                    <input
                      name="concurrent_cap"
                      type="number"
                      min={1}
                      max={50}
                      defaultValue={row.concurrent_cap}
                      className="w-20 rounded-md border border-ink/20 px-2 py-1 text-xs text-ink"
                    />
                  </label>
                  <SubmitButton
                    overlay={false}
                    className="rounded-md border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink/75"
                  >
                    Save
                  </SubmitButton>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
