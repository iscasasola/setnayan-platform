'use client';

import { useCallback, useEffect, useId, useRef, useState, type ComponentType, type SVGProps } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, CloudCheck, CloudUpload, Link2, RefreshCw, Settings, ShieldCheck, TriangleAlert, Unplug } from 'lucide-react';
import { ActionButton, actionButtonClass, type ActionTone } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { useToast } from '@/app/_components/toast/toast-provider';
import { setTwo } from '@/app/vendor-dashboard/_components/set-two/parts';
import { routes } from '@/lib/routes';
import {
  DRIVE_COPY_START_PARAM,
  copiedSoFarLine,
  copyDoneToast,
  copyResultWords,
  type CopyRunResult,
  type LineTone,
  type ShopDriveState,
} from '@/lib/supplier-drive-copy';

/**
 * ☁️ "COPY TO GOOGLE DRIVE" — ONE EVENT, THE SUPPLIER'S OWN DRIVE (owner 2026-11-22; corpus DECISION_LOG "COPY THIS
 * EVENT TO GOOGLE DRIVE", SUPPLIER_SUBSCRIPTIONS_BUILD_SPEC § H+). Design: Fable, 22 Nov 2026
 * (`drive_copy_design_2026-11-22_fable.html`, drawn at the owner's "use fable to fix the design").
 *
 * ONE ROW, the approved storage drawing's album-row shape: "Google Drive" ⓘ · the one verb at the end · a quiet status
 * line under it (a measured track while copying). The verb tells the truth before the press:
 *   Connect (not connected) · Reconnect (Google paused us) · Copy (connected) · Copying… (waiting) · Try again (a
 *   failure). Not set up by Setnayan yet → Copy waits, and the line says why — no sheet with nothing to press.
 * TWO SHEETS, from the canonical pieces (Sheet · ActionButton · InfoTip · the set-two note): Connect / Reconnect, and the
 * ⚙ settings (account · Switch account · Disconnect). The couple's DriveConnectCard is not nested here (a card in a
 * sheet); its file is untouched.
 *
 * Every end is said as what it is (lib/supplier-drive-copy.ts words): all copied (a CloudCheck line + a small toast) ·
 * some couldn't be copied · the files or the Drive couldn't be read · the copy stopped. A failure never reads as done
 * and never as "nothing to copy". Never counted against storage, never a gate.
 *
 * The reusable piece: the Files page and the event album draw it today; the storage page's album rows, "Make room" and
 * the grace notice drop it in with the same props.
 */
export type CopyEventToDriveProps = {
  eventId: string;
  /** The event's name, for the sheet's words ("Maria & Jose"). */
  eventName: string;
  /** The shop's Drive as read on the server (`readShopDrive`). */
  drive: ShopDriveState;
  /** What the shop's Drive already holds of this event (`readShopEventsCopied`); null = that read was refused. */
  copied: { total: number; copied: number } | null;
  /** The page to come back to after Google's consent (a supplier-console path). */
  back: string;
};

type Line = { tone: LineTone; words: string };
type Progress = { copied: number; total: number } | null;
type Icon = ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number | string }>;

/** A line's mark and colour, by its tone (colour never carries the meaning alone — the words do). */
const LINE_MARK: Record<LineTone, { Icon: Icon | null; color: string | undefined }> = {
  ok: { Icon: CloudCheck, color: 'rgb(var(--color-ok))' },
  warn: { Icon: TriangleAlert, color: 'rgb(var(--color-warn))' },
  bad: { Icon: TriangleAlert, color: 'rgb(var(--color-danger))' },
  note: { Icon: null, color: undefined },
};

const SAFE_LINE = 'Setnayan only sees the folder it creates.';
const SAFE_MORE =
  'Google’s next screen lists several permissions. That is normal. Setnayan uses Google’s most limited access: it can open only the folder it makes, never your other files or photos.';

/** The line for a `?drive_error=` the OAuth round trip sent back. Closing Google's screen is a choice, not an error. */
function connectErrorLine(reason: string): Line {
  if (reason === 'access_denied') return { tone: 'note', words: 'Not connected. The Google screen was closed.' };
  if (reason === 'not_configured') return { tone: 'note', words: 'Being set up by Setnayan. Your files are safe here.' };
  return { tone: 'bad', words: 'Google Drive couldn’t be connected. Try again.' };
}

