import Link from 'next/link';
import { headers } from 'next/headers';
import { CircleAlert, Printer } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { renderUrlQrSvg } from '@/lib/qr';
import { sharedJoinLinkState } from '@/lib/shared-join-link';
import { formatCount } from '@/lib/format-number';
import { InfoTip } from '@/app/_components/info-tip';
import { CopyButton } from '../crew/_components/copy-button';

/**
 * one-code.tsx — HOW GUESTS GET IN, AS A CAMERA: the one code for everyone, and each guest's own invite QR.
 *
 * Owner 2026-10-23: *"the how guests get in will be on event settings"* — approved
 * `prototypes/papic_controller_one_page_2026-10-23.html`: it EXTENDS the shipped Event Details row "How guests get
 * in" (Home › Settings) — the QR with [Copy link] [Print poster] and "Each guest's invite QR is already their camera",
 * under that one row, never a second row. The read and its refusals are the `/crew` page's, lifted here unchanged so
 * both places draw one truth (`lib/shared-join-link.ts` says why a code cannot work yet).
 */

export type OneCodeRead = {
  url: string | null;
  qrSvg: string | null;
  /** Why it cannot be scanned yet (private event, no address, …) — null when usable or unknown. */
  notice: string | null;
  privateEvent: boolean;
  /** Guests whose own invite QR is a camera — null when the count could not be read. */
  ready: number | null;
};

export async function readOneCode(eventId: string): Promise<OneCodeRead> {
  const supabase = await createClient();
  const [eventRes, tokenRes, readyRes] = await Promise.all([
    supabase.from('events').select('slug, landing_page_visibility, scheduled_launch_at, std_launched_at').eq('event_id', eventId).maybeSingle(),
    supabase.from('event_join_tokens').select('token, revoked_at, expires_at').eq('event_id', eventId).maybeSingle(),
    supabase
      .from('guests')
      .select('guest_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .not('qr_token', 'is', null),
  ]);
  if (eventRes.error) logQueryError('readOneCode.event', eventRes.error, { eventId }, 'graceful_degrade');
  if (tokenRes.error) logQueryError('readOneCode.token', tokenRes.error, { eventId }, 'graceful_degrade');
  if (readyRes.error) logQueryError('readOneCode.ready', readyRes.error, { eventId }, 'graceful_degrade');
  const t = tokenRes.data;
  const tokenValid = !!t?.token && !t.revoked_at && (!t.expires_at || new Date(t.expires_at) > new Date());
  const link = sharedJoinLinkState({
    event: (eventRes.data ?? {}) as Parameters<typeof sharedJoinLinkState>[0]['event'],
    tokenValid,
  });
  const slug = (eventRes.data as { slug?: string | null } | null)?.slug ?? null;
  const h = await headers();
  const appUrl = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host') ?? 'www.setnayan.com'}`;
  const url = link.usable && slug ? `${appUrl}/${slug}/invite` : null;
  return {
    url,
    qrSvg: url ? await renderUrlQrSvg(url, 200) : null,
    notice: link.usable ? null : (link.notice ?? null),
    privateEvent: link.state === 'private',
    ready: readyRes.error ? null : (readyRes.count ?? 0),
  };
}

/** The row's extension under "How guests get in" (Event Details) — the QR, its two presses, and the guests' own QRs. */
export async function OneCodeUnderGetIn({ eventId }: { eventId: string }) {
  const code = await readOneCode(eventId);
  return (
    <div className="flex flex-col gap-2 pb-3" data-one-code="details">
      {code.url && code.qrSvg ? (
        <div className="flex items-start gap-3">
          <div
            aria-hidden
            className="shrink-0 rounded-lg bg-white p-1 [&>svg]:h-16 [&>svg]:w-16"
            dangerouslySetInnerHTML={{ __html: code.qrSvg }}
          />
          <div className="min-w-0">
            <InfoTip label="One code for everyone" labelClassName="text-[14px] font-semibold text-ink" align="start">
              Print it, put it on a table. Anyone who scans it is in — and their phone is a Papic camera, shooting from
              your shared credits. Reprint from a fresh code if it ends up somewhere you did not intend.
            </InfoTip>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <CopyButton value={code.url} />
              <Link
                href={`/dashboard/${eventId}/studio/papic/crew/poster`}
                target="_blank"
                rel="noopener"
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/75 hover:bg-ink/5"
              >
                <Printer aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                Print poster
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <p className="flex items-start gap-2 text-[13px] text-ink/65" data-one-code-notice="">
          <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
          {code.notice ?? 'We couldn’t check your shared code just now. Reload the page to try again.'}
        </p>
      )}
      <p className="flex items-center justify-between gap-2 text-[12.5px] text-ink/60" data-one-code-guests="">
        <span className="min-w-0">Each guest’s invite QR is already their camera</span>
        <span className="shrink-0 font-medium text-success-800">{code.ready === null ? '—' : `${formatCount(code.ready)} ready`}</span>
      </p>
    </div>
  );
}
