'use client';

import { useState, useTransition } from 'react';
import {
  Radio,
  Server,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Square,
} from 'lucide-react';
import { CopyButton } from '@/app/_components/copy-button';
import { ProgressRing } from '@/app/_components/progress-ring';
import { goLivePanood, endPanoodBroadcast } from './actions';
import { useSaveLoader } from '@/components/sd-loader';

/**
 * Panood Phase 1 — one-tap "Go live" + the OBS connection card.
 *
 * Client island over the server actions in ./actions.ts. When YouTube is
 * connected AND the event owns Panood, the couple presses ONE button and
 * Setnayan auto-creates the YouTube broadcast + RTMP stream on their own
 * channel, then hands them the OBS server URL + stream key here. They stream
 * INTO that broadcast from OBS (or the YouTube app) — Setnayan never sends
 * video bytes. Honest copy throughout: this creates the broadcast on THEIR
 * channel; the watch link goes live on the event page automatically.
 *
 * The stream key is a SECRET, server-rendered only when the host views this
 * page (the table is service-role-only). It stays masked until the couple
 * reveals it, with a copy button so a typo can't break their encoder setup.
 */

type ActiveBroadcast = {
  broadcastId: string;
  ingestionUrl: string;
  status: string;
  watchUrl: string | null;
} | null;

export function GoLiveCard({
  eventId,
  oauthReady,
  connected,
  ownsPanood,
  active,
  streamKey,
}: {
  eventId: string;
  oauthReady: boolean;
  connected: boolean;
  ownsPanood: boolean;
  active: ActiveBroadcast;
  // Server-resolved secret — only present when there's an active broadcast and
  // the host is viewing the page. Never reaches a non-host (table is service-
  // role-only + this card is rendered inside the host-gated page).
  streamKey: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showKey, setShowKey] = useState(false);
  const save = useSaveLoader();

  // Broadcast-readiness donut ("Energy, not skin" reskin 2026-07-09). A dense,
  // legible read of the go-live status this card ALREADY derives from its
  // props — the three prerequisites (owns Panood · YouTube app review cleared ·
  // channel connected), or a full "Live" ring once a broadcast is active. No
  // new data: pure re-expression of state already in scope. Presentation only.
  const prerequisites = [ownsPanood, oauthReady, connected];
  const readyCount = prerequisites.filter(Boolean).length;
  const isLive = Boolean(active);
  const readinessPct = isLive
    ? 100
    : Math.round((readyCount / prerequisites.length) * 100);
  const readinessCaption = isLive
    ? 'On air'
    : readyCount === prerequisites.length
      ? 'Ready'
      : `${readyCount} of ${prerequisites.length} set`;

  function handleGoLive() {
    setError(null);
    startTransition(async () => {
      const result = await save.run(() => goLivePanood(eventId), {
        steps: ['Going live'],
        hint: 'Please wait',
      });
      if ('error' in result) setError(result.error);
      // On success the action revalidates the path → the page re-renders with
      // the active broadcast + OBS card. No client navigation needed.
    });
  }

  function handleEnd() {
    setError(null);
    startTransition(async () => {
      const result = await save.run(() => endPanoodBroadcast(eventId), {
        steps: ['Ending the broadcast'],
        hint: 'Please wait',
      });
      if ('error' in result) setError(result.error);
    });
  }

  return (
    <section
      aria-labelledby="go-live-heading"
      className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Step 1b · go live in one tap
          </p>
          <h2
            id="go-live-heading"
            className="m-serif flex items-center gap-2 text-2xl tracking-tight text-ink"
          >
            <Radio aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
            {active ? 'Your broadcast is ready' : 'Go live'}
          </h2>
          <p className="max-w-prose text-sm text-ink/65">
            One tap creates the live broadcast on <em>your</em> YouTube channel and
            puts the watch player on your event page. You then stream into it from
            OBS on a laptop (server + key below) or straight from the YouTube app —
            Setnayan never touches your video, it just sets everything up for you.
          </p>
        </div>

        {/* Readiness donut — wine ring, dense status read of the props above. */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          <ProgressRing pct={readinessPct} size={72} stroke={7}>
            {isLive ? (
              <span className="flex flex-col items-center gap-0.5 leading-none">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full bg-mulberry"
                />
                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-mulberry">
                  Live
                </span>
              </span>
            ) : (
              <span className="text-sm font-semibold text-ink">
                {readinessPct}%
              </span>
            )}
          </ProgressRing>
          <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55">
            {readinessCaption}
          </span>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="inline-flex items-start gap-2 rounded-xl border border-danger-300/70 bg-danger-50 px-4 py-3 text-sm text-danger-900"
        >
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          <span>{error}</span>
        </p>
      ) : null}

      {!active ? (
        <GoLivePrompt
          oauthReady={oauthReady}
          connected={connected}
          ownsPanood={ownsPanood}
          pending={pending}
          onGoLive={handleGoLive}
        />
      ) : (
        <ObsConnectionCard
          active={active}
          streamKey={streamKey}
          showKey={showKey}
          onToggleKey={() => setShowKey((s) => !s)}
          pending={pending}
          onEnd={handleEnd}
        />
      )}
    </section>
  );
}

