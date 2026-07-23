'use client';

// Papic Games — the guest Papic Challenges panel on the capture surface (spec §5#3).
//
// SELECT → COMMENCE → RETAKE (owner 2026-07-23): the guest ARMS a challenge
// ("Start"), then shoots — the NEXT capture carries the armed challenge and
// completes it automatically. A cleared challenge shows "Retake": re-arm, and
// the next shot REPLACES the attachment (the shipped papic_complete_mission
// RPC upserts one row per (mission, guest), so a re-call with the new
// capture_id updates it). Points are metered at CAPTURE time and are NEVER
// refunded on a retake — the older shot's points stay spent and the shot
// itself stays in the host's pool (untagged-still-delivered). Nothing here
// touches the meter.
//
// The §4 share consent is a SEPARATE, PER-VENDOR tap that appears once a
// VENDOR mission is done ("Share this photo with <vendor>?", §4.1) — and it
// doubles as the RA 10173 §16 withdrawal path (Share ⇄ Keep private, anytime).
// CONSENT IS PER PHOTO: every completion (first shot AND every retake) posts
// consentToShare:false, and the RPC's upsert overwrites the stored consent —
// so a retake RESETS sharing to private and the tap is re-asked fresh for the
// NEW artifact. The old photo's consent never silently carries over.
//
// Flag-gated (papicGamesEnabled) — renders nothing until
// NEXT_PUBLIC_PAPIC_GAMES_V1 is on. guest_id is never touched here: every
// endpoint derives it from the setnayan_guest_session cookie server-side.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, ChevronDown, Loader2, RotateCcw, Trophy, X } from 'lucide-react';
import { papicGamesEnabled } from '@/lib/papic-games-flag';
import {
  MISSION_TYPE_LABELS,
  missionProgress,
  sortGuestMissions,
} from '@/lib/papic-missions';
import type { GuestMissionRow } from '@/lib/papic-missions';

/** The armed challenge, surfaced to the parent so the capture stage can show
 *  an "armed" indicator next to the shutter. */
export type ArmedChallenge = {
  missionId: string;
  prompt: string;
  /** True when re-arming a cleared challenge (the new shot replaces the old). */
  retake: boolean;
};

type Props = {
  /** The id of the guest's most recent capture, lifted from the parent camera.
   *  When a challenge is ARMED, the next NEW value completes it automatically. */
  lastCaptureId: string | null;
  /** The media kind of that last shot — completion copy names whichever they
   *  just took (photo or video). */
  lastCaptureKind?: 'photo' | 'clip' | null;
  /** Reports the armed challenge (or null) so the capture stage can show it. */
  onArmedChange?: (armed: ArmedChallenge | null) => void;
  /** Link into the guest's own Story maker (/papic/me/[token]#story) — the
   *  challenge-completion reward CTA. Server-resolved from the guest session;
   *  absent → no reward CTA renders. */
  storyHref?: string | null;
};

export function PapicChallengePanel({
  lastCaptureId,
  lastCaptureKind,
  onArmedChange,
  storyHref,
}: Props) {
  // Hard flag gate — no fetch, no render, nothing mounts until the owner flips it.
  if (!papicGamesEnabled()) return null;
  return (
    <ChallengePanelInner
      lastCaptureId={lastCaptureId}
      lastCaptureKind={lastCaptureKind}
      onArmedChange={onArmedChange}
      storyHref={storyHref}
    />
  );
}

