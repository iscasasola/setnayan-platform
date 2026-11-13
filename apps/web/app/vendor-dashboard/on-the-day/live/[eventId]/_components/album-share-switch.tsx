'use client';

/**
 * album-share-switch.tsx — "Share this album to the event's story" (owner rulings 2026-11-13, specs DECISION_LOG
 * "Supplier Ultra shares its album" · "Ultra album share — default"; drawn as the "Supplier side — Now beside Proposed"
 * panel of `prototypes/approved_2026-11-13/story-suppliers-fable.html` v6: "The same album screen, with one new switch").
 *
 *   · Supplier Ultra: one switch on the album. OFF by default (the album promises "Only you see this"). On, the album
 *     fills this supplier's own scene in the event's story. Switchable any time.
 *   · After the event, an Ultra that has never answered is asked ONCE: "Share your album to <couple>'s story?" — one tap.
 *     Either answer (or using the switch) is the answer; it is never asked again.
 *   · Supplier Plus / Pro and below: the same row, locked, with Problem → Solution and the way to Supplier Ultra.
 *
 * Writes through the ONE per-event supplier dispatcher (`eventFilesAction`, op `albumshare`) — the server re-checks the
 * plan and the owner role; this file decides nothing.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { eventFilesAction } from '@/app/_actions/event-files-actions';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { InfoTip } from '@/app/_components/info-tip';

export const ALBUM_SHARE_TIP =
  'On, everyone who opens this event’s story sees this album in your own scene, with your shop name, your Supplier Ultra badge and a button to your shop. Off, the album stays private. You can switch it any time.';

export function AlbumShareSwitch({
  eventId,
  shared,
  isUltra,
  canManage,
  askNow,
  coupleName,
  returnPath,
  upgradeHref,
}: {
  eventId: string;
  shared: boolean;
  isUltra: boolean;
  /** Owners and admins only — the action refuses everyone else. */
  canManage: boolean;
  /** The event is over and this Ultra never answered — ask once. */
  askNow: boolean;
  coupleName: string;
  returnPath: string;
  upgradeHref: string;
}) {
  const [on, setOn] = useState(shared);
  const [asking, setAsking] = useState(askNow);
  const [said, setSaid] = useState<string | null>(null);
  const [href, setHref] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = (want: boolean) =>
    start(async () => {
      const was = on;
      setOn(want);
      setAsking(false);
      setSaid(null);
      setHref(null);
      const fd = new FormData();
      fd.set('op', 'albumshare');
      fd.set('event_id', eventId);
      fd.set('shared', want ? 'on' : 'off');
      fd.set('return_path', returnPath);
      const r = await eventFilesAction({ status: 'idle' }, fd);
      if (r.status === 'error') {
        setOn(was);
        setSaid(r.message);
        setHref(r.href ?? null);
      } else if (r.status === 'done') setSaid(r.message);
    });

  if (!isUltra) {
    return (
      <details className="mt-3 rounded-lg px-3 py-2" style={{ background: 'var(--m-fill, rgba(0,0,0,0.03))' }} data-album-share="locked">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3">
          <span aria-hidden>🔒</span>
          <span className="min-w-0 flex-1">
            <b className="block text-sm" style={{ color: 'var(--m-slate-1)' }}>
              Share this album to the event’s story
            </b>
            <small className="block text-xs" style={{ color: 'var(--m-slate-3)' }}>
              Supplier Ultra shares its album to the event story
            </small>
          </span>
        </summary>
        <p className="mt-2 text-sm" style={{ color: 'var(--m-slate-2)' }}>
          <b>Problem.</b> Your plan lists you in the story, with no scene of your own.
          <br />
          <b>Solution.</b> Move to Supplier Ultra. Your album then fills your own scene.
        </p>
        <Link href={upgradeHref} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold underline-offset-2 hover:underline" style={{ color: 'var(--m-slate-1)' }}>
          See Supplier Ultra
        </Link>
      </details>
    );
  }

  return (
    <div className="mt-3" data-album-share={on ? 'on' : 'off'}>
      {asking && canManage ? (
        <div className="mb-3 rounded-lg px-3 py-3" style={{ background: 'var(--m-fill, rgba(0,0,0,0.03))' }} data-album-share-ask="">
          <p className="text-sm font-semibold" style={{ color: 'var(--m-slate-1)' }}>
            Share your album to {coupleName}’s story?
          </p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--m-slate-3)' }}>
            It fills your own scene. You can switch it off any time.
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={pending} onClick={() => send(true)} className="sn-press inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold" style={{ background: 'var(--m-slate-1)', color: 'var(--m-bg, #fff)' }}>
              Share
            </button>
            <button type="button" disabled={pending} onClick={() => send(false)} className="sn-press inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold" style={{ color: 'var(--m-slate-1)' }}>
              Keep private
            </button>
          </div>
        </div>
      ) : null}
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <InfoTip label="Share this album to the event’s story" labelClassName="text-sm font-semibold" ariaLabel="About sharing" align="start">
            {ALBUM_SHARE_TIP}
          </InfoTip>
          <small className="block text-xs" style={{ color: 'var(--m-slate-3)' }}>
            {on ? 'On. It fills your own scene.' : 'Off. Only you see it.'}
          </small>
        </span>
        {canManage ? (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="Share this album to the event’s story"
            onClick={() => send(!on)}
            disabled={pending}
            className={SWITCH_BUTTON}
          >
            <SwitchTrack on={on} />
          </button>
        ) : null}
      </div>
      {said ? (
        <p role="status" className="mt-1 text-xs" style={{ color: 'var(--m-slate-2)' }}>
          {said}
          {href ? (
            <>
              {' '}
              <Link href={href} className="font-semibold underline">
                See plans
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
