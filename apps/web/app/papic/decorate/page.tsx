import { Sparkles } from 'lucide-react';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventPapicGuestActive } from '@/lib/papic-guest';
import { KwentoDecorator } from './_components/kwento-decorator';

// Papic · Kwento Decorator (owner 2026-07-08 "this is ideally kwento"). The
// session-backed decoration surface: a guest who redeemed their invite carries
// the setnayan_guest_session cookie; they pick a photo, layer stickers/text/a
// filter on it (client-side, ₱0), and it saves to the couple's gallery through
// the same /api/papic/guest-capture pipeline every guest photo uses (R2 + NSFW
// screen + quota + wall + Drive). Admin client — public surface, no RLS session.

export const dynamic = 'force-dynamic';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-12 text-ink">
      <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-7 text-center shadow-sm">
        <Sparkles aria-hidden className="mx-auto h-7 w-7 text-terracotta" strokeWidth={1.75} />
        {children}
      </div>
    </main>
  );
}

export default async function PapicDecoratePage() {
  const session = await readGuestSession();
  if (!session) {
    return (
      <Shell>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Open your invitation first</h1>
        <p className="mt-2 text-sm text-ink/65">
          Scan your personal QR or open your invite link, then come back here to
          decorate a photo for the couple.
        </p>
      </Shell>
    );
  }

  const admin = createAdminClient();
  const owns = await eventPapicGuestActive(admin, session.event_id);
  if (!owns) {
    return (
      <Shell>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Not on yet</h1>
        <p className="mt-2 text-sm text-ink/65">
          The couple hasn&rsquo;t turned on guest cameras for this wedding yet.
        </p>
      </Shell>
    );
  }

  const { data: ev } = await admin
    .from('events')
    .select('display_name')
    .eq('event_id', session.event_id)
    .maybeSingle();
  const eventName = (ev?.display_name as string | null) || 'the wedding';

  return <KwentoDecorator eventName={eventName} />;
}
