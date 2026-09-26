'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { ChevronRight } from 'lucide-react';
import { hubDraftAction } from '../../website/hub-draft-actions';
import { InfoTip } from '@/app/_components/info-tip';
import {
  ONE_AT_A_TIME_TIP,
  RSVP_ASK_FIELDS,
  RSVP_ASK_LABEL,
  RSVP_ASK_TIP,
  WHO_CAN_RSVP,
  WHO_CAN_RSVP_LABEL,
  WHO_CAN_RSVP_TIP,
  readOneAtATime,
  readWhoCanRsvp,
  rsvpAsks,
  type RsvpAskConfig,
  type WhoCanRsvp,
} from '@/lib/rsvp-ask';

/**
 * THE RSVP PAGE'S CONTROLS — the Maker's own RSVP page (guest pathway brief
 * item 5; owner 2026-09-27: *"RSVP is its own made-once page in the Maker bar"*,
 * prototype `rsvp-variants-2026-09-27.html` → maker.png). In order:
 *
 *   · Ask one question at a time   (`rsvp_ask_config.oneAtATime`)
 *   · What do you ask your guests? (the six switches — MOVED here from Details;
 *                                   owner 2026-09-25: *"yes on and off"*)
 *   · Who can RSVP?                (`rsvp_ask_config.whoCanRsvp` — ONE stored
 *                                   value; Guest List → Invite reads the same)
 *   · Reply by                     (the couple's deadline, or 30 days before)
 *   · Requests waiting (n)         → Open Requests
 *
 * 💾 THE DRAFT, NEVER LIVE — and ONE object. All three settings live in the
 * same `events.rsvp_ask_config`, so they share ONE local copy here and every
 * press posts the WHOLE object to `hubDraftAction` intent=save (the one generic
 * draft action; ZERO new server-action exports). Two components each holding
 * their own copy would overwrite each other's change with a stale object.
 * Guests keep what they have until the couple presses Apply.
 *
 * `attending` is not a row — the owner's own list marks it "always on, not
 * switchable" — so it is drawn as a fixed line, never a switch.
 */
