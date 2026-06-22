/**
 * hero-monogram-data — the ONE server-side resolver that turns an event row into
 * the four inputs <HeroMonogram> needs, exactly the way the public wedding-site
 * hero does (resolveMonogram + the uploaded→bespoke precedence + the paid
 * ANIMATED_MONOGRAM gate + the chosen motion signature). Animated-logo surface
 * rollout (owner 2026-06-22): reused so every surface that shows the couple's
 * mark resolves it identically — no per-surface drift.
 *
 * Server-only (the ownership check reads the orders table), but the returned
 * shape is fully serializable, so an RSC can resolve it and hand it to a client
 * component (e.g. the Live Photo Wall projection) as a prop.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveMonogram, type MonogramConfig } from '@/lib/monogram';
import { resolveMonogramMotion, type MonogramMotionKey } from '@/lib/monogram-motion';
import { eventAnimatedMonogramActive } from '@/lib/animated-monogram';

/** Reusable SELECT column list for any page that resolves the hero monogram. */
export const HERO_MONOGRAM_COLUMNS =
  'display_name, monogram_text, monogram_color, monogram_font_key, monogram_style, monogram_frame_key, monogram_custom_svg, monogram_uploaded_svg, monogram_motion_key';

/** The event columns HERO_MONOGRAM_COLUMNS fetches. */
export type HeroMonogramRow = {
  display_name: string | null;
  monogram_text: string | null;
  monogram_color: string | null;
  monogram_font_key: string | null;
  monogram_style: string | null;
  monogram_frame_key: string | null;
  monogram_custom_svg: string | null;
  monogram_uploaded_svg: string | null;
  monogram_motion_key: string | null;
};

/** Serializable bundle of the four <HeroMonogram> inputs. */
export type HeroMonogramData = {
  /** The design columns HeroMonogram's `event` prop reads. */
  design: {
    monogram_style: string | null;
    monogram_font_key: string | null;
    monogram_frame_key: string | null;
  };
  monogram: MonogramConfig;
  /** The motion signature when the couple owns the paid ANIMATED_MONOGRAM, else false. */
  animatedMonogram: MonogramMotionKey | false;
  /** Sanitized bespoke/uploaded SVG (uploaded outranks AI/Cipher), or null. */
  bespokeSvg: string | null;
};

/**
 * Resolve an already-fetched event row (selected with HERO_MONOGRAM_COLUMNS) into
 * the HeroMonogram inputs. The ownership check needs the client + eventId; pass a
 * client that can read the event's orders (admin for anonymous-viewable surfaces).
 * Returns null when the row is missing → the caller renders mark-free.
 */
export async function resolveEventMonogram(
  client: SupabaseClient,
  eventId: string,
  row: HeroMonogramRow | null,
): Promise<HeroMonogramData | null> {
  if (!row) return null;
  const bespokeSvg =
    (typeof row.monogram_uploaded_svg === 'string' && row.monogram_uploaded_svg.trim()
      ? row.monogram_uploaded_svg
      : null) ??
    (typeof row.monogram_custom_svg === 'string' && row.monogram_custom_svg.trim()
      ? row.monogram_custom_svg
      : null);
  const ownsAnimated = await eventAnimatedMonogramActive(client, eventId);
  const animatedMonogram: MonogramMotionKey | false = ownsAnimated
    ? resolveMonogramMotion(row.monogram_motion_key)
    : false;
  return {
    design: {
      monogram_style: row.monogram_style,
      monogram_font_key: row.monogram_font_key,
      monogram_frame_key: row.monogram_frame_key,
    },
    monogram: resolveMonogram(row),
    animatedMonogram,
    bespokeSvg,
  };
}
