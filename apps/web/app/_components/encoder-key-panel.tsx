'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, ShieldCheck, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { CopyButton } from './copy-button';
import { isTauri, setPastedStreamKey, claimHostedStreamKey } from '@/lib/desktop-stream-key';
import { pasteSubmit } from '@/lib/live-studio-encoder-key-paste';

/**
 * S8 — the ONE stream-key block, shared by the setup page's GoLiveCard and the
 * unified controller's encoder section (both used to carry byte-for-byte
 * copies of the same reveal/copy JSX before this — see the git history on
 * go-live-card.tsx and app/panood/control/[eventId]/page.tsx).
 *
 * Renders one of three things, decided ONLY by `window.__TAURI__` and
 * `ownsHostedChannel` — never anything the page passes in as "are we
 * desktop":
 *
 *   1. BROWSER (no window.__TAURI__) — the pre-existing reveal/copy UI,
 *      completely unchanged. The stream key is server-rendered into this
 *      page today, on purpose, for OBS (see go-live-card.tsx's own docblock);
 *      nothing about that changes here.
 *   2. DESKTOP + own-channel (default tier) — a paste field. The key crosses
 *      the Tauri IPC boundary exactly once (`setPastedStreamKey`) and this
 *      component clears its own field state synchronously before that call
 *      resolves (`pasteSubmit` — see that module for why the guarantee is
 *      pulled out into a plain, tested function).
 *   3. DESKTOP + hosted-channel (add-on) — "Setnayan streams this for you —
 *      no key to copy": a Connect button that mints a claim nonce
 *      server-side and hands ONLY that nonce to Rust
 *      (`claimHostedStreamKey`). The response back from Rust carries no
 *      secret field to render even if this component tried to.
 *
 * `window.__TAURI__` is only known after mount (SSR always renders the
 * browser case first), so there is a one-frame flash on desktop — acceptable
 * for a page that is not the first thing painted after navigation.
 */
export function EncoderKeyPanel({
  eventId,
  streamKey,
  ownsHostedChannel,
}: {
  eventId: string;
  /** Server-resolved secret. Read ONLY by the browser-reveal path below —
   * the desktop paths never receive it (it isn't even sent to them; both
   * desktop branches ignore this prop entirely). */
  streamKey: string | null;
  ownsHostedChannel: boolean;
}) {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    setDesktop(isTauri());
  }, []);

  if (!desktop) {
    return <BrowserKeyReveal streamKey={streamKey} />;
  }
  return ownsHostedChannel ? (
    <HostedChannelConnect eventId={eventId} />
  ) : (
    <OwnChannelPasteField />
  );
}

function BrowserKeyReveal({ streamKey }: { streamKey: string | null }) {
  const [showKey, setShowKey] = useState(false);
  const maskedKey = streamKey
    ? `${'•'.repeat(Math.max(0, streamKey.length - 4))}${streamKey.slice(-4)}`
    : '— unavailable —';

  return (
    <div className="rounded-lg border border-ink/10 bg-cream/70 p-3">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
        <KeyRound aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Stream key · keep this secret
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <code className="break-all font-mono text-sm text-ink/85">
          {showKey ? (streamKey ?? '— unavailable —') : maskedKey}
        </code>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
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
        Treat it like a password — anyone with it can stream to your broadcast.
      </p>
    </div>
  );
}

type PasteStatus = 'idle' | 'saving' | 'saved' | 'error';

function OwnChannelPasteField() {
  const [fieldValue, setFieldValue] = useState('');
  const [status, setStatus] = useState<PasteStatus>('idle');

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = pasteSubmit(fieldValue);
    if (!result) return;
    // Clear the field's own state SYNCHRONOUSLY, before the await below — the
    // guard this whole module exists for. See pasteSubmit's docblock.
    setFieldValue(result.nextFieldValue);
    setStatus('saving');
    setPastedStreamKey(result.send)
      .then(() => setStatus('saved'))
      .catch(() => setStatus('error'));
  }

  return (
    <div className="rounded-lg border border-ink/10 bg-cream/70 p-3">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
        <KeyRound aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Stream key
      </p>
      <p className="mt-1 text-xs text-ink/65">
        Paste it here the same way you would into OBS. Setnayan never stores a
        copy — it goes straight to your desktop encoder.
      </p>
      <form onSubmit={handleSubmit} className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="password"
          autoComplete="off"
          value={fieldValue}
          onChange={(e) => setFieldValue(e.target.value)}
          placeholder="Paste your YouTube stream key"
          aria-label="Stream key"
          className="min-w-0 flex-1 rounded-md border border-ink/15 bg-cream px-3 py-1.5 font-mono text-sm text-ink/85"
        />
        <button
          type="submit"
          disabled={!fieldValue.trim() || status === 'saving'}
          className="inline-flex items-center gap-1.5 rounded-md bg-mulberry px-3 py-1.5 text-xs font-medium text-cream hover:bg-mulberry-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'saving' ? 'Saving…' : 'Save to encoder'}
        </button>
      </form>
      {status === 'saved' ? (
        <p role="status" className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-success-900">
          <ShieldCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Saved to your desktop encoder.
        </p>
      ) : null}
      {status === 'error' ? (
        <p role="alert" className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-danger-900">
          <AlertCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Couldn&rsquo;t save it — check the key and try again.
        </p>
      ) : null}
    </div>
  );
}

type ClaimStatus = 'idle' | 'connecting' | 'connected' | 'error';

function HostedChannelConnect({ eventId }: { eventId: string }) {
  const [status, setStatus] = useState<ClaimStatus>('idle');

  async function handleConnect() {
    setStatus('connecting');
    try {
      const res = await fetch('/api/live-studio/encoder/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      if (!res.ok) throw new Error('claim_failed');
      const { claimToken } = (await res.json()) as { claimToken: string };
      // Only the nonce is a local variable here — never assigned to component
      // state, so it can't linger on screen or in a React DevTools snapshot
      // any longer than this one async call needs it.
      await claimHostedStreamKey(claimToken);
      setStatus('connected');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="rounded-lg border border-ink/10 bg-cream/70 p-3">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
        <KeyRound aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Stream key
      </p>
      <p className="mt-1 inline-flex items-start gap-1.5 text-xs text-ink/65">
        <ShieldCheck aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-terracotta" strokeWidth={1.75} />
        Setnayan streams this for you — no key to copy.
      </p>
      {status !== 'connected' ? (
        <button
          type="button"
          onClick={handleConnect}
          disabled={status === 'connecting'}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-mulberry px-3 py-1.5 text-xs font-medium text-cream hover:bg-mulberry-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'connecting' ? 'Connecting…' : 'Connect encoder'}
        </button>
      ) : (
        <p role="status" className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-success-900">
          <ShieldCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Encoder connected.
        </p>
      )}
      {status === 'error' ? (
        <p role="alert" className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-danger-900">
          <AlertCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Couldn&rsquo;t connect the encoder — try again.
        </p>
      ) : null}
    </div>
  );
}
