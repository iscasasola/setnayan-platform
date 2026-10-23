import Link from 'next/link';
import { headers } from 'next/headers';
import { Printer } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { renderUrlQrSvg } from '@/lib/qr';
import { sharedJoinLinkState } from '@/lib/shared-join-link';
import { CopyButton } from '@/app/dashboard/[eventId]/studio/papic/crew/_components/copy-button';

/**
 * 🚪 HOW GUESTS GET IN — the one code, its QR and the poster, UNDER the shipped "How guests get in" row of Event
 * Details (owner 2026-10-23: *"the how guests get in will be on event settings"*; prototype: "the QR with [Copy
 * link] [Print poster] and 'Each guest's invite QR is already their camera' sit under that one row. Not a second
 * row.").
 *
 * MOVED, NOT REDRAWN: the same join link the crew page's "One code for everyone" prints — `/{slug}/invite`, gated by
 * `sharedJoinLinkState` (a private event's code would open to "Link not found", so it says why instead of printing
 * one) — the same Copy button, the same poster page.
 */
export async function GuestsGetInCode({ eventId }: { eventId: string }) {
  const supabase = await createClient();
  const [eventRes, tokenRes] = await Promise.all([
    supabase
      .from('events')
      .select('slug, landing_page_visibility, scheduled_launch_at, std_launched_at')
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase.from('event_join_tokens').select('token, revoked_at, expires_at').eq('event_id', eventId).maybeSingle(),
  ]);
  if (eventRes.error) logQueryError('GuestsGetInCode.event', eventRes.error, { eventId }, 'graceful_degrade');
  if (tokenRes.error) logQueryError('GuestsGetInCode.joinToken', tokenRes.error, { eventId }, 'graceful_degrade');
  if (eventRes.error || tokenRes.error) {
    return (
      <p role="status" className="px-1 pb-2 text-[13px] text-ink/60" data-guests-get-in-code="unread">
        couldn’t load your guests’ code — refresh to see it.
      </p>
    );
  }
  const row = tokenRes.data;
  const tokenValid = !!row?.token && !row.revoked_at && (!row.expires_at || new Date(row.expires_at) > new Date());
  const ev = (eventRes.data ?? {}) as Parameters<typeof sharedJoinLinkState>[0]['event'];
  const link = sharedJoinLinkState({ event: ev, tokenValid });

  const h = await headers();
  const appUrl = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host') ?? 'www.setnayan.com'}`;
  const url = link.usable ? `${appUrl}/${ev.slug}/invite` : null;
  const qr = url ? await renderUrlQrSvg(url, 160) : null;

  return (
    <div className="flex flex-wrap items-start gap-4 px-1 pb-3" data-guests-get-in-code={url ? 'on' : link.state}>
      {url && qr ? (
        <>
          <div
            aria-hidden
            className="shrink-0 rounded-xl bg-white p-1.5 [&>svg]:h-24 [&>svg]:w-24"
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-[13px] text-ink/70">One code for everyone — they scan, they’re in, their camera with them.</p>
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton value={url} />
              <Link
                href={`/dashboard/${eventId}/studio/papic/crew/poster`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-ink/10 hover:text-ink"
              >
                <Printer aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                Print poster
              </Link>
            </div>
            <p className="text-xs text-ink/55">Each guest’s invite QR is already their camera.</p>
          </div>
        </>
      ) : link.notice ? (
        <p className="max-w-prose text-[13px] text-ink/65">{link.notice}</p>
      ) : null}
    </div>
  );
}
