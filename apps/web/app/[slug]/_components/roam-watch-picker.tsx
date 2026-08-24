'use client';

/**
 * RoamWatchPicker — the Live Studio ROAM viewer surface on the couple's public
 * event page. Renders ONE main YouTube player plus a picker so a remote guest can
 * choose which camera / zone / venue to watch, with the featured (directed) feed
 * as the default landing view. This is the "guests wander the venue" experience.
 *
 * Self-contained + presentational: it renders whatever manifest it is given
 * (events.live_studio_roam_manifest, parsed via parseRoamManifest server-side) and
 * owns only the "which zone is selected" state. The PAGE decides whether to mount
 * it at all — gated on liveStudioRoamEnabled() AND a non-empty manifest — so when the
 * flag is off or no ROAM streams exist, this never renders and the page falls back
 * to the CAST single embed (WatchLiveBlock). Returns null on an empty manifest as
 * a belt-and-braces guard.
 *
 * All video ids in the manifest are pre-validated (parseRoamManifest is the
 * injection barrier); youTubeEmbedUrl re-checks before building the iframe src.
 */

import { useCallback, useMemo, useState } from 'react';

import {
  groupZonesByVenue,
  selectMainStageZone,
  type RoamManifest,
  type RoamZoneManifestEntry,
} from '@/lib/live-studio-roam';
import { youTubeEmbedUrl } from '@/lib/panood-watch';
import type { GuestPickCamera } from '@/lib/live-studio-guest-pick';
import { GuestCameraPlayer } from './guest-camera-player';

// The picker's current channel: the directed Main Stage ('main'), or one specific
// guest camera (its zoneIndex). Main Stage is channel 1 — the default landing.
type Selection = 'main' | number;

/**
 * WAVE 10 — SIDE CAMERAS (peer-to-peer, ₱0).
 *
 * `guestCameras` is a SECOND, parallel channel list that has nothing to do with the
 * YouTube manifest: those cameras have no videoId, because they are never broadcast
 * to YouTube at all. A guest who picks one gets a direct WebRTC connection to the
 * phone holding it (lib/panood-guest-webrtc.ts).
 *
 * Kept parallel rather than folded into `RoamManifest` deliberately. Every helper in
 * lib/live-studio-roam.ts and every paywall helper in lib/live-studio-publish.ts is
 * typed on a manifest entry that MUST carry a valid YouTube id — `parseRoamManifest`
 * drops entries that don't — so widening that type would ripple through the money
 * code Waves 3/5 pin with tests. An extra prop cannot.
 *
 * When `guestCameras` is empty this component renders EXACTLY as it did before.
 */