export function CopyEventToDrive({ eventId, eventName, drive, copied, back }: CopyEventToDriveProps) {
  const toast = useToast();
  const router = useRouter();
  // The Drive as the page last learned it: a press can find it paused or gone before the next server read.
  const [driveNow, setDriveNow] = useState<ShopDriveState>(drive);
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<Line | null>(null);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState<Progress>(null);
  const [sheet, setSheet] = useState<null | 'connect' | 'settings'>(null);
  const ids = { connect: useId(), settings: useId() };
  const started = useRef(false);

  const connectHref = `${routes.api.oauth.drive.start()}?for=shop&event_id=${encodeURIComponent(eventId)}&back=${encodeURIComponent(back)}`;
  const connected = driveNow.status === 'connected';

  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    setProgress(null);
    setLine({ tone: 'note', words: 'Copying…' });
    let since: string | null = null;
    let lastCopied = -1;
    let stalls = 0;
    const stop = (l: Line) => {
      setLine(l);
      setFailed(true);
      setProgress(null);
    };
    try {
      // One press of the route copies for ~35 s; press on while it answers `copying`. A press that moves nothing
      // three times running is a failure, said — never an endless wait.
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
          if (result.reason === 'not_connected') {
            setDriveNow({ status: 'not_connected' });
            setLine(words);
            setProgress(null);
            setSheet('connect');
            return;
          }
          if (result.reason === 'needs_reconnect') {
            setDriveNow((d) => ({ status: 'needs_reconnect', account: d.status === 'connected' ? d.account : null }));
            setLine(words);
            setProgress(null);
            setSheet('connect');
            return;
          }
          stop(words);
          return;
        }
        if (result.status === 'copying') {
          since = result.since;
          stalls = result.copied === lastCopied ? stalls + 1 : 0;
          lastCopied = result.copied;
          setLine(words);
          setProgress({ copied: result.copied, total: result.total });
          if (stalls >= 3) {
            stop(copyResultWords({ ok: false, reason: 'error' }));
            return;
          }
          continue;
        }
        setProgress(null);
        setLine(words);
        if (result.status === 'done') toast.success(copyDoneToast(result.total));
        if (result.status === 'some_failed') setFailed(true);
        return;
      }
      stop(copyResultWords({ ok: false, reason: 'error' }));
    } catch {
      stop(copyResultWords({ ok: false, reason: 'error' }));
    } finally {
      setBusy(false);
    }
  }, [busy, eventId, toast]);

  // Back from Google: `?drive_copy=start` starts the copy that was asked for; `?drive_error=` / `?drive_disconnected=`
  // are said; either way the parameter leaves the address so a reload does not repeat it.
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
      const l = connectErrorLine(err);
      setLine(l);
      setFailed(l.tone === 'bad');
    } else if (gone) {
      setLine({ tone: 'note', words: 'Disconnected. Your copies stay in your Drive.' });
    } else if (drive.status === 'connected') {
      void run();
    }
  }, [drive.status, run]);

  // ── What the row says before any press: the Drive's state, then what is copied of this event. ──
  const soFar = copiedSoFarLine(copied);
  const atRest: Line =
    driveNow.status === 'unread'
      ? { tone: 'bad', words: 'Couldn’t check your Google Drive. Nothing was copied.' }
      : driveNow.status === 'not_configured'
        ? { tone: 'note', words: 'Being set up by Setnayan. Your files are safe here.' }
        : driveNow.status === 'not_connected'
          ? { tone: 'note', words: 'Not connected' }
          : driveNow.status === 'needs_reconnect'
            ? { tone: 'warn', words: copied && copied.total > 0 ? `Paused by Google · ${soFar.words}` : 'Paused by Google' }
            : soFar;
  const shown = line ?? atRest;
  const allCopied = connected && !line && !!copied && copied.total > 0 && copied.copied >= copied.total;

  // ── The one verb, by state. Never `main`: each host page already has its own main verb. ──
  const verb: { tone: ActionTone; icon: Icon; label: string; onPress?: () => void; waiting?: boolean; quiet?: boolean } =
    busy
      ? { tone: 'info', icon: CloudUpload, label: 'Copying…', waiting: true }
      : driveNow.status === 'unread'
        ? {
            tone: 'info',
            icon: RefreshCw,
            label: 'Try again',
            // one-render: keep (retry) — the Drive's state could not be read on the server; Try again re-reads it, nothing is written
            onPress: () => router.refresh(),
          }
        : driveNow.status === 'not_configured'
          ? { tone: 'info', icon: CloudUpload, label: 'Copy', waiting: true }
          : driveNow.status === 'not_connected'
            ? { tone: 'info', icon: Link2, label: 'Connect', onPress: () => setSheet('connect') }
            : driveNow.status === 'needs_reconnect'
              ? { tone: 'warn', icon: RefreshCw, label: 'Reconnect', onPress: () => setSheet('connect') }
              : failed
                ? { tone: 'info', icon: RefreshCw, label: 'Try again', onPress: () => void run() }
                : { tone: 'info', icon: CloudUpload, label: 'Copy', onPress: () => void run(), quiet: allCopied };
  const showSettings = connected || driveNow.status === 'needs_reconnect';
  const account = driveNow.status === 'connected' || driveNow.status === 'needs_reconnect' ? driveNow.account : null;
  const thisEvent =
    copied === null
      ? 'Couldn’t read'
      : copied.total === 0
        ? 'Not copied yet'
        : `${copied.copied.toLocaleString('en-PH')} of ${copied.total.toLocaleString('en-PH')} files copied`;
  const mark = LINE_MARK[shown.tone];
  const frac = progress && progress.total > 0 ? Math.min(1, progress.copied / progress.total) : 0;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-3 py-1.5" data-copy-event-to-drive={eventId}>
      <InfoTip label="Google Drive" labelClassName="whitespace-nowrap text-sn-lg font-bold text-ink" align="start">
        A copy of this event&rsquo;s files in your own Google Drive. It never counts against your storage here. {SAFE_LINE}
      </InfoTip>
      <div className="flex items-center gap-1">
        <ActionButton
          tone={verb.tone}
          icon={verb.icon}
          label={verb.label}
          name={verb.label === 'Copy' ? `Copy ${eventName} to Google Drive` : `${verb.label} · Google Drive for ${eventName}`}
          onClick={verb.onPress}
          waiting={verb.waiting}
          quiet={verb.quiet}
        />
        {showSettings ? (
          <ActionButton tone="neutral" quiet iconOnly icon={Settings} label="Google Drive settings" onClick={() => setSheet('settings')} />
        ) : null}
      </div>
      <p
        role="status"
        aria-live="polite"
        className="col-span-2 flex items-start gap-1.5 text-sn-md tabular-nums text-ink/70"
        style={mark.color ? { color: mark.color } : undefined}
        data-copy-event-to-drive-line={shown.tone}
      >
        {mark.Icon ? <mark.Icon aria-hidden className="mt-0.5 h-3.5 w-3.5 flex-none" strokeWidth={1.75} /> : null}
        <span>{shown.words}</span>
      </p>
      {busy && progress ? (
        <div
          className="col-span-2 mb-2 h-1 overflow-hidden rounded-full"
          style={{ background: 'var(--surface-soft)' }}
          aria-hidden
          data-copy-event-to-drive-track=""
        >
          <i
            className="block h-full origin-left rounded-full transition-transform duration-sn-control ease-sn"
            style={{ background: 'rgb(var(--color-mulberry))', transform: `scaleX(${frac})` }}
          />
        </div>
      ) : null}

      {/* Connect / Reconnect — the full-page trip to Google is a plain anchor wearing the main button. */}
      <Sheet open={sheet === 'connect'} onClose={() => setSheet(null)} labelledById={ids.connect} rise>
        <div
          className="space-y-3 px-4 pb-4 pt-3"
          data-copy-event-to-drive-connect={driveNow.status === 'needs_reconnect' ? 'reconnect' : 'connect'}
        >
          {driveNow.status === 'needs_reconnect' ? (
            <>
              <h2 id={ids.connect} className="pr-12 text-sn-2xl font-semibold text-ink">
                Reconnect Google Drive
              </h2>
              <p className="text-sn-base text-ink/70">Google paused Setnayan&rsquo;s access. Your files are safe here.</p>
              <Facts rows={[...(account ? [['Account', account] as const] : []), ['This event', thisEvent] as const]} />
              <SafeNote />
              <a href={connectHref} className={actionButtonClass('brand', { main: true, extra: 'w-full' })} aria-label="Reconnect">
                <RefreshCw aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                <span className="lbl">Reconnect</span>
              </a>
              <p className="text-center text-sn-md text-ink/70">The copy picks up where it stopped.</p>
            </>
          ) : (
            <>
              <h2 id={ids.connect} className="pr-12 text-sn-2xl font-semibold text-ink">
                Connect Google Drive
              </h2>
              <p className="text-sn-base text-ink/70">
                Your files for <b className="font-semibold text-ink">{eventName}</b> are copied into one folder in your own Drive.
              </p>
              <p className="text-sn-base text-ink/70">It never counts against your storage here.</p>
              <SafeNote />
              <a href={connectHref} className={actionButtonClass('brand', { main: true, extra: 'w-full' })} aria-label="Connect Google Drive">
                <Link2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                <span className="lbl">Connect Google Drive</span>
              </a>
              <p className="text-center text-sn-md text-ink/70">You&rsquo;ll go to Google and come back. The copy starts by itself.</p>
            </>
          )}
        </div>
      </Sheet>

      {/* ⚙ Settings — which account, switch it, or let go. */}
      <Sheet open={sheet === 'settings'} onClose={() => setSheet(null)} labelledById={ids.settings} rise>
        <div className="space-y-3 px-4 pb-4 pt-3" data-copy-event-to-drive-settings="">
          <h2 id={ids.settings} className="pr-12 text-sn-2xl font-semibold text-ink">
            Google Drive
          </h2>
          <Facts
            rows={[
              ['Account', account ?? 'Connected'] as const,
              ['Folders', 'One per event'] as const,
              ['This event', thisEvent] as const,
              ...(driveNow.status === 'needs_reconnect' ? [['Access', 'Paused by Google', 'warn'] as const] : []),
            ]}
          />
          <SafeNote />
          <div className="grid auto-cols-fr grid-flow-col gap-2" data-equal-row="">
            <a href={`${connectHref}&switch=1`} className={actionButtonClass('neutral')} aria-label="Switch account">
              <ArrowLeftRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              <span className="lbl">Switch account</span>
            </a>
            <form method="post" action={routes.api.oauth.drive.disconnect()} className="grid">
              <input type="hidden" name="for" value="shop" />
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="back" value={back} />
              <ActionButton type="submit" tone="danger" icon={Unplug} label="Disconnect" />
            </form>
          </div>
          <p className="text-center text-sn-md text-ink/70">Disconnecting keeps everything already in your Drive.</p>
        </div>
      </Sheet>
    </div>
  );
}