function ChallengePanelInner({
  lastCaptureId,
  lastCaptureKind,
  onArmedChange,
  storyHref,
}: Props) {
  // Name the last shot: "photo" / "video" once taken, generic "shot" before.
  const shotNoun =
    lastCaptureKind === 'clip' ? 'video' : lastCaptureKind === 'photo' ? 'photo' : 'shot';
  const [missions, setMissions] = useState<GuestMissionRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // SELECT → COMMENCE: the armed challenge + the capture id AT arm time, so
  // only a NEW capture (taken after arming) completes it — never a stale shot.
  const [armed, setArmed] = useState<
    (ArmedChallenge & { captureIdAtArm: string | null }) | null
  >(null);
  // The mission a capture just attached to (highlights the fresh consent ask).
  const [justAttached, setJustAttached] = useState<ArmedChallenge | null>(null);
  // Re-entrancy latch for the auto-complete effect (StrictMode double-invoke,
  // rapid captures) — never two completion POSTs for one armed challenge.
  const completingRef = useRef(false);
  const onArmedChangeRef = useRef(onArmedChange);
  useEffect(() => {
    onArmedChangeRef.current = onArmedChange;
  }, [onArmedChange]);

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

  const arm = useCallback(
    (m: GuestMissionRow, retake: boolean) => {
      const next: ArmedChallenge & { captureIdAtArm: string | null } = {
        missionId: m.mission_id,
        prompt: m.prompt,
        retake,
        captureIdAtArm: lastCaptureId,
      };
      setArmed(next);
      setJustAttached(null);
      setError(null);
      onArmedChangeRef.current?.({
        missionId: next.missionId,
        prompt: next.prompt,
        retake: next.retake,
      });
      // Collapse the list so the stage + shutter are front and center.
      setOpen(false);
    },
    [lastCaptureId],
  );

  const disarm = useCallback(() => {
    setArmed(null);
    onArmedChangeRef.current?.(null);
  }, []);

  // COMMENCE — a NEW capture arrived while a challenge is armed: attach it.
  // Always posts consentToShare:false (§4 — consent is per photo and re-asked
  // fresh; the RPC upsert resets any previous share on a retake).
  useEffect(() => {
    if (!armed || !lastCaptureId || lastCaptureId === armed.captureIdAtArm) return;
    if (completingRef.current) return;
    completingRef.current = true;
    const target: ArmedChallenge = {
      missionId: armed.missionId,
      prompt: armed.prompt,
      retake: armed.retake,
    };
    setArmed(null);
    onArmedChangeRef.current?.(null);
    setBusyId(target.missionId);
    setError(null);
    void (async () => {
      try {
        const res = await fetch('/api/papic/guest-complete-mission', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            missionId: target.missionId,
            captureId: lastCaptureId,
            consentToShare: false,
          }),
        });
        if (!res.ok) {
          setError("Couldn't save that one — tap Start and try again.");
          return;
        }
        setJustAttached(target);
        await refresh();
        // Reveal the completed row → the fresh §4 consent tap + the reward.
        setOpen(true);
      } catch {
        setError("Couldn't save that one — tap Start and try again.");
      } finally {
        setBusyId(null);
        completingRef.current = false;
      }
    })();
  }, [armed, lastCaptureId, refresh]);

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
          {armed ? (
            <span className="rounded-full bg-terracotta/80 px-2 py-0.5 text-[11px] font-medium text-cream">
              armed
            </span>
          ) : null}
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
              Tap “Start” on a challenge, then shoot — your next photo or video
              counts for it.
            </p>
          )}

          <ul className="space-y-2">
            {ordered.map((m) => {
              const label = MISSION_TYPE_LABELS[m.mission_type] ?? 'Challenge';
              const busy = busyId === m.mission_id;
              const isArmed = armed?.missionId === m.mission_id;
              const attachedHere = justAttached?.missionId === m.mission_id;
              const isVendorMission = Boolean(m.vendor_id && m.vendor_name);
              return (
                <li
                  key={m.mission_id}
                  className={`rounded-lg border px-3 py-2.5 ${
                    m.completed
                      ? 'border-mulberry/40 bg-mulberry/15'
                      : isArmed
                        ? 'border-terracotta/60 bg-terracotta/10'
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
                    {isArmed ? (
                      <button
                        type="button"
                        onClick={disarm}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-terracotta/80 px-2.5 py-1 text-xs font-medium text-cream transition hover:bg-terracotta"
                      >
                        <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
                        Cancel
                      </button>
                    ) : m.completed ? (
                      <span className="inline-flex shrink-0 items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-mulberry/30 px-2.5 py-1 text-xs font-medium text-cream">
                          <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
                          Done
                        </span>
                        <button
                          type="button"
                          onClick={() => arm(m, true)}
                          disabled={busy}
                          className="inline-flex items-center gap-1 rounded-full bg-cream/10 px-2.5 py-1 text-xs font-medium text-cream/80 transition hover:bg-cream/20 disabled:opacity-40"
                        >
                          {busy ? (
                            <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                          ) : (
                            <RotateCcw aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                          )}
                          Retake
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => arm(m, false)}
                        disabled={busy}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-mulberry px-3 py-1.5 text-xs font-medium text-cream transition hover:bg-mulberry-600 disabled:opacity-40"
                      >
                        {busy ? (
                          <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                        ) : (
                          <Camera aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                        )}
                        Start
                      </button>
                    )}
                  </div>

                  {isArmed ? (
                    <p className="mt-1.5 text-[11px] text-cream/70">
                      Armed — your next shot counts for this one.
                      {armed?.retake
                        ? ' The new shot replaces the old one (your earlier shot stays in the gallery).'
                        : ''}
                    </p>
                  ) : null}

                  {attachedHere ? (
                    <p className="mt-1.5 text-[11px] text-cream/80">
                      {justAttached?.retake
                        ? `New ${shotNoun} attached — it replaced your earlier shot. Sharing is reset to private for this new ${shotNoun}.`
                        : `Your ${shotNoun} is in — challenge complete!`}
                    </p>
                  ) : null}

                  {/* §4.1 per-vendor share tap — appears only once a VENDOR mission
                      is done. Explicit, default private; Share ⇄ Keep private is
                      also the RA 10173 §16 withdrawal path. Every completion —
                      first shot or retake — resets this to private, so the ask is
                      fresh PER PHOTO. Vendorless (couple) missions never show it. */}
                  {m.completed && isVendorMission ? (
                    <div className="mt-2 rounded-lg border border-cream/12 bg-cream/5 px-2.5 py-2">
                      <p className="text-[11px] text-cream/75">
                        Share this {attachedHere ? shotNoun : 'photo'} with{' '}
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
                          : 'Private by default. The host gets your photos either way.'}
                      </p>
                    </div>
                  ) : null}

                  {/* 🎁 The completion REWARD (owner 2026-07-23): a completed
                      challenge earns a free client-side Story. Shown AFTER the
                      consent tap; links into the guest's own Story maker
                      (download-only — nothing is stored server-side). */}
                  {m.completed && storyHref ? (
                    <a
                      href={storyHref}
                      className="mt-2 block rounded-lg border border-mulberry/40 bg-mulberry/10 px-2.5 py-2 text-[12px] font-medium text-cream/90 transition hover:bg-mulberry/20"
                    >
                      🎁 You earned a Story — make yours →
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {error ? <p className="text-xs text-terracotta">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
