'use client';

/**
 * use-live-scene — the room you are standing in keeps up.
 *
 * Re-asks `public_venue_scene` while the tab is visible (every
 * LIVE_SCENE_POLL_MS) and the moment it becomes visible again, and swaps in
 * the new scene ONLY when its signature changed — so a guest mid-walk sees a
 * seat moved during the event without the whole room re-mounting every minute.
 * A failed call is not news: the last good scene stays. A `{published:false}`
 * answer IS news: the couple took the room down, and the walk says so.
 *
 * The decisions (when, whether-it-is-news, what "taken down" looks like) live
 * in lib/venue-live-scene.ts so they can be tested without a browser.
 */
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  LIVE_SCENE_POLL_MS,
  sceneSignature,
  sceneWasTakenDown,
  shouldPollScene,
} from '@/lib/venue-live-scene';
import type { VenueScene } from './guest-venue-3d';

export function useLiveScene(
  initial: VenueScene,
  args: { slug: string; token: string | null; enabled?: boolean },
): { scene: VenueScene; takenDown: boolean } {
  const [scene, setScene] = useState<VenueScene>(initial);
  const [takenDown, setTakenDown] = useState(false);
  const sigRef = useRef(sceneSignature(initial));
  const { slug, token, enabled = true } = args;

  useEffect(() => {
    if (!enabled || !slug) return;
    let cancelled = false;
    let inFlight = false;
    const supabase = createClient();

    const ask = async () => {
      if (cancelled || inFlight) return;
      if (typeof document !== 'undefined' && !shouldPollScene(document.visibilityState)) return;
      inFlight = true;
      try {
        const { data, error } = await supabase.rpc('public_venue_scene', { p_slug: slug, p_token: token });
        if (cancelled || error || !data) return; // a failed call is not news
        if (sceneWasTakenDown(data)) {
          setTakenDown(true);
          return;
        }
        const next = data as VenueScene;
        const sig = sceneSignature(next);
        if (sig !== sigRef.current) {
          sigRef.current = sig;
          setTakenDown(false);
          setScene(next);
        }
      } finally {
        inFlight = false;
      }
    };

    const timer = setInterval(ask, LIVE_SCENE_POLL_MS);
    const onVisible = () => {
      if (shouldPollScene(document.visibilityState)) void ask();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [enabled, slug, token]);

  return { scene, takenDown };
}
