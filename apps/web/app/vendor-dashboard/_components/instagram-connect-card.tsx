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
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';

/**
 * Vendor "Connect Instagram" card. Three states:
 *   • NOT configured (Meta App env unset) → renders NOTHING (2026-11-05; it
 *     used to show a "Coming soon" card, which read as an unfinished product).
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
  // Not configured → nothing to connect, so nothing is shown.
  if (!configured) return null;

  return (
    <section className="mt-10 space-y-4">
      {/* Template rule 2 + 7: a grey capitals label, the how-it-works behind its ⓘ. */}
      <InfoTip
        label="Instagram"
        labelAs="h2"
        align="start"
        labelClassName="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]"
      >
        Connect your Business or Creator Instagram account and sync your recent posts straight into your public
        portfolio. Photos are copied to Setnayan so they keep showing even after Instagram&rsquo;s links expire; videos
        link back to your post.
      </InfoTip>

      {flash ? (
        <div
          role="status"
          className={`py-1 text-sm ${
            flash.kind === 'ok' ? 'text-[rgb(var(--color-ok))]' : 'text-[rgb(var(--color-warn))]'
          }`}
        >
          {flash.message}
        </div>
      ) : null}

      {!connection ? (
        <NotConnected />
      ) : (
        <Connected connection={connection} media={media} />
      )}
    </section>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 border-t border-[color:var(--m-line)] pt-4">
      {children}
    </div>
  );
}

function NotConnected() {
  return (
    <CardShell>
      <InfoTip label="You haven&rsquo;t connected Instagram yet" align="start" labelClassName="text-sm text-[color:var(--m-slate-2)]">
        You&rsquo;ll be sent to Instagram to approve access, then you can sync your posts.
      </InfoTip>
      {/* A plain link → the OAuth start route (a server-side 302 redirect to
          Meta, NOT a Next page) so <Link> prefetch/routing doesn't apply. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/api/vendor/instagram/connect"
        className={actionButtonClass('brand')}
      >
        <Link2 aria-hidden strokeWidth={1.9} />
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
          <p className="text-xs text-[color:var(--m-slate-2)]">
            {lastSynced ? `Last synced ${lastSynced}` : 'Not synced yet'}
          </p>
          {connection.status === 'error' && connection.statusDetail ? (
            <p className="text-xs text-[rgb(var(--color-warn))]">{connection.statusDetail}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <ActionButton
            tone="neutral"
            icon={RefreshCw}
            label={syncing ? 'Syncing…' : 'Sync now'}
            disabled={syncing}
            onClick={() => startSync(() => syncInstagramMediaAction())}
          />
          <form action={disconnectInstagram}>
            <ActionButton
              type="submit"
              tone="danger"
              quiet
              icon={Unlink}
              label="Disconnect"
              title="Disconnect Instagram and remove synced posts"
            />
          </form>
        </div>
      </div>

      {media.length === 0 ? (
        <p className="py-3 text-[14px] text-[color:var(--m-slate-2)]">
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
        <div className="flex h-full w-full items-center justify-center text-[color:var(--m-slate-2)]">
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