export function RoamWatchPicker({
  manifest,
  eventId,
  guestCameras = [],
  mainEmbedUrl = null,
  mainWatchUrl = null,
  occasion = 'celebration',
}: {
  manifest: RoamManifest;
  /** Required for side cameras; omitted on the pre-Wave-10 render path. */
  eventId?: string;
  guestCameras?: GuestPickCamera[];
  /** Director's cut when there is no roam manifest (the CAST single embed). */
  mainEmbedUrl?: string | null;
  mainWatchUrl?: string | null;
  /** EventWords.occasion — assistive text only. */
  occasion?: string;
}) {
  // The zone whose feed the directed Main Stage currently carries (the cut, else
  // the featured/first zone). Guests land here by default.
  const mainStageZone = useMemo(() => selectMainStageZone(manifest), [manifest]);
  const [selection, setSelection] = useState<Selection>('main');
  // Which side camera the guest is watching, if any. Separate from `selection` so the
  // existing YouTube channel logic is untouched.
  const [guestSlot, setGuestSlot] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const groups = useMemo(() => groupZonesByVenue(manifest), [manifest]);
  const onMain = selection === 'main' && guestSlot === null;
  const active: RoamZoneManifestEntry | null = useMemo(
    () =>
      selection === 'main'
        ? mainStageZone
        : manifest.find((z) => z.zoneIndex === selection) ?? mainStageZone,
    [manifest, selection, mainStageZone],
  );

  const activeGuestCamera = useMemo(
    () => guestCameras.find((c) => c.slot === guestSlot) ?? null,
    [guestCameras, guestSlot],
  );

  // Stable identity — GuestCameraPlayer holds this in a useEffect dependency list, so
  // a fresh closure each render would tear the connection down and rebuild it.
  const backToMain = useCallback((reason: string) => {
    setGuestSlot(null);
    setSelection('main');
    setNotice(reason);
  }, []);

  const pickMain = () => {
    setGuestSlot(null);
    setSelection('main');
    setNotice(null);
  };
  const pickZone = (zoneIndex: number) => {
    setGuestSlot(null);
    setSelection(zoneIndex);
    setNotice(null);
  };
  const pickGuestCamera = (slot: string) => {
    setGuestSlot(slot);
    setNotice(null);
  };

  const hasSideCameras = guestCameras.length > 0 && Boolean(eventId);
  // Pre-Wave-10 guard, widened by exactly one clause: a manifest-less event that DOES
  // have side cameras still has something to show (the CAST embed as Main Stage).
  if (manifest.length === 0 && !hasSideCameras) return null;
  if (!active && !mainEmbedUrl && !hasSideCameras) return null;

  let embedUrl: string | null = null;
  if (active) {
    try {
      embedUrl = youTubeEmbedUrl(active.videoId);
    } catch {
      embedUrl = null; // pre-validated upstream; guard anyway so a bad id can't throw in render
    }
  } else {
    embedUrl = mainEmbedUrl;
  }

  const watchUrl = active ? `https://www.youtube.com/watch?v=${active.videoId}` : mainWatchUrl;
  const mainLabel = active?.label ?? 'Main Stage';

  return (
    <section
      aria-label={`Watch the ${occasion} live — choose your camera`}
      className="overflow-hidden rounded-2xl border-2 border-terracotta/40 bg-ink shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-cream">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-terracotta" />
          {activeGuestCamera
            ? `Watch live · ${activeGuestCamera.label}`
            : onMain
              ? `Main Stage · ${mainLabel}`
              : `Watch live · ${mainLabel}`}
        </p>
        {/* Only the YouTube channels have somewhere to open. A side camera is a direct
            connection to a phone — there is no URL to hand out, and pretending
            otherwise would be a door that leads nowhere. */}
        {watchUrl && !activeGuestCamera ? (
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-cream/65 underline-offset-4 hover:text-cream hover:underline"
          >
            Open on YouTube
          </a>
        ) : null}
      </div>

      {activeGuestCamera && eventId ? (
        <GuestCameraPlayer
          key={activeGuestCamera.slot}
          eventId={eventId}
          slot={activeGuestCamera.slot}
          label={activeGuestCamera.label}
          onFallback={backToMain}
        />
      ) : (
        <div className="aspect-video w-full bg-black">
          {embedUrl ? (
            <iframe
              key={active?.videoId ?? 'main'}
              title={`Live: ${mainLabel}`}
              src={embedUrl}
              className="h-full w-full border-0"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-xs uppercase tracking-[0.2em] text-cream/50">
              Camera offline
            </div>
          )}
        </div>
      )}

      {/* The honest hand-back. Set only when a side camera refused, filled or failed —
          never a dead player, and never silence about why the picture changed. */}
      {notice ? (
        <p
          role="status"
          className="border-t border-cream/10 px-4 py-2 text-xs text-cream/70"
        >
          {notice}
        </p>
      ) : null}

      {/* Channel picker — Main Stage (directed) first, then the guest cameras
          grouped by venue. Guests tap to switch angle/place, or jump back to the
          directed Main Stage any time. */}
      {manifest.length > 1 || hasSideCameras ? (
        <div className="space-y-3 border-t border-cream/10 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={pickMain}
              aria-pressed={onMain}
              className={[
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition',
                onMain ? 'bg-terracotta text-cream' : 'bg-cream/10 text-cream/80 hover:bg-cream/20',
              ].join(' ')}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-cream" aria-hidden />
              <span>Main Stage</span>
              <span className="font-mono text-[0.6rem] uppercase tracking-wider opacity-70">
                directed
              </span>
            </button>
          </div>
          {groups.map((group) => (
            <div key={group.venue ?? '_'} className="space-y-1.5">
              {group.venue ? (
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-cream/45">
                  {group.venue}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {group.zones.map((zone) => {
                  const isActive =
                    !onMain && !activeGuestCamera && zone.zoneIndex === active?.zoneIndex;
                  const isOffline = zone.status === 'offline' || zone.status === 'disabled';
                  return (
                    <button
                      key={zone.zoneIndex}
                      type="button"
                      onClick={() => pickZone(zone.zoneIndex)}
                      aria-pressed={isActive}
                      className={[
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition',
                        isActive
                          ? 'bg-terracotta text-cream'
                          : 'bg-cream/10 text-cream/80 hover:bg-cream/20',
                      ].join(' ')}
                    >
                      {zone.status === 'live' ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-cream" aria-hidden />
                      ) : isOffline ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-cream/30" aria-hidden />
                      ) : null}
                      <span>{zone.label}</span>
                      {zone.featured ? (
                        <span className="font-mono text-[0.6rem] uppercase tracking-wider opacity-70">
                          default
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* SIDE CAMERAS (Wave 10) — peer-to-peer, straight from the phone holding
              them. Labelled honestly as limited, because they ARE: only
              GUEST_PICK_MAX_VIEWERS_PER_CAMERA guests fit on each one, and the phone's
              uplink is the reason. The Main Stage above has no such limit. */}
          {hasSideCameras ? (
            <div className="space-y-1.5">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-cream/45">
                Roaming cameras · limited seats
              </p>
              <div className="flex flex-wrap gap-2">
                {guestCameras.map((cam) => {
                  const isActive = activeGuestCamera?.slot === cam.slot;
                  return (
                    <button
                      key={cam.slot}
                      type="button"
                      onClick={() => pickGuestCamera(cam.slot)}
                      aria-pressed={isActive}
                      className={[
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition',
                        isActive
                          ? 'bg-terracotta text-cream'
                          : 'bg-cream/10 text-cream/80 hover:bg-cream/20',
                      ].join(' ')}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-cream" aria-hidden />
                      <span>{cam.label}</span>
                      {cam.venueLabel ? (
                        <span className="font-mono text-[0.6rem] uppercase tracking-wider opacity-70">
                          {cam.venueLabel}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
