'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CloudUpload, RefreshCw, Settings2, Unplug, UserRoundCog } from 'lucide-react';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { DriveConnectCard, DriveReconnectBanner, DriveSafetyPanel } from '@/app/_components/drive-connect-card';
import { useToast } from '@/app/_components/toast/toast-provider';
import { routes } from '@/lib/routes';
import {
  DRIVE_COPY_START_PARAM,
  copiedSoFarLine,
  copyResultWords,
  type CopyRunResult,
  type ShopDriveState,
} from '@/lib/supplier-drive-copy';

/**
 * ☁️ "COPY TO GOOGLE DRIVE" — ONE EVENT, THE SUPPLIER'S OWN DRIVE (owner 2026-11-22; corpus DECISION_LOG "COPY THIS
 * EVENT TO GOOGLE DRIVE", SUPPLIER_SUBSCRIPTIONS_BUILD_SPEC § H+).
 *
 * The reusable piece: drawn on the client's Files page and on the event's album today, and meant to be dropped onto
 * the storage page's album rows, "Make room" and the grace notice by the builds that make those (they pass the same
 * props). Pieces are the shipped ones: `ActionButton`, `Sheet`, and the couple's `DriveConnectCard` /
 * `DriveReconnectBanner` / `DriveSafetyPanel` unchanged.
 *
 *   · Not connected → the press opens the shipped connect card in a sheet; Google's consent returns here with
 *     `?drive_copy=start` and the copy the supplier asked for starts by itself.
 *   · Connected → the press copies; the line under the button counts "Copying… 12 of 40 files" (a live region).
 *   · Every end is said as what it is: all copied (a small toast + the line) · some couldn't be copied (red line, the
 *     button reads Try again) · nothing of yours on this event · the files couldn't be read. A failure never reads as
 *     done and never as "nothing to copy".
 *   · Never counted against storage, never a gate: this only ever adds a copy in the supplier's own Drive.
 */
export type CopyEventToDriveProps = {
  eventId: string;
  /** The event's name, for the sheet's words ("Maria & Jose's wedding"). */
  eventName: string;
  /** The shop's Drive as read on the server (`readShopDrive`). */
  drive: ShopDriveState;
  /** What the shop's Drive already holds of this event (`readShopEventsCopied`); null = that read was refused. */
  copied: { total: number; copied: number } | null;
  /** The page to come back to after Google's consent (a supplier-console path). */
  back: string;
};

type Line = { tone: 'ok' | 'bad' | 'note'; words: string } | null;

const TONE_COLOR: Record<'ok' | 'bad' | 'note', string | undefined> = {
  ok: 'rgb(var(--color-ok))',
  bad: 'rgb(var(--color-danger))',
  note: undefined,
};

/** The words for a `?drive_error=` the OAuth round trip sent back. */
function connectErrorWords(reason: string): string {
  if (reason === 'access_denied') return 'Google Drive wasn’t connected — the Google screen was closed. Nothing changed.';
  if (reason === 'not_configured') return 'Google Drive copying is being set up by Setnayan. Your files are safe here meanwhile.';
  return 'Google Drive couldn’t be connected just now. Nothing changed — try again.';
}

