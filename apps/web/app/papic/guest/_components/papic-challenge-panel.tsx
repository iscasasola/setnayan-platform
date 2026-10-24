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
import { Check, Loader2, Trophy } from 'lucide-react';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { papicGamesEnabled } from '@/lib/papic-games-flag';
import {
  MISSION_TYPE_LABELS,
  missionProgress,
  sortGuestMissions,
} from '@/lib/papic-missions';
import type { GuestMissionRow } from '@/lib/papic-missions';
import { formatCount } from '@/lib/format-number';

// 📷 ONE PILL, NOT A PANEL (owner-approved prototype 2026-10-24,
// `papic_camera_complete_2026-10-24_fable.html`; controller review of #6865):
// "Challenge · Catch the first dance ▾" sits LEFT of Photo ⇄ Snippet and opens
// the event's running challenges as ONE dropdown (PickMenu — "any set of
// choices is a dropdown"). The panel that sat below the shutter is gone. The
// mechanic is unchanged — the same fetch, the same Start / Retake / Cancel, the
// same per-photo consent — split into a hook (`useGuestChallenges`), the pill
// (`ChallengePill`) and the one line that follows a completion
// (`ChallengeFollowUp`: the pause notice, "challenge complete", the §4.1 share
// ask, the Story reward). The §16 withdrawal ("Share ⇄ Keep private, anytime")
// stays reachable from the pill's "Sharing" group.

/** The armed challenge, surfaced to the parent so the capture stage can show
 *  an "armed" indicator next to the shutter. */
export type ArmedChallenge = {
  missionId: string;
  prompt: string;
  /** True when re-arming a cleared challenge (the new shot replaces the old). */
  retake: boolean;
};

type Input = {
  /** The id of the guest's most recent capture, lifted from the parent camera.
   *  When a challenge is ARMED, the next NEW value completes it automatically. */
  lastCaptureId: string | null;
  /** The media kind of that last shot — completion copy names whichever they
   *  just took (photo or video). */
  lastCaptureKind?: 'photo' | 'clip' | null;
  /** Reports the armed challenge (or null) so the capture stage can show it. */
  onArmedChange?: (armed: ArmedChallenge | null) => void;
};

export type GuestChallenges = ReturnType<typeof useGuestChallenges>;

/**
 * The challenges' state and actions. Hard flag gate: with
 * NEXT_PUBLIC_PAPIC_GAMES_V1 off nothing is fetched and `ready` stays false, so
 * neither the pill nor the follow-up line draws.
 */
export function useGuestChallenges({ lastCaptureId, lastCaptureKind, onArmedChange }: Input) {
  const enabled = papicGamesEnabled();
  // Name the last shot: "photo" / "video" once taken, generic "shot" before.
  const shotNoun =
    lastCaptureKind === 'clip' ? 'video' : lastCaptureKind === 'photo' ? 'photo' : 'shot';
  const [missions, setMissions] = useState<GuestMissionRow[] | null>(null);
  // ⏸ The coordinator has quieted the challenges so the room can watch the
  // moment (owner 2026-09-01). NOT a reason to empty this list: the board stays
  // exactly as it is and this drives a notice over it. An empty board would be
  // byte-identical to a celebration with no challenges at all.
  const [paused, setPaused] = useState(false);
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
      const json = (await res.json()) as { missions?: GuestMissionRow[]; paused?: boolean };
      setMissions(Array.isArray(json.missions) ? json.missions : []);
      // The route always sends this; `=== true` keeps an older cached response
      // (or a field the route omitted) from reading as "paused" and quieting a
      // board nobody paused.
      setPaused(json.paused === true);
    } catch {
      // best-effort — a fetch hiccup just leaves the panel hidden this render.
    }
  }, []);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

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
        // The follow-up line under the shutter now asks the fresh §4 consent + shows the reward.
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

  const ready = enabled && !!missions && missions.length > 0;
  return { ready, missions: missions ?? [], paused, armed, justAttached, busyId, error, shotNoun, arm, disarm, setShare };
}

const NONE = 'none';

