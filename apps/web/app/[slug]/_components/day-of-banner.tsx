import type { EventWords } from '../_lib/event-words';
import { InlineNotice } from '@/app/_components/notices/inline-notice';
// Task #13 — day-of lifecycle banner. `live` = T-1h..T+8h (per
// lib/day-of-mode.ts), `post` = T+8h..T+24h. Renders server-side so the
// surface is offline-cacheable; no client effect needed.
/**
 * 🔔 Inventory #39 — a LIVE notice (info), one notice system (owner approved 14 Nov 2026): "Live now" / "Thank you…",
 * drawn where it stands on the Event Hub; no close — it leaves when the day changes.
 */
export function DayOfBanner({
  kind,
  words,
}: {
  kind: 'live' | 'post';
  words: EventWords;
}) {
  if (kind === 'live') {
    return (
      <section aria-label="Live event mode">
        <InlineNotice
          kind="live"
          tone="info"
          closable={false}
          noticeKey="live-now"
          title="Live now"
          detail={`The ${words.eventWord} is happening. Your schedule, QR, and venue info are pinned below — they work offline if WiFi cuts out.`}
        />
      </section>
    );
  }
  return (
    <section aria-label="Post-event mode">
      <InlineNotice
        kind="live"
        tone="info"
        closable={false}
        noticeKey="thank-you"
        title={words.solemn ? 'Thank you for being here' : 'Thank you for celebrating'}
        // "Wrapped up" is a party verb; the solemn arm ends the day plainly.
        detail={`The ${words.eventWord} ${words.solemn ? 'has ended' : 'wrapped up'}. Your tagged photos will land here as ${words.theOrganizer} releases them — check back over the next few days.`}
      />
    </section>
  );
}
