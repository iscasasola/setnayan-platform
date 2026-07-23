'use client';

// Papic Games — the guest Photo Challenge panel on the capture surface (spec §5#3).
// Shows the guest's live missions + their own progress, and lets them mark one
// done by attaching the photo they just took. The §4 share consent is a SEPARATE,
// PER-VENDOR tap that appears once a VENDOR mission is done ("Share this photo with
// <vendor>?", §4.1) — and it doubles as the RA 10173 §16 withdrawal path (Share ⇄
// Keep private, anytime). Flag-gated (papicGamesEnabled) — renders nothing until
// NEXT_PUBLIC_PAPIC_GAMES_V1 is on. guest_id is never touched here: every endpoint
// derives it from the setnayan_guest_session cookie server-side.

import { useCallback, useEffect, useState } from 'react';
import { Camera, Check, ChevronDown, Loader2, Trophy } from 'lucide-react';
import { papicGamesEnabled } from '@/lib/papic-games-flag';
import {
  MISSION_TYPE_LABELS,
  missionProgress,
  sortGuestMissions,
} from '@/lib/papic-missions';
import type { GuestMissionRow } from '@/lib/papic-missions';

type Props = {
  /** The id of the guest's most recent capture, lifted from the parent camera.
   *  A challenge is completed by attaching this shot, so the action is only
   *  enabled once the guest has taken at least one. */
  lastCaptureId: string | null;
  /** The media kind of that last shot — a challenge completes with EITHER a photo
   *  or a video, so the button names whichever they just took. */
  lastCaptureKind?: 'photo' | 'clip' | null;
};

export function PapicChallengePanel({ lastCaptureId, lastCaptureKind }: Props) {
  // Hard flag gate — no fetch, no render, nothing mounts until the owner flips it.
  if (!papicGamesEnabled()) return null;
  return <ChallengePanelInner lastCaptureId={lastCaptureId} lastCaptureKind={lastCaptureKind} />;
}

