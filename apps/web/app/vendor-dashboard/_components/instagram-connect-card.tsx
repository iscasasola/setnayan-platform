'use client';

import { useTransition } from 'react';
import Image from 'next/image';
import {
  Camera,
  RefreshCw,
  Eye,
  EyeOff,
  ExternalLink,
  Play,
  Link2,
  Unlink,
} from 'lucide-react';
import type {
  VendorIgConnectionStatus,
  VendorIgMediaRow,
} from '@/lib/vendor-instagram-status';
import {
  syncInstagramMediaAction,
  toggleInstagramMediaVisibility,
  disconnectInstagram,
} from '../instagram-actions';

/**
 * Vendor "Connect Instagram" card. Three states:
 *   • NOT configured (Meta App env unset) → "Coming soon" placeholder.
 *   • Configured + NOT connected           → Connect button (→ OAuth start).
 *   • Connected                            → username, Sync now, last-synced
 *     time, synced-media grid with per-item show/hide toggles, Disconnect.
 *
 * The access token never reaches this component — only status + media metadata.
 */
export function InstagramConnectCard({
  configured,
  connection,
  media,
  flash,
}: {
  configured: boolean;
  connection: VendorIgConnectionStatus | null;
  media: VendorIgMediaRow[];
  flash: { kind: 'ok' | 'error'; message: string } | null;
}) {
  return (
    <section className="mt-10 space-y-4">
      <div className="space-y-1">
        <h2 className="m-label-mono flex items-center gap-2" style={{ color: 'var(--m-slate)' }}>
          <Camera aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Instagram
        </h2>
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          Connect your Business or Creator Instagram account and sync your recent
          posts straight into your public portfolio. Photos are copied to
          Setnayan so they keep showing even after Instagram&rsquo;s links expire;
          videos link back to your post.
        </p>
      </div>

      {flash ? (
        <div
          role="status"
          className={`rounded-lg border px-3 py-2 text-sm ${
            flash.kind === 'ok'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-amber-300 bg-amber-50 text-amber-800'
          }`}
        >
          {flash.message}
        </div>
      ) : null}

      {!configured ? (
        <ComingSoon />
      ) : !connection ? (
        <NotConnected />
      ) : (
        <Connected connection={connection} media={media} />
      )}
    </section>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="space-y-4 rounded-2xl p-5"
      style={{
        background: 'var(--m-paper)',
        border: '1px solid var(--m-hairline, rgba(0,0,0,0.08))',
      }}
    >
      {children}
    </div>
  );
}

function ComingSoon() {
  return (
    <CardShell>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/5 text-ink/50">
          <Camera aria-hidden className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium text-ink">Coming soon</p>
          <p className="text-sm text-ink/60">
            Instagram sync requires a Business or Creator Instagram account and
            is being finished by the Setnayan team. Check back soon.
          </p>
        </div>
      </div>
    </CardShell>
  );
}

function NotConnected() {
  return (
    <CardShell>
      <p className="text-sm text-ink/60">
        You haven&rsquo;t connected Instagram yet. You&rsquo;ll be sent to
        Instagram to approve access, then you can sync your posts.
      </p>
      {/* A plain link → the OAuth start route (a server-side 302 redirect to
          Meta, NOT a Next page) so <Link> prefetch/routing doesn't apply. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/api/vendor/instagram/connect"
        className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream transition-opacity hover:opacity-90"
      >
        <Link2 aria-hidden className="h-4 w-4" strokeWidth={2} />
        Connect Instagram
      </a>
    </CardShell>
  );
}

function Connected({
  connection,
  media,
}: {
  connection: VendorIgConnectionStatus;
  media: VendorIgMediaRow[];
}) {
  const [syncing, startSync] = useTransition();
  const lastSynced = connection.lastSyncedAt
    ? new Date(connection.lastSyncedAt).toLocaleString()
    : null;

  return (
    <CardShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium text-ink">
            Connected{connection.igUsername ? ` · @${connection.igUsername}` : ''}
          </p>
          <p className="text-xs text-ink/55">
            {lastSynced ? `Last synced ${lastSynced}` : 'Not synced yet'}
          </p>
          {connection.status === 'error' && connection.statusDetail ? (
            <p className="text-xs text-amber-700">{connection.statusDetail}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={syncing}
            onClick={() => startSync(() => syncInstagramMediaAction())}
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink/30 disabled:opacity-60"
          >
            <RefreshCw
              aria-hidden
              className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`}
              strokeWidth={2}
            />
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
          <form action={disconnectInstagram}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-ink/55 transition-colors hover:text-ink"
              title="Disconnect Instagram and remove synced posts"
            >
              <Unlink aria-hidden className="h-4 w-4" strokeWidth={2} />
              Disconnect
            </button>
          </form>
        </div>
      </div>

      {media.length === 0 ? (
        <p className="text-sm text-ink/55">
          No posts synced yet. Press <span className="font-medium">Sync now</span>{' '}
          to pull your latest Instagram posts.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {media.map((m) => (
            <MediaTile key={m.id} item={m} />
          ))}
        </div>
      )}
    </CardShell>
  );
}

function MediaTile({ item }: { item: VendorIgMediaRow }) {
  return (
    <div
      className={`group relative aspect-square overflow-hidden rounded-xl bg-ink/5 ${
        item.showOnProfile ? '' : 'opacity-45'
      }`}
    >
      {item.displayUrl ? (
        <Image
          src={item.displayUrl}
          alt={item.caption?.slice(0, 80) ?? 'Instagram post'}
          fill
          sizes="(max-width: 640px) 50vw, 33vw"
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-ink/30">
          <Camera aria-hidden className="h-6 w-6" strokeWidth={1.5} />
        </div>
      )}

      {item.mediaType === 'VIDEO' ? (
        <span className="absolute left-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white">
          <Play aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      ) : null}

      {/* Per-item show/hide toggle — its own tiny server-action form. */}
      <form
        action={toggleInstagramMediaVisibility}
        className="absolute right-2 top-2"
      >
        <input type="hidden" name="vendor_ig_media_id" value={item.id} />
        <button
          type="submit"
          title={item.showOnProfile ? 'Hide from your portfolio' : 'Show on your portfolio'}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
        >
          {item.showOnProfile ? (
            <Eye aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          ) : (
            <EyeOff aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          )}
        </button>
      </form>

      {item.permalink ? (
        <a
          href={item.permalink}
          target="_blank"
          rel="noopener noreferrer nofollow"
          title="Open on Instagram"
          className="absolute bottom-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity hover:bg-black/75 group-hover:opacity-100"
        >
          <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </a>
      ) : null}
    </div>
  );
}
