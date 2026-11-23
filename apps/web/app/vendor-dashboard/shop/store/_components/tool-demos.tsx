'use client';

import { useCallback, useMemo, useState } from 'react';
import { ArrowUpRight, Camera, Lock } from 'lucide-react';
import { RiseScreen } from '@/app/_components/rise/rise-screen';
import { ActionButton } from '@/components/action-button';
import { SongPreviewList } from '@/app/onboarding/wedding/_components/song-preview-list';
import { ChallengeFollowUp, ChallengePill, type ArmedChallenge, type GuestChallenges } from '@/app/papic/guest/_components/papic-challenge-panel';
import { Plan3DSceneLoader } from '@/app/_components/plan3d/plan3d-scene-loader';
import { useIsMobile } from '@/lib/use-responsive';
import { formatCount } from '@/lib/format-number';
import { SPECIAL_TOOLS_UPGRADE_HREF } from '@/lib/special-tools';
import { resolveVendorCategory } from '@/lib/vendor-packages';
import { missionProgress, type GuestMissionRow } from '@/lib/papic-missions';
import {
  DEMO_SONGS_PICKED,
  STORE_TOOL_DEMO_HEAD,
  TOOL_DEMO_BAR_WORDS,
  demoMissions,
  demoRoom,
  demoShopName,
  demoSongs,
  type ScreenDemoTool,
} from '@/lib/store-tool-demos';

/**
 * ▶ "TRY IT FIRST" — the Song bank, Papic challenge and 3D plan demos (owner 2026-11-23, specs eb51e640 + 7d487adb Q6;
 * the Cake Maker's shape: `CakeDemoButton` → the couple's designer with `demo`). Each one is the SHIPPED customer-side
 * piece, handed `lib/store-tool-demos.ts`'s sample, in the ONE full screen (`RiseScreen`, kind `zoom` — a whole tool),
 * with the Cake Maker demo's calm bar at the thumb in place of the tool's real button.
 *
 *   song_bank        `SongPreviewList` (the couple's song bank rows: tap a cover to hear 30 s, tap a row to pick).
 *   papic_challenge  `ChallengePill` + `ChallengeFollowUp` (the guest camera's challenge pill and the line under the
 *                    shutter), fed a demo state with the hook's own shape — Start, shoot, done, Share ⇄ Keep private.
 *   plan_3d          `Plan3DSceneLoader` (the 3D plan's room) on a sample reception with the shop's own booth.
 *
 * 🔒 NOTHING IS READ, SAVED OR SENT: no server action, no fetch to our API, no database. Picks, challenges and shares
 * live in this screen's state and are gone when it closes. `lib/store-tool-demos.test.ts` holds that.
 */
export function ToolDemoScreen({ tool, shopName, services, onClose }: { tool: ScreenDemoTool; shopName: string | null; services: readonly string[]; onClose: () => void }) {
  const head = STORE_TOOL_DEMO_HEAD[tool];
  const name = demoShopName(shopName);
  return (
    <RiseScreen title={head.title} line={head.line} kind="zoom" fill={tool === 'plan_3d'} onClose={onClose} data={`tool-demo-${tool}`} thumb={<DemoBar />}>
      <div className={tool === 'plan_3d' ? 'flex min-h-0 flex-1 flex-col' : undefined} data-tool-demo={tool}>
        {tool === 'song_bank' ? <SongDemo /> : tool === 'papic_challenge' ? <ChallengeDemo shopName={name} /> : <RoomDemo shopName={name} services={services} />}
      </div>
    </RiseScreen>
  );
}

/** The Cake Maker demo's calm bar (`data-cake-demo-bar`), word for word: the lock, "included in Plus", Upgrade. */
function DemoBar() {
  return (
    <div role="note" className="flex items-center gap-3" data-tool-demo-bar="">
      <Lock aria-hidden className="h-4 w-4 flex-none text-[color:var(--m-slate-2)]" strokeWidth={2} />
      <span className="min-w-0 flex-1 text-sn-base text-ink">{TOOL_DEMO_BAR_WORDS}</span>
      <ActionButton tone="brand" icon={<ArrowUpRight aria-hidden strokeWidth={2} />} label="Upgrade" href={SPECIAL_TOOLS_UPGRADE_HREF} data-web-only="" data-tool-demo-upgrade="" />
    </div>
  );
}

// ─── Song bank ──────────────────────────────────────────────────────────────────────────────────────────────────────

