'use client';

/**
 * MB16 · "Colour access" — the couple's control for ONE booked supplier.
 *
 * A port of `vendor-colour-access.html`'s vendor card, all three of its states:
 * on-narrow (the florist), on-wide with the stylist callout (the decorator),
 * and off with an empty log (the attire maker). It sits in the vendor
 * workspace between Conversation and Documents, and it is a SECTION on that
 * page rather than a page of its own — the couple manages one supplier in one
 * place.
 *
 * ── 🛑 CLIENT-SAFE IMPORTS ONLY ────────────────────────────────────────────
 * Everything this file needs comes from `lib/colour-access.ts`, which imports
 * nothing but `lib/mood-board.ts`'s pure vocabulary. MB12 shipped the other
 * shape to CI once — `lib/moodboard-finalization.ts` reaches `next/headers`
 * through taxonomy → vendor-counts → supabase/server, and neither `tsc` nor
 * `tsx --test` can see it. `scripts/lint-server-only-boundary.mjs` can.
 *
 * ── THE THREE CONTROLS ARE THREE CONTROLS ──────────────────────────────────
 * The switch grants and revokes. Reject puts ONE change back. Neither does the
 * other's job, and the copy says so at both ends — because a couple who
 * believes "Reject" also cuts somebody off will use it as one, and a couple who
 * believes turning the switch off undoes what already happened will be wrong
 * about their own board.
 */

import { useState, useTransition } from 'react';
import { Palette, Undo2 } from 'lucide-react';
import {
  COLOUR_DOMAIN_LABEL,
  describeColourChange,
  laneIsWide,
  scopeLine,
  type ColourChangeRow,
  type ColourDomain,
} from '@/lib/colour-access';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { ActionButton } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';

type Result = { status: string };

export type ColourAccessCardProps = {
  vendorId: string;
  /** The shop or supplier name as the workspace already prints it. */
  displayName: string;
  /** "Florist · booked for your reception" — resolved on the server. */
  tradeLine: string;
  /** The lane this booking's trade allows. EMPTY means no colour lane exists. */
  lane: readonly ColourDomain[];
  /** TRUE when at least one grant row for this booking is active. */
  isOn: boolean;
  /** This booking's own changes, newest first. */
  changes: readonly ColourChangeRow[];
  setAccessAction: (vendorId: string, active: boolean) => Promise<Result>;
  rejectAction: (changeId: string) => Promise<Result>;
};

