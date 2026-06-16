import Link from 'next/link';
import type { ReactNode } from 'react';
import { CloudUpload, RefreshCw, ShieldCheck } from 'lucide-react';

/**
 * Shared, point-of-need Google Drive connect UI (0009 Photo Delivery + 0012
 * Papic). Three pieces, all presentational server components, reused verbatim
 * across the surfaces where a couple reaches for their photos:
 *
 *   DriveSafetyPanel    — the drive.file reassurance that pre-empts Google's
 *                         scary consent screen ("lists a lot of permissions —
 *                         that's normal"). The single highest-leverage trust
 *                         lever in the whole flow, since the consent screen is
 *                         where couples actually abandon.
 *   DriveConnectCard    — the NOT-CONNECTED prompt: benefit headline + body +
 *                         safety panel + connect CTA + a defer path. Drive is
 *                         always framed as an additive "own copy", never a gate
 *                         — the photos already live in Setnayan.
 *   DriveReconnectBanner — the BROKEN / needs_reauth state: calm champagne-gold
 *                         (not alarming red — recoverable, not the couple's
 *                         fault) "reconnect" prompt.
 *
 * This PR wires DriveConnectCard + DriveReconnectBanner onto the Photo Delivery
 * panel. The same components drop into the Papic storage radio + the Recap
 * nudge in the follow-up surfaces.
 */

/* -------------------------------------------------------------------------- */
/*  DriveSafetyPanel — drive.file reassurance                                 */
/* -------------------------------------------------------------------------- */

export function DriveSafetyPanel({
  variant = 'full',
}: {
  variant?: 'full' | 'condensed';
}) {
  if (variant === 'condensed') {
    return (
      <p className="flex items-start gap-2 text-xs leading-snug text-ink/65">
        <ShieldCheck
          aria-hidden
          className="mt-0.5 h-3.5 w-3.5 flex-none text-terracotta"
          strokeWidth={1.75}
        />
        <span>
          Setnayan only ever sees the folder it creates — Google&rsquo;s most
          limited access (<span className="font-mono">drive.file</span>), never
          your existing files.
        </span>
      </p>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-3.5 sm:p-4">
      <ShieldCheck
        aria-hidden
        className="mt-0.5 h-5 w-5 flex-none text-terracotta"
        strokeWidth={1.75}
      />
      <div className="space-y-1">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-terracotta-700">
          Safe by design
        </p>
        <p className="text-xs leading-relaxed text-ink/75 sm:text-[13px]">
          Setnayan only ever sees the folder it creates. Google&rsquo;s next
          screen lists a lot of permissions — that&rsquo;s normal, and it&rsquo;s
          safe. We use Google&rsquo;s most limited access (
          <span className="font-mono">drive.file</span>): Setnayan can open only
          the one wedding folder it makes, and never your existing files or
          photos.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  DriveConnectCard — NOT-CONNECTED point-of-need prompt                     */
/* -------------------------------------------------------------------------- */

export function DriveConnectCard({
  connectHref,
  oauthReady,
  headline,
  body,
  primaryLabel = 'Connect Google Drive',
  deferHref,
  deferLabel,
}: {
  connectHref: string;
  oauthReady: boolean;
  headline: string;
  body: ReactNode;
  primaryLabel?: string;
  deferHref?: string;
  deferLabel?: string;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-6 sm:p-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{headline}</h2>
        <div className="max-w-prose text-sm leading-relaxed text-ink/65">{body}</div>
      </div>

      <DriveSafetyPanel />

      {oauthReady ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-1">
          <Link
            href={connectHref}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-5 py-3 text-sm font-medium text-cream transition hover:bg-mulberry-600 sm:w-auto"
          >
            <CloudUpload aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {primaryLabel}
          </Link>
          {deferHref && deferLabel ? (
            <Link
              href={deferHref}
              className="text-sm font-medium text-mulberry underline-offset-2 hover:underline"
            >
              {deferLabel}
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="inline-flex max-w-sm flex-col items-start gap-1 rounded-md border border-ink/15 bg-ink/[0.03] px-4 py-3 text-xs text-ink/65">
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            <CloudUpload aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Drive setup pending
          </span>
          <span className="leading-snug">
            Setnayan&rsquo;s admin is finishing the Google Cloud verified-app
            review. The Connect button lights up here the moment that clears —
            your photos are safe and viewable in Setnayan in the meantime.
          </span>
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  DriveReconnectBanner — BROKEN / needs_reauth state                        */
/* -------------------------------------------------------------------------- */

export function DriveReconnectBanner({
  reconnectHref,
}: {
  reconnectHref: string;
}) {
  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label="Google Drive needs reconnecting"
      className="rounded-2xl border border-terracotta/40 bg-terracotta/5 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-terracotta/15 text-terracotta-700">
            <RefreshCw aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink">
              Your Drive needs a quick reconnect
            </p>
            <p className="max-w-prose text-xs leading-relaxed text-ink/70">
              Google paused our access to your folder — your photos are safe in
              Setnayan and waiting. Reconnect and we&rsquo;ll catch the copies up.
            </p>
          </div>
        </div>
        <Link
          href={reconnectHref}
          className="inline-flex items-center gap-1.5 rounded-md bg-mulberry px-3 py-2 text-xs font-medium text-cream transition hover:bg-mulberry-600"
        >
          <RefreshCw aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Reconnect Drive
        </Link>
      </div>
    </aside>
  );
}