function SongDemo() {
  const songs = useMemo(demoSongs, []);
  const [picked, setPicked] = useState<string[]>(() => [...DEMO_SONGS_PICKED]);
  const toggle = useCallback((lbl: string) => setPicked((p) => (p.includes(lbl) ? p.filter((x) => x !== lbl) : [...p, lbl])), []);
  return (
    <div className="px-4 py-3" data-tool-demo-songs="">
      <p className="mb-3 text-sn-base text-[color:var(--m-slate-2)]" data-tool-demo-picked={picked.length}>
        {formatCount(songs.length)} songs in your set list · {formatCount(picked.length)} picked
      </p>
      {/* No `onCacheSong`: a cover found for a sample song is never stored. */}
      <SongPreviewList songs={songs} pickedLbls={picked} query="" onToggle={toggle} alwaysShowAll look="house" />
    </div>
  );
}

// ─── Papic challenge ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The guest camera's challenge state, in the browser only — the SAME shape `useGuestChallenges` returns, so the shipped
 * pill and follow-up line draw it unchanged. Start arms a challenge; the next shot completes it; Share ⇄ Keep private
 * flips the per-photo consent. Where the real hook POSTs, this sets state.
 */
function useDemoChallenges(shopName: string) {
  const [missions, setMissions] = useState<GuestMissionRow[]>(() => demoMissions(shopName));
  const [armed, setArmed] = useState<(ArmedChallenge & { captureIdAtArm: string | null }) | null>(null);
  const [justAttached, setJustAttached] = useState<ArmedChallenge | null>(null);
  const [shots, setShots] = useState(0);
  const arm = useCallback((m: GuestMissionRow, retake: boolean) => {
    setArmed({ missionId: m.mission_id, prompt: m.prompt, retake, captureIdAtArm: null });
    setJustAttached(null);
  }, []);
  const disarm = useCallback(() => setArmed(null), []);
  const setShare = useCallback(async (missionId: string, consent: boolean) => {
    setMissions((ms) => ms.map((m) => (m.mission_id === missionId ? { ...m, consent_shared: consent } : m)));
  }, []);
  const shoot = useCallback(() => {
    setShots((n) => n + 1);
    if (!armed) return;
    const target: ArmedChallenge = { missionId: armed.missionId, prompt: armed.prompt, retake: armed.retake };
    // A new shot resets sharing to private, as the real completion does (consent is per photo).
    setMissions((ms) => ms.map((m) => (m.mission_id === target.missionId ? { ...m, completed: true, consent_shared: false } : m)));
    setJustAttached(target);
    setArmed(null);
  }, [armed]);
  const c: GuestChallenges = { ready: true, missions, paused: false, armed, justAttached, busyId: null, error: null, shotNoun: shots > 0 ? 'photo' : 'shot', arm, disarm, setShare };
  return { c, shoot, shots };
}

function ChallengeDemo({ shopName }: { shopName: string }) {
  const { c, shoot, shots } = useDemoChallenges(shopName);
  const { done, total } = missionProgress(c.missions);
  return (
    <div className="px-4 py-3">
      <div className="flex min-h-96 flex-col justify-between gap-4 rounded-2xl bg-ink p-4 text-cream" data-tool-demo-camera="">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex" data-tour="camera-challenge">
            <ChallengePill c={c} />
          </span>
          <span className="text-sn-sm text-cream/70" data-tool-demo-done={done}>
            {formatCount(done)} of {formatCount(total)} done
          </span>
        </div>
        <p className="text-center text-sn-base text-cream/80">
          {c.armed ? `Your next photo counts for “${c.armed.prompt}”.` : 'Pick a challenge above, then take the photo.'}
        </p>
        <div className="flex flex-col items-center gap-3">
          <ActionButton tone="brand" main icon={<Camera aria-hidden strokeWidth={1.9} />} label="Take the photo" onClick={shoot} data-tool-demo-shutter={String(shots)} />
          <ChallengeFollowUp c={c} />
        </div>
      </div>
    </div>
  );
}

// ─── 3D plan ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The shop's booth category — its first service that has a booth, as `/v/[slug]/booth` picks it. */
function boothCategoryOf(services: readonly string[]): string | null {
  for (const s of services) {
    const c = resolveVendorCategory(s);
    if (c !== 'misc') return c;
  }
  return null;
}

function RoomDemo({ shopName, services }: { shopName: string; services: readonly string[] }) {
  const room = useMemo(() => demoRoom(shopName, boothCategoryOf(services)), [shopName, services]);
  const isMobile = useIsMobile();
  return (
    <div className="relative min-h-96 w-full flex-1" data-tool-demo-room="">
      <Plan3DSceneLoader tables={room.tables} floor={room.floor} guests={room.guests} booths={room.booths} interactive quality={isMobile ? 'low' : 'high'} />
    </div>
  );
}