export function ColourAccessCard(props: ColourAccessCardProps) {
  const {
    vendorId,
    displayName,
    tradeLine,
    lane,
    isOn,
    changes,
    setAccessAction,
    rejectAction,
  } = props;

  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(key: string, fn: () => Promise<Result>, onRefusal: Record<string, string>) {
    setBusy(key);
    setMessage(null);
    startTransition(async () => {
      try {
        const r = await fn();
        if (r.status !== 'ok') {
          setMessage(onRefusal[r.status] ?? 'That didn’t go through. Reload and try again.');
        }
      } catch {
        setMessage('That didn’t go through. Reload and try again.');
      } finally {
        setBusy(null);
      }
    });
  }

  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

  return (
    // 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 3 · 4 · 5 · 7 · 13): no card and no card inside it — the section's grey
    // capitals with the explaining behind ⓘ, then a setting row (who, and the switch on the right; on/off a soft chip),
    // the scope as plain lines, the log as hairline rows, and Reject the shared red pill.
    <section id="colour-access" aria-labelledby="colour-access-heading" className="space-y-1">
      <h2 id="colour-access-heading" className="mb-1 mt-[18px] flex items-center gap-2">
        <Palette aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        <InfoTip
          label="Colour access"
          labelAs="span"
          labelClassName="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70"
          align="start"
        >
          Let this supplier adjust colours in their own part of your design — you’ll always see what changed, and you can
          undo any single change without touching their access.
        </InfoTip>
      </h2>

      <div>
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-4 border-b border-ink/10 pb-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-terracotta/80 text-sm font-bold text-cream"
            >
              {initials || '—'}
            </span>
            <div>
              <p className="text-[15px] font-semibold text-ink">{displayName}</p>
              <p className="text-[13px] text-ink/70">{tradeLine}</p>
            </div>
          </div>

          {lane.length > 0 ? (
            <div className="flex flex-none items-center gap-2.5">
              <Badge tone={isOn ? 'ok' : 'quiet'}>{isOn ? 'On' : 'Off'}</Badge>
              <button
                type="button"
                role="switch"
                aria-checked={isOn}
                aria-label={`Colour access for ${displayName}`}
                disabled={busy === 'switch'}
                onClick={() =>
                  run('switch', () => setAccessAction(vendorId, !isOn), {
                    not_booked:
                      'Colour access needs a confirmed booking — this one isn’t contracted yet.',
                    no_lane: 'This trade has no colour lane on your board.',
                  })
                }
                className={SWITCH_BUTTON}
              >
                <SwitchTrack on={isOn} />
              </button>
            </div>
          ) : null}
        </div>

        {/* ── the scope, or why there is no switch ────────────────────────── */}
        {/* A booked planner never reaches this card: their colour domains are
            keyed to the PERSON, and the workspace draws the Promote-your-
            coordinator card for them instead (Hosts fold, 2026-09-30). */}
        {lane.length === 0 ? (
          <p className="pt-3 text-sm text-ink/70">
            This trade doesn’t shape any colour on your board, so there’s nothing here to
            hand over. Florists, stylists and attire makers are the ones who can.
          </p>
        ) : isOn ? (
          <>
            <p className="pt-3 text-sm leading-relaxed text-ink/70">
              Can change: <b className="font-semibold text-ink">{scopeLine(lane)}</b>.
              {laneIsWide(lane) ? '' : ' Nothing else in your board.'}
            </p>
            {laneIsWide(lane) ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-ink">
                <span aria-hidden>🔑</span>
                <InfoTip label="Wider than most suppliers" labelAs="span" labelClassName="font-semibold text-ink" align="start">
                  A change here can ripple into your palette, your 3D room, and anything else that reads your main
                  colours. You’ll be notified every time, either way.
                </InfoTip>
              </p>
            ) : null}
          </>
        ) : (
          <p className="pt-3 text-sm text-ink/70">
            Access is off. {displayName} cannot change any colours until you turn this on —
            turning it on or off never affects anything they’ve already built.
          </p>
        )}

        {/* ── the log ─────────────────────────────────────────────────────── */}
        {lane.length > 0 ? (
          <>
            <p className="mb-1 mt-[18px] text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
              Recent changes
            </p>
            {changes.length === 0 ? (
              <p className="py-2 text-sm text-ink/70">No changes yet.</p>
            ) : (
              <ul className="divide-y divide-ink/10">
                {changes.map((row) => (
                  <ColourChangeRowView
                    key={row.change_id}
                    row={row}
                    busy={busy === row.change_id}
                    onReject={() =>
                      run(row.change_id, () => rejectAction(row.change_id), {
                        already: 'You already put that one back.',
                        frozen:
                          'That part has been signed off since, so its colour can’t move — ask the supplier to re-open it first.',
                        slot_gone:
                          'That colour slot no longer exists on your board, so there’s nowhere to put it back.',
                      })
                    }
                  />
                ))}
              </ul>
            )}
          </>
        ) : null}

        {message ? (
          <p role="alert" className="mt-3 text-[13px] text-[rgb(var(--color-danger))]">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * One log line.
 *
 * ⚠ THE SWATCH SHOWS THE NEW COLOUR, AND A REVERTED ROW GREYS OUT INSTEAD OF
 * DISAPPEARING. A change the couple undid still happened, and a log that
 * silently drops it cannot answer "did I already deal with this one?" — which
 * is the only question somebody re-reading this list has.
 */
export function ColourChangeRowView({
  row,
  busy,
  onReject,
  showDomain = false,
}: {
  row: ColourChangeRow;
  busy: boolean;
  onReject: () => void;
  showDomain?: boolean;
}) {
  const said = describeColourChange(row);
  const reverted = row.reverted_at !== null;
  return (
    <li className="flex min-h-14 items-center gap-3 py-2.5">
      <span
        aria-hidden
        className="h-[26px] w-[26px] flex-none rounded-md border border-ink/10"
        style={{ backgroundColor: reverted ? 'transparent' : said.to, opacity: reverted ? 0.4 : 1 }}
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-[15px] ${reverted ? 'text-ink/70 line-through' : 'text-ink'}`}
        >
          {said.what} — {said.from ? `${said.from} → ` : ''}
          <b className="font-semibold">{said.to}</b>
        </p>
        <p className="mt-0.5 text-[13px] text-ink/70">
          {formatWhen(row.created_at)}
          {row.actor_label ? ` · ${row.actor_label}` : ''}
          {showDomain ? ` · ${COLOUR_DOMAIN_LABEL[row.domain as ColourDomain] ?? row.domain}` : ''}
        </p>
      </div>
      {reverted ? (
        <Badge tone="quiet">Reverted by you</Badge>
      ) : (
        <ActionButton tone="danger" icon={Undo2} label={busy ? 'Rejecting…' : 'Reject'} onClick={onReject} waiting={busy} />
      )}
    </li>
  );
}

/** "Sep 4, 2:14 PM" — the prototype's own stamp. */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
}
