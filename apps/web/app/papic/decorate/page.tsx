import { Sparkles } from 'lucide-react';
import { DoorShell } from '@/app/_components/door/door-shell';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventPapicGuestActive } from '@/lib/papic-guest';
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
  const owns = await eventPapicGuestActive(admin, session.event_id);
  if (!owns) {
    return (
      <DoorShell
        tone="dead_end"
        eyebrow={
          <>
            <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Photo decorating
          </>
        }
        title="Not on yet."
        sub="The host hasn't turned on guest cameras for this event yet."
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