/** "Challenge · Catch the first dance ▾" — the active challenge; the list opens as one dropdown. */
export function ChallengePill({ c }: { c: GuestChallenges }) {
  if (!c.ready) return null;
  const ordered = sortGuestMissions(c.missions);
  const { done, total } = missionProgress(c.missions);
  const options: PickOption[] = [
    ...ordered.map((m) => ({
      // A done challenge's key starts `d:` — greyed by the rule below, still pickable (retake).
      key: `${m.completed && c.armed?.missionId !== m.mission_id ? 'd' : 'm'}:${m.mission_id}`,
      label: m.prompt,
      group: 'Challenges',
      hint: `${MISSION_TYPE_LABELS[m.mission_type] ?? 'Challenge'}${
        m.capture_kind === 'clip' ? ' · Clip' : m.capture_kind === 'photo' ? ' · Photo' : ''
      } · ${
        c.armed?.missionId === m.mission_id
          ? 'armed — your next shot counts'
          : m.completed
            ? 'done — pick to retake (the new shot replaces it)'
            : 'pick, then shoot'
      }`,
      trail: m.completed ? { text: '✓', tone: 'ok' as const, label: 'Done' } : undefined,
      dot: c.armed?.missionId === m.mission_id,
      dotNote: 'armed',
      disabledNote: c.busyId === m.mission_id ? 'saving…' : undefined,
    })),
    ...(c.armed ? [{ key: NONE, label: 'Cancel the challenge', group: 'Challenges' }] : []),
    // §16 — the per-vendor share can be withdrawn (or given) any time, per photo.
    ...ordered
      .filter((m) => m.completed && m.vendor_id && m.vendor_name)
      .map((m) => ({
        key: `s:${m.mission_id}`,
        label: m.consent_shared ? `Stop sharing with ${m.vendor_name}` : `Share with ${m.vendor_name}`,
        group: 'Sharing',
        hint: m.consent_shared ? 'Shared — you can change this anytime.' : 'Private by default. The host gets your photos either way.',
      })),
  ];
  const onPick = (key: string) => {
    if (key === NONE) return c.disarm();
    const id = key.slice(2);
    const m = c.missions.find((x) => x.mission_id === id);
    if (!m) return;
    if (key.startsWith('s:')) return void c.setShare(id, !m.consent_shared);
    if (c.armed?.missionId === id) return c.disarm();
    c.arm(m, m.completed);
  };
  return (
    <>
      {/* Done ones greyed (owner 2026-10-24) — the list is portalled to <body>, so the rule is global and keyed. */}
      <style>{'[data-pick-option^="d:"]{opacity:.55}'}</style>
      <PickMenu
      label="Papic Challenges"
      value={c.armed ? `m:${c.armed.missionId}` : null}
      options={options}
      onPick={onPick}
      dataAttr="data-camera-challenge"
      compact
      buttonText={c.armed ? `Challenge · ${c.armed.prompt}` : `Challenges · ${formatCount(done)}/${formatCount(total)}`}
      className="!min-h-[34px] max-w-[200px] !bg-cream/10 !px-3 !text-[12.5px] !font-medium !text-cream hover:!bg-cream/20 [&_svg]:!text-cream/60"
      />
    </>
  );
}

/** The one line a challenge adds under the shutter: the pause, a completion, its share ask, the reward, an error. */
export function ChallengeFollowUp({ c, storyHref }: { c: GuestChallenges; storyHref?: string | null }) {
  if (!c.ready) return null;
  const attached = c.justAttached ? c.missions.find((m) => m.mission_id === c.justAttached!.missionId) ?? null : null;
  const busy = attached ? c.busyId === attached.mission_id : false;
  const isVendorMission = Boolean(attached?.vendor_id && attached?.vendor_name);
  const { allDone } = missionProgress(c.missions);
  const paused = c.paused;
  return (
    <>
      {/* ⏸ THE PAUSE HAS TO REACH THE PIXEL, OR IT IS NOTHING. A guest who
          opens this during the vows must be told why nothing is being asked —
          otherwise the quiet reads as a broken app, and they go looking for a
          challenge to answer, which is the one thing the pause exists to stop.
          🔴 The camera is deliberately NOT mentioned as unavailable, because it
          is not: photographing the moment is exactly what we want them doing. */}
      {paused ? (
        <p role="status" data-challenge-paused="" className="text-center text-xs text-cream/80">
          Challenges are paused &mdash; everyone&rsquo;s watching right now. Keep taking photos; these come back in a moment.
        </p>
      ) : null}
      {attached ? (
        <div data-challenge-done="" className="space-y-1.5 text-center text-xs text-cream/85">
          <p className="inline-flex items-center gap-1.5">
            <Trophy aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            {c.justAttached?.retake
              ? `New ${c.shotNoun} attached — it replaced your earlier shot. Sharing is reset to private for this new ${c.shotNoun}.`
              : `Your ${c.shotNoun} is in — challenge complete!`}
            {allDone ? ' All done. 🎉' : ''}
          </p>
          {/* §4.1 per-vendor share tap — once a VENDOR mission is done. Explicit,
              default private; every completion resets it, so the ask is fresh PER PHOTO. */}
          {isVendorMission ? (
            <p className="flex flex-wrap items-center justify-center gap-1.5">
              <span>
                Share this {c.shotNoun} with <span className="font-medium text-cream">{attached.vendor_name}</span>?
              </span>
              <button
                type="button"
                onClick={() => void c.setShare(attached.mission_id, true)}
                disabled={busy}
                aria-pressed={attached.consent_shared}
                className={`relative inline-flex min-h-0 items-center gap-1 rounded-full px-3 py-1 font-medium transition after:absolute after:inset-x-0 after:-inset-y-2.5 after:content-[''] disabled:opacity-40 ${
                  attached.consent_shared ? 'bg-mulberry text-cream' : 'bg-cream/10 text-cream/70'
                }`}
              >
                {busy && !attached.consent_shared ? <Loader2 aria-hidden className="h-3 w-3 animate-spin" strokeWidth={2} /> : null}
                {attached.consent_shared ? <Check aria-hidden className="h-3 w-3" strokeWidth={2.5} /> : null}
                Share
              </button>
              <button
                type="button"
                onClick={() => void c.setShare(attached.mission_id, false)}
                disabled={busy}
                aria-pressed={!attached.consent_shared}
                className={`relative inline-flex min-h-0 items-center rounded-full px-3 py-1 font-medium transition after:absolute after:inset-x-0 after:-inset-y-2.5 after:content-[''] disabled:opacity-40 ${
                  !attached.consent_shared ? 'bg-cream/20 text-cream' : 'bg-cream/10 text-cream/60'
                }`}
              >
                Keep private
              </button>
            </p>
          ) : null}
          {/* 🎁 The completion REWARD (owner 2026-07-23): a free client-side Story. */}
          {attached.completed && storyHref ? (
            <a href={storyHref} className="inline-block font-medium text-cream underline underline-offset-2">
              🎁 You earned a Story — make yours →
            </a>
          ) : null}
        </div>
      ) : null}
      {c.error ? <p className="text-center text-xs text-terracotta">{c.error}</p> : null}
    </>
  );
}
