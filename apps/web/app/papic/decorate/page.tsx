import { Sparkles } from 'lucide-react';
import { DoorShell } from '@/app/_components/door/door-shell';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventPapicGuestAccess } from '@/lib/papic-guest';
import { eventKwentoEnabled } from '@/lib/kwento-access';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { KwentoDecorator } from './_components/kwento-decorator';

// Papic · Kwento Decorator (owner 2026-07-08 "this is ideally kwento"). The
// session-backed decoration surface: a guest who redeemed their invite carries
// the setnayan_guest_session cookie; they pick a photo, layer stickers/text/a
// filter on it (client-side, ₱0), and it saves to the couple's gallery through
// the same /api/papic/guest-capture pipeline every guest photo uses (R2 + NSFW
// screen + quota + wall + Drive). Admin client — public surface, no RLS session.

export const dynamic = 'force-dynamic';

export default async function PapicDecoratePage() {
  const session = await readGuestSession();
  if (!session) {
    return (
      <DoorShell
        tone="dead_end"
        eyebrow={
          <>
            <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Photo decorating
          </>
        }
        title="Open your invitation first."
        sub="Scan your personal QR or open your invite link, then come back here to decorate a photo for the host."
      />
    );
  }

  const admin = createAdminClient();
  /* 🔴 "OFF" AND "WE COULD NOT TELL" ARE DIFFERENT SENTENCES, and only one of
     them is about the host. This asked a boolean that fails closed on a read
     error, then printed the failure as a decision somebody had made. Measured
     2026-08-25: the guest-camera pool applies on ALL FIVE production events, so
     the refusal below is unreachable through the gate today — which means every
     time it HAS rendered, it was the read failing, and it named the wrong
     culprit. The gate still fails closed; only the wording knows the difference. */
  const access = await eventPapicGuestAccess(admin, session.event_id);
  if (access !== 'on') {
    return (
      <DoorShell
        tone="dead_end"
        eyebrow={
          <>
            <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Photo decorating
          </>
        }
        title={access === 'unknown' ? 'We couldn’t check just now.' : 'Not on yet.'}
        sub={
          access === 'unknown'
            ? 'Something on our side didn’t answer, so we can’t open the decorator yet. Give it a moment and try again — nothing is wrong with your invitation.'
            : 'Guest cameras aren’t on for this event yet, so there’s nothing to decorate. Enjoy the celebration!'
        }
      />
    );
  }

  const [{ data: ev }, canKwento] = await Promise.all([
    admin
      .from('events')
      .select('display_name, role_palette')
      .eq('event_id', session.event_id)
      .maybeSingle(),
    // Kwento (the caption step) is a paid unlock — mirror the server gate so the
    // caption composer only appears when POST /api/papic/kwento would accept it.
    eventKwentoEnabled(admin, session.event_id),
  ]);
  const eventName = (ev?.display_name as string | null) || 'the event';

  // The couple's mood-board colours → offered as text swatches in the decorator
  // (reception dominant/supporting/accent + bride + groom, deduped, capped).
  const palette = sanitizeRolePalette((ev as { role_palette?: unknown } | null)?.role_palette ?? {});
  const themeColors = Array.from(
    new Set([...(palette.reception ?? []), ...(palette.bride ?? []), ...(palette.groom ?? [])]),
  ).slice(0, 6);

  return (
    <KwentoDecorator eventName={eventName} canKwento={canKwento} themeColors={themeColors} />
  );
}