function GoLivePrompt({
  oauthReady,
  connected,
  ownsPanood,
  pending,
  onGoLive,
}: {
  oauthReady: boolean;
  connected: boolean;
  ownsPanood: boolean;
  pending: boolean;
  onGoLive: () => void;
}) {
  // Honest gating: the button only lights up when everything's in place. Each
  // missing prerequisite gets a plain-English reason rather than a dead button.
  if (!ownsPanood) {
    return (
      <p className="rounded-xl border border-dashed border-ink/15 bg-cream/60 px-4 py-3 text-sm text-ink/65">
        Buy Panood for this event to unlock one-tap go-live.
      </p>
    );
  }
  if (!oauthReady) {
    return (
      <p className="rounded-xl border border-dashed border-ink/15 bg-cream/60 px-4 py-3 text-sm text-ink/65">
        One-tap go-live turns on once Setnayan&rsquo;s YouTube app review clears
        with Google (1&ndash;4 weeks). Until then you can still go live manually
        from the YouTube app and paste the link below.
      </p>
    );
  }
  if (!connected) {
    return (
      <p className="rounded-xl border border-dashed border-ink/15 bg-cream/60 px-4 py-3 text-sm text-ink/65">
        Connect your YouTube channel in step 1 first, then come back here to go
        live in one tap.
      </p>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border border-terracotta/30 bg-cream/80 p-5">
      <button
        type="button"
        onClick={onGoLive}
        disabled={pending}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-mulberry px-5 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Radio aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        {pending ? 'Creating your broadcast…' : 'Go live'}
      </button>
      <p className="text-xs text-ink/55">
        Creates the broadcast on your channel (unlisted, ads off) and shows your
        OBS connection details here. Takes a few seconds.
      </p>
    </div>
  );
}

function ObsConnectionCard({
  active,
  streamKey,
  showKey,
  onToggleKey,
  pending,
  onEnd,
}: {
  active: NonNullable<ActiveBroadcast>;
  streamKey: string | null;
  showKey: boolean;
  onToggleKey: () => void;
  pending: boolean;
  onEnd: () => void;
}) {
  const maskedKey = streamKey
    ? `${'•'.repeat(Math.max(0, streamKey.length - 4))}${streamKey.slice(-4)}`
    : '— unavailable —';
  return (
    <div className="space-y-4 rounded-xl border border-success-200/80 bg-success-50/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <CheckCircle2 aria-hidden className="h-4 w-4 text-success-600" strokeWidth={2} />
          Broadcast created on your channel
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-100 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-success-900">
          {active.status}
        </span>
      </div>

      <p className="max-w-prose text-xs text-ink/65">
        Point OBS (or any RTMP encoder) at the server + stream key below, press
        &ldquo;Start Streaming&rdquo; there, and your broadcast goes live on your
        event page automatically. Prefer your phone? Open the YouTube app and go
        live to the same broadcast — no copy-paste needed.
      </p>

      {/* RTMP server URL */}
      <div className="rounded-lg border border-ink/10 bg-cream/70 p-3">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          <Server aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          RTMP server (OBS &rarr; Stream &rarr; Server)
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <code className="break-all font-mono text-sm text-ink/85">
            {active.ingestionUrl}
          </code>
          <CopyButton value={active.ingestionUrl} label="Copy" copiedLabel="Copied" />
        </div>
      </div>

      {/* Stream key — secret, masked until revealed */}
      <div className="rounded-lg border border-ink/10 bg-cream/70 p-3">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          <KeyRound aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Stream key (OBS &rarr; Stream &rarr; Stream Key · keep this secret)
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <code className="break-all font-mono text-sm text-ink/85">
            {showKey ? streamKey ?? '— unavailable —' : maskedKey}
          </code>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleKey}
              disabled={!streamKey}
              aria-label={showKey ? 'Hide stream key' : 'Reveal stream key'}
              className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-2.5 py-1 text-xs font-medium text-ink/75 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {showKey ? (
                <>
                  <EyeOff aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  Hide
                </>
              ) : (
                <>
                  <Eye aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  Reveal
                </>
              )}
            </button>
            {streamKey ? (
              <CopyButton value={streamKey} label="Copy" copiedLabel="Copied" />
            ) : null}
          </div>
        </div>
        <p className="mt-1.5 text-[11px] text-ink/50">
          Treat your stream key like a password — anyone with it can stream to
          your broadcast. Don&rsquo;t share it or screenshot it publicly.
        </p>
      </div>

      {/* Watch URL */}
      {active.watchUrl ? (
        <div className="rounded-lg border border-ink/10 bg-cream/70 p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Watch URL (live on your event page)
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <a
              href={active.watchUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 break-all font-mono text-sm text-terracotta hover:underline"
            >
              <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              {active.watchUrl}
            </a>
            <CopyButton value={active.watchUrl} label="Copy" copiedLabel="Copied" />
          </div>
        </div>
      ) : null}

      {/* End broadcast */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="text-xs text-ink/55">
          Done streaming? Ending here closes the broadcast on YouTube and removes
          the player from your event page.
        </p>
        <button
          type="button"
          onClick={onEnd}
          disabled={pending}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md border border-burgundy/20 bg-burgundy px-4 py-1.5 text-sm font-semibold text-cream transition-colors hover:bg-burgundy/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Square aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          {pending ? 'Ending…' : 'End broadcast'}
        </button>
      </div>
    </div>
  );
}
