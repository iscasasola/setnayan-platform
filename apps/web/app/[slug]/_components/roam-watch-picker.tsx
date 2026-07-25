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

import { useMemo, useState } from 'react';

import {
  groupZonesByVenue,
  selectMainStageZone,
  type RoamManifest,
  type RoamZoneManifestEntry,
} from '@/lib/live-studio-roam';
import { youTubeEmbedUrl } from '@/lib/panood-watch';

// The picker's current channel: the directed Main Stage ('main'), or one specific
// guest camera (its zoneIndex). Main Stage is channel 1 — the default landing.
type Selection = 'main' | number;

export function RoamWatchPicker({ manifest }: { manifest: RoamManifest }) {
  // The zone whose feed the directed Main Stage currently carries (the cut, else
  // the featured/first zone). Guests land here by default.
  const mainStageZone = useMemo(() => selectMainStageZone(manifest), [manifest]);
  const [selection, setSelection] = useState<Selection>('main');

  const groups = useMemo(() => groupZonesByVenue(manifest), [manifest]);
  const onMain = selection === 'main';
  const active: RoamZoneManifestEntry | null = useMemo(
    () =>
      onMain ? mainStageZone : manifest.find((z) => z.zoneIndex === selection) ?? mainStageZone,
    [manifest, selection, onMain, mainStageZone],
  );

  if (manifest.length === 0 || !active) return null;

  let embedUrl: string | null = null;
  try {
    embedUrl = youTubeEmbedUrl(active.videoId);
  } catch {
    embedUrl = null; // pre-validated upstream; guard anyway so a bad id can't throw in render
  }

  const watchUrl = `https://www.youtube.com/watch?v=${active.videoId}`;

  return (
    <section
      aria-label="Watch the celebration live — choose your camera"
      className="overflow-hidden rounded-2xl border-2 border-terracotta/40 bg-ink shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-cream">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger-400" />
          {onMain ? `Main Stage · ${active.label}` : `Watch live · ${active.label}`}
        </p>
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-cream/65 underline-offset-4 hover:text-cream hover:underline"
        >
          Open on YouTube
        </a>
      </div>

      <div className="aspect-video w-full bg-black">
        {embedUrl ? (
          <iframe
            key={active.videoId}
            title={`Live: ${active.label}`}
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

      {/* Channel picker — Main Stage (directed) first, then the guest cameras
          grouped by venue. Guests tap to switch angle/place, or jump back to the
          directed Main Stage any time. */}
      {manifest.length > 1 ? (
        <div className="space-y-3 border-t border-cream/10 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelection('main')}
              aria-pressed={onMain}
              className={[
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition',
                onMain ? 'bg-terracotta text-cream' : 'bg-cream/10 text-cream/80 hover:bg-cream/20',
              ].join(' ')}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-danger-400" aria-hidden />
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
                  const isActive = !onMain && zone.zoneIndex === active.zoneIndex;
                  const isOffline = zone.status === 'offline' || zone.status === 'disabled';
                  return (
                    <button
                      key={zone.zoneIndex}
                      type="button"
                      onClick={() => setSelection(zone.zoneIndex)}
                      aria-pressed={isActive}
                      className={[
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition',
                        isActive
                          ? 'bg-terracotta text-cream'
                          : 'bg-cream/10 text-cream/80 hover:bg-cream/20',
                      ].join(' ')}
                    >
                      {zone.status === 'live' ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-danger-400" aria-hidden />
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
        </div>
      ) : null}
    </section>
  );
}
