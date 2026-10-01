import type { ReactNode } from 'react';

/**
 * THE LIVE HUB — WATCH LIVE + THE LIVE WALL, ARRANGED THREE WAYS
 * (prototype `every_scene_three_styles_2026-09-29.html` §16):
 * A · Player and wall (the two blocks as shipped, player first),
 * B · Theatre (dark; the player first and large, the wall under it),
 * C · Wall first (the wall leads; the player follows).
 *
 * 🔒 THE SAME PLAYER AND THE SAME WALL. Both arrive already built —
 * `WatchLiveBlock` (the embed, or the Facebook card, or the camera picker)
 * and `LiveWallBlock` (its own poll, its own tiles) — and are only placed.
 * Either may be absent (no stream linked; the wall not on); an arrangement
 * then draws the one that is there, never an empty frame.
 */
export function LiveHubArrangement({
  sceneStyle = null,
  player,
  wall,
}: {
  sceneStyle?: string | null;
  player: ReactNode;
  wall: ReactNode;
}) {
  if (!player && !wall) return null;
  if (sceneStyle === 'theatre') {
    return (
      <section data-scene-style="theatre" className="-mx-4 space-y-4 bg-ink px-4 py-5 sm:mx-0">
        {player}
        {wall ? <div className="bg-cream p-3">{wall}</div> : null}
      </section>
    );
  }
  if (sceneStyle === 'wall-first') {
    return (
      <section data-scene-style="wall-first" className="space-y-4">
        {wall}
        {player}
      </section>
    );
  }
  return (
    <section data-scene-style="player-and-wall" className="space-y-4">
      {player}
      {wall}
    </section>
  );
}