function ChallengePanelInner({ lastCaptureId, lastCaptureKind }: Props) {
  // Name the last shot: "photo" / "video" once taken, generic "shot" before.
  const shotNoun =
    lastCaptureKind === 'clip' ? 'video' : lastCaptureKind === 'photo' ? 'photo' : 'shot';
  const [missions, setMissions] = useState<GuestMissionRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/papic/guest-missions', { cache: 'no-store' });
      if (!res.ok) return;
      const json = (await res.json()) as { missions?: GuestMissionRow[] };
      setMissions(Array.isArray(json.missions) ? json.missions : []);
    } catch {
      // best-effort — a fetch hiccup just leaves the panel hidden this render.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const complete = useCallback(
    async (missionId: string) => {
      if (!lastCaptureId) {
        setError('Take a photo or video first, then tap a challenge to mark it done.');
        return;
      }
      setBusyId(missionId);
      setError(null);
      try {
        const res = await fetch('/api/papic/guest-complete-mission', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          // Consent is a SEPARATE per-vendor tap AFTER completion (§4.1) — never
          // bundled into the completion. A challenge always completes as private.
          body: JSON.stringify({ missionId, captureId: lastCaptureId, consentToShare: false }),
        });
        if (!res.ok) {
          setError("Couldn't save that one — try again.");
          return;
        }
        await refresh();
      } catch {
        setError("Couldn't save that one — try again.");
      } finally {
        setBusyId(null);
      }
    },
    [lastCaptureId, refresh],
  );

  // Grant OR withdraw the per-vendor share on a completed mission (§4.1 / §16).
  const setShare = useCallback(
    async (missionId: string, consent: boolean) => {
      setBusyId(missionId);
      setError(null);
      try {
        const res = await fetch('/api/papic/guest-mission-consent', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ missionId, consent }),
        });
        if (!res.ok) {
          setError("Couldn't update sharing — try again.");
          return;
        }
        await refresh();
      } catch {
        setError("Couldn't update sharing — try again.");
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  // Nothing to show until loaded, and hide entirely when this event has no live
  // challenges (no booked vendors / no couple missions) — no empty shell.
  if (!missions || missions.length === 0) return null;

  const { done, total, allDone } = missionProgress(missions);
  const ordered = sortGuestMissions(missions);

  return (
    <section
      className="mx-auto w-full max-w-sm rounded-xl border border-cream/15 bg-cream/5"
      aria-label="Papic Challenges"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left"
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium text-cream/90">
          <Trophy aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
          Papic Challenges
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${
              allDone ? 'bg-mulberry/30 text-cream' : 'bg-cream/10 text-cream/70'
            }`}
          >
            {done}/{total}
          </span>
          <ChevronDown
            aria-hidden
            className={`h-4 w-4 text-cream/50 transition ${open ? 'rotate-180' : ''}`}
            strokeWidth={2}
          />
        </span>
      </button>

      {open ? (
        <div className="space-y-2.5 px-3.5 pb-3.5">
          {allDone ? (
            <p className="text-xs text-cream/80">
              All done — you completed every challenge. 🎉
            </p>
          ) : (
            <p className="text-xs text-cream/55">
              Take a photo or a short video for each one, then tap “use my last shot.”
            </p>
          )}

          <ul className="space-y-2">
            {ordered.map((m) => {
              const label = MISSION_TYPE_LABELS[m.mission_type] ?? 'Challenge';
              const busy = busyId === m.mission_id;
              const isVendorMission = Boolean(m.vendor_id && m.vendor_name);
              return (
                <li
                  key={m.mission_id}
                  className={`rounded-lg border px-3 py-2.5 ${
                    m.completed
                      ? 'border-mulberry/40 bg-mulberry/15'
                      : 'border-cream/12 bg-cream/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-cream/45">
                        {label}
                      </p>
                      <p className="mt-0.5 text-sm text-cream/90">{m.prompt}</p>
                    </div>
                    {m.completed ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-mulberry/30 px-2.5 py-1 text-xs font-medium text-cream">
                        <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
                        Done
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void complete(m.mission_id)}
                        disabled={busy || !lastCaptureId}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-mulberry px-3 py-1.5 text-xs font-medium text-cream transition hover:bg-mulberry-600 disabled:opacity-40"
                      >
                        {busy ? (
                          <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                        ) : (
                          <Camera aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                        )}
                        Use my last {shotNoun}
                      </button>
                    )}
                  </div>

                  {/* §4.1 per-vendor share tap — appears only once a VENDOR mission
                      is done. Explicit, default private; Share ⇄ Keep private is
                      also the RA 10173 §16 withdrawal path. Vendorless (couple)
                      missions never show it. */}
                  {m.completed && isVendorMission ? (
                    <div className="mt-2 rounded-lg border border-cream/12 bg-cream/5 px-2.5 py-2">
                      <p className="text-[11px] text-cream/75">
                        Share this photo with{' '}
                        <span className="font-medium text-cream/90">{m.vendor_name}</span>?
                      </p>
                      <div className="mt-1.5 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => void setShare(m.mission_id, true)}
                          disabled={busy}
                          aria-pressed={m.consent_shared}
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-40 ${
                            m.consent_shared
                              ? 'bg-mulberry text-cream'
                              : 'bg-cream/10 text-cream/70 hover:bg-cream/20'
                          }`}
                        >
                          {busy && !m.consent_shared ? (
                            <Loader2 aria-hidden className="h-3 w-3 animate-spin" strokeWidth={2} />
                          ) : null}
                          Share
                        </button>
                        <button
                          type="button"
                          onClick={() => void setShare(m.mission_id, false)}
                          disabled={busy}
                          aria-pressed={!m.consent_shared}
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-40 ${
                            !m.consent_shared
                              ? 'bg-cream/20 text-cream'
                              : 'bg-cream/10 text-cream/60 hover:bg-cream/20'
                          }`}
                        >
                          Keep private
                        </button>
                      </div>
                      <p className="mt-1 text-[10px] text-cream/40">
                        {m.consent_shared
                          ? 'Shared — you can change this anytime.'
                          : 'Private by default. The couple gets your photos either way.'}
                      </p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {!lastCaptureId ? (
            <p className="text-[11px] text-cream/45">
              Take a photo or video above, then come back to mark a challenge done.
            </p>
          ) : null}
          {error ? <p className="text-xs text-terracotta">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