type FactRow = readonly [label: string, value: string] | readonly [label: string, value: string, tone: 'warn'];

/** Label · value rows, a hairline between (the approved storage drawing's `.fact`). */
function Facts({ rows }: { rows: readonly FactRow[] }) {
  return (
    <dl>
      {rows.map((row, i) => (
        <div key={row[0]} className={`flex items-baseline gap-3 py-2.5 ${i > 0 ? 'border-t border-ink/10' : ''}`}>
          <dt className="min-w-0 flex-1 text-sn-base text-ink/70">{row[0]}</dt>
          <dd
            className="min-w-0 text-right text-sn-base font-semibold tabular-nums text-ink [overflow-wrap:anywhere]"
            style={row[2] === 'warn' ? { color: 'rgb(var(--color-warn))' } : undefined}
          >
            {row[1]}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The drive.file reassurance: one line, the rest in an ⓘ, inside the set-two note. */
function SafeNote() {
  return (
    <div className={`${setTwo.note} !mx-0`}>
      <ShieldCheck aria-hidden strokeWidth={1.75} style={{ color: 'rgb(var(--color-ok))' }} />
      <div className={setTwo.noteBody}>
        <InfoTip label={SAFE_LINE} labelClassName="text-sn-md font-bold text-ink" align="start">
          {SAFE_MORE}
        </InfoTip>
      </div>
    </div>
  );
}