export function CopyEventToDrive({ eventId, eventName, drive, copied, back }: CopyEventToDriveProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<Line>(null);
  const [failed, setFailed] = useState(false);
  const [sheet, setSheet] = useState<null | 'connect' | 'settings'>(null);
  const ids = { connect: useId(), settings: useId() };
  const started = useRef(false);

  const connectHref = `${routes.api.oauth.drive.start()}?for=shop&event_id=${encodeURIComponent(eventId)}&back=${encodeURIComponent(back)}`;
  const canCopy = drive.status === 'connected';

  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    setLine({ tone: 'note', words: 'Copying…' });
    let since: string | null = null;
    let lastCopied = -1;
    let stalls = 0;
    try {
      // One press of the route copies for ~35 s; press on while it answers `copying`. A press that moves nothing
      // three times running is a failure, said — never an endless spinner.
      for (let i = 0; i < 120; i++) {
        const res = await fetch(routes.api.vendor.driveCopy(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: eventId, since }),
        });
        const r = (res.ok ? await res.json().catch(() => null) : null) as CopyRunResult | null;
        const result: CopyRunResult = r ?? { ok: false, reason: 'error' };
        const words = copyResultWords(result);
        if (!result.ok) {
          setLine(words);
          setFailed(true);
          if (result.reason === 'not_connected' || result.reason === 'needs_reconnect') setSheet('connect');
          return;
        }
        if (result.status === 'copying') {
          since = result.since;
          stalls = result.copied === lastCopied ? stalls + 1 : 0;
          lastCopied = result.copied;
          setLine(words);
          if (stalls >= 3) {
            setLine(copyResultWords({ ok: false, reason: 'error' }));
            setFailed(true);
            return;
          }
          continue;
        }
        setLine(words);
        if (result.status === 'done') toast.success(words.words);
        if (result.status === 'some_failed') setFailed(true);
        return;
      }
      setLine(copyResultWords({ ok: false, reason: 'error' }));
      setFailed(true);
    } catch {
      setLine(copyResultWords({ ok: false, reason: 'error' }));
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [busy, eventId, toast]);

  // Back from Google: `?drive_copy=start` starts the copy that was asked for; `?drive_error=` is said; either way the
  // parameter leaves the address so a reload does not repeat it.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const url = new URL(window.location.href);
    const start = url.searchParams.get(DRIVE_COPY_START_PARAM) === 'start';
    const err = url.searchParams.get('drive_error');
    const gone = url.searchParams.get('drive_disconnected') === '1';
    if (!start && !err && !gone) return;
    url.searchParams.delete(DRIVE_COPY_START_PARAM);
    url.searchParams.delete('drive_error');
    url.searchParams.delete('drive_disconnected');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    if (err) {
      setLine({ tone: 'bad', words: connectErrorWords(err) });
      setFailed(true);
    } else if (gone) {
      setLine({ tone: 'note', words: 'Google Drive disconnected. What was already copied stays in your Drive.' });
    } else if (canCopy) {
      void run();
    }
  }, [canCopy, run]);

  const press = () => {
    if (drive.status === 'unread') {
      setLine({ tone: 'bad', words: 'We couldn’t check your Google Drive just now. Nothing was copied — reload in a moment.' });
      setFailed(true);
      return;
    }
    if (!canCopy) {
      setSheet('connect');
      return;
    }
    void run();
  };

  const quiet = line ?? (copied === null ? null : (() => {
    const w = copiedSoFarLine(copied);
    return w ? { tone: 'note' as const, words: w } : null;
  })());
  const account = drive.status === 'connected' || drive.status === 'needs_reconnect' ? drive.account : null;
  const whereWords = account
    ? `Copies go to ${account}, one folder per event.`
    : 'Copies go to your connected Google Drive, one folder per event.';

  return (
    <div className="space-y-1" data-copy-event-to-drive={eventId}>
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          tone="info"
          icon={busy ? RefreshCw : CloudUpload}
          label={busy ? 'Copying…' : failed ? 'Try again' : 'Copy to Google Drive'}
          name={`Copy ${eventName} to Google Drive`}
          onClick={press}
          disabled={busy}
        />
        {canCopy || drive.status === 'needs_reconnect' ? (
          <ActionButton tone="neutral" quiet iconOnly icon={Settings2} label="Google Drive settings" onClick={() => setSheet('settings')} />
        ) : null}
      </div>
      {quiet ? (
        <p
          role="status"
          aria-live="polite"
          className="text-sn-md text-ink/70"
          style={TONE_COLOR[quiet.tone] ? { color: TONE_COLOR[quiet.tone] } : undefined}
          data-copy-event-to-drive-line={quiet.tone}
        >
          {quiet.words}
        </p>
      ) : null}

      {/* Not connected (or Google paused us): the shipped connect card / reconnect banner, unchanged. */}
      <Sheet open={sheet === 'connect'} onClose={() => setSheet(null)} labelledById={ids.connect} rise>
        <div className="space-y-3 px-4 pb-4 pt-3" data-copy-event-to-drive-connect="">
          <h2 id={ids.connect} className="sr-only">
            Connect Google Drive
          </h2>
          {drive.status === 'needs_reconnect' ? (
            <DriveReconnectBanner reconnectHref={connectHref} />
          ) : (
            <DriveConnectCard
              connectHref={connectHref}
              oauthReady={drive.status !== 'not_configured'}
              headline="Keep a copy in your Google Drive"
              body={
                <>
                  Setnayan copies the files you keep for <b className="font-semibold text-ink">{eventName}</b> into one
                  folder in your own Google Drive. It&rsquo;s your copy: it never counts against your storage here, and
                  nothing in Setnayan changes.
                </>
              }
            />
          )}
        </div>
      </Sheet>

      {/* Connected: which account, use another one, or let go. */}
      <Sheet open={sheet === 'settings'} onClose={() => setSheet(null)} labelledById={ids.settings} rise>
        <div className="space-y-3 px-4 pb-4 pt-3" data-copy-event-to-drive-settings="">
          <h2 id={ids.settings} className="pr-12 text-sn-2xl font-semibold text-ink">
            Google Drive
          </h2>
          <p className="text-sn-lg text-ink/70">{whereWords}</p>
          <DriveSafetyPanel variant="condensed" />
          <div className="flex flex-wrap gap-2 pt-1">
            {/* A full-page trip to Google (never a client navigation of an API route): a plain anchor wearing the button. */}
            <a href={`${connectHref}&switch=1`} className={actionButtonClass('neutral')} aria-label="Use another account">
              <UserRoundCog aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              <span className="lbl">Use another account</span>
            </a>
            <form method="post" action={routes.api.oauth.drive.disconnect()}>
              <input type="hidden" name="for" value="shop" />
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="back" value={back} />
              <ActionButton type="submit" tone="danger" icon={Unplug} label="Disconnect" />
            </form>
          </div>
          <p className="text-sn-md text-ink/70">Disconnecting keeps everything already in your Drive.</p>
        </div>
      </Sheet>
    </div>
  );
}
