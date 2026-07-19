/**
 * Life-Flash · client analytics (PR-5, strategy §9 success metrics).
 *
 * Lazy-imports posthog-js the same way as guest-to-host-cta.tsx / plan-card-
 * lock.tsx so the SDK chunk is shared and analytics never blocks render. NO
 * PII: events carry only the scope KIND, counts, indices, and booleans — never
 * names, person ids, event ids, or media. Every capture is swallowed; telemetry
 * MUST NOT break the room.
 *
 * Events:
 *   life_flash_started            — play begins { scope, beat_count, has_perspective, has_memoriam, reduced_motion }
 *   life_flash_completed          — reached present_forward { scope, beat_count }
 *   life_flash_cancelled          — stopped before the end { scope, at_beat, beat_count }
 *   life_flash_perspective_viewed — the signature "through someone else's eyes" beat surfaced { scope }
 *   life_flash_reel_reordered     — reel order toggled { order }
 */
export async function captureLifeFlash(
  event: string,
  properties: Record<string, unknown>,
): Promise<void> {
  try {
    const ph = (await import('posthog-js')).default;
    ph.capture?.(event, properties);
  } catch {
    // Swallow — best-effort only.
  }
}