export function MakerRsvpSettings({
  eventId,
  current,
  drafted,
  replyBy,
  replyByHref,
  requests,
}: {
  eventId: string;
  /** The drafted-over-live config (sparse — an absent question key is ON). */
  current: RsvpAskConfig;
  /** The draft holds a different config from what guests see. */
  drafted: boolean;
  /** `resolveReplyBy` — the couple's deadline, or the 30-day default; null with no date. */
  replyBy: { date: string; isDefault: boolean } | null;
  /** Where the reply-by date is set (the guest-list deadline). */
  replyByHref: string;
  /** Who is waiting in Guest List → Requests. `count: null` = could not be read. */
  requests: { count: number | null; href: string };
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<RsvpAskConfig>(current);

  const save = (patch: RsvpAskConfig) =>
    start(async () => {
      setError(null);
      const next: RsvpAskConfig = { ...local, ...patch };
      setLocal(next);
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ events: { rsvp_ask_config: next } }));
        const r = await hubDraftAction(eventId, fd);
        if (!r.ok) {
          setError(r.error);
          setLocal(current); // the save was refused — do not show a switch that did not take
        }
      } catch {
        setError('That did not save. Please try again.');
        setLocal(current);
      }
    });

  const oneAtATime = readOneAtATime(local);
  const who = readWhoCanRsvp(local);

  return (
    <div className="flex flex-col gap-5 px-1" data-made-once="rsvp-page">
      {/* ── Ask one question at a time ── */}
      <section className="flex flex-col gap-1" data-rsvp-setting="one-at-a-time">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <InfoTip label="Ask one question at a time" align="start">
            {ONE_AT_A_TIME_TIP}
          </InfoTip>
        </p>
        <Switch
          label={oneAtATime ? 'On · one question per screen' : 'Off · one scrolling page'}
          on={oneAtATime}
          disabled={pending}
          onChange={(v) => save({ oneAtATime: v })}
        />
      </section>

      {/* ── What do you ask your guests? (moved here from Details) ── */}
      <section className="flex flex-col gap-1" data-made-once="rsvp-ask">
        <p className="text-sm font-semibold text-ink">What do you ask your guests?</p>
        <div className="flex min-h-11 items-center justify-between gap-3 border-b border-ink/5 py-2 text-sm text-ink/55">
          <span>Attending</span>
          <span className="text-xs">always</span>
        </div>
        <div className="flex flex-col">
          {RSVP_ASK_FIELDS.map((field) => (
            <Switch
              key={field}
              label={
                <InfoTip label={RSVP_ASK_LABEL[field]} align="start">
                  {RSVP_ASK_TIP[field]}
                </InfoTip>
              }
              on={rsvpAsks(local, field)}
              disabled={pending}
              onChange={(v) => save({ [field]: v })}
            />
          ))}
        </div>
        <p className="text-xs text-ink/60">Nobody&rsquo;s answer is deleted by turning a question off.</p>
      </section>

      {/* ── Who can RSVP? — ONE stored value ── */}
      <section className="flex flex-col gap-2" data-rsvp-setting="who-can-rsvp">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <InfoTip label="Who can RSVP?" align="start">
            {WHO_CAN_RSVP_TIP}
          </InfoTip>
        </p>
        <div role="radiogroup" aria-label="Who can RSVP?" className="grid grid-cols-2 gap-1 rounded-full bg-ink/5 p-1">
          {WHO_CAN_RSVP.map((value: WhoCanRsvp) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={who === value}
              disabled={pending}
              onClick={() => (who === value ? undefined : save({ whoCanRsvp: value }))}
              className={`sn-press min-h-11 rounded-full px-3 text-[13px] font-semibold transition-colors duration-sn-control ease-sn disabled:opacity-60 ${
                who === value ? 'bg-white text-ink shadow-sm' : 'text-ink/60 hover:text-ink'
              }`}
            >
              {WHO_CAN_RSVP_LABEL[value]}
            </button>
          ))}
        </div>
      </section>

      {/* ── Reply by ── */}
      <section className="flex flex-col gap-1" data-rsvp-setting="reply-by">
        <p className="text-sm font-semibold text-ink">Reply by</p>
        <Link
          href={replyByHref}
          className="flex min-h-11 items-center justify-between gap-3 border-b border-ink/10 py-2 text-ink hover:text-ink/80"
        >
          {replyBy ? (
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-base font-semibold" data-reply-by={replyBy.date}>
                {formatDay(replyBy.date)}
              </span>
              <span className="text-sm text-ink/60">{replyBy.isDefault ? '· 30 days before' : '· your date'}</span>
            </span>
          ) : (
            <span className="text-sm text-ink/60">Set your event date first</span>
          )}
          <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={2} />
        </Link>
      </section>

      {/* ── Requests waiting ── */}
      <section className="flex flex-col gap-2" data-rsvp-setting="requests">
        <p className="text-sm font-semibold text-ink">Requests waiting</p>
        {requests.count === null ? (
          <p role="alert" className="text-[13px] text-terracotta-700">
            We couldn&rsquo;t count your requests just now — this does not mean there are none.
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <span className="font-serif text-4xl leading-none text-ink" data-requests-count={requests.count}>
              {requests.count}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-ink/70">
              {requests.count === 0 ? 'Nobody is waiting' : requests.count === 1 ? 'person asked to join' : 'people asked to join'}
            </span>
            <Link
              href={requests.href}
              className="sn-press inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-ink px-4 text-[13px] font-semibold text-cream hover:bg-ink/90"
            >
              Open Requests <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        )}
      </section>

      {drafted ? (
        <p className="text-[12px] font-semibold text-terracotta-700" data-made-once-drafted="">
          In your draft — guests see it after you Apply.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** "18 November 2026" from `YYYY-MM-DD`, without a timezone shift. */
function formatDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** One on/off row — the switch the six questions have always used. */
function Switch({
  label,
  on,
  disabled,
  onChange,
}: {
  label: React.ReactNode;
  on: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 border-b border-ink/5 py-2 last:border-0">
      <span className="flex items-center gap-1.5 text-sm text-ink">{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={on}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-full bg-ink/20 transition-colors duration-sn-control ease-sn after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-sn-control after:ease-sn peer-checked:bg-terracotta-700 peer-checked:after:translate-x-5 peer-disabled:opacity-40"
      />
    </label>
  );
}
