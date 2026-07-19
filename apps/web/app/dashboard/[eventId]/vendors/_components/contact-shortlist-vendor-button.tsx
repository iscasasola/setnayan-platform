'use client';

/**
 * ContactShortlistVendorButton — "Contact vendor" on a shortlisted marketplace
 * pick (Creator Economy PR-D · owner 2026-07-17). Opens (or resumes) the
 * couple↔vendor thread for THIS event via `contactShortlistVendor`, which
 * delegates to the canonical `startServiceInquiry` and stamps
 * `inquiry_source='shortlist'`. Rendered only for a marketplace-connected pick
 * that has no thread yet (an existing inquiry shows its own status badge), but
 * the server dedupes on the UNIQUE(event_id, vendor_profile_id) thread anyway,
 * so a click can never double-send — a resumed thread just opens.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Loader2 } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { contactShortlistVendor } from '../_actions/contact-shortlist-vendor';

export function ContactShortlistVendorButton({
  eventId,
  vendorId,
}: {
  eventId: string;
  vendorId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const contact = () => {
    haptic('confirm');
    setErr(null);
    start(async () => {
      const res = await contactShortlistVendor({ eventId, vendorId });
      if (res.status === 'ok') {
        router.push(`/dashboard/${res.eventId}/messages/${res.threadId}`);
        return;
      }
      if (res.status === 'not_signed_in') {
        router.push('/login');
        return;
      }
      if (res.status === 'not_marketplace' || res.status === 'no_event') {
        setErr("This vendor can't be messaged here.");
        return;
      }
      if (res.status === 'not_secured') {
        setErr('Save your account first to message this vendor.');
        return;
      }
      setErr(res.status === 'error' ? res.message : 'Could not open the conversation.');
    });
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={contact}
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-mulberry/30 bg-mulberry/5 px-3 py-2 text-[12.5px] font-semibold text-mulberry transition-colors hover:bg-mulberry/10 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
        )}
        {pending ? 'Opening…' : 'Contact vendor'}
      </button>
      {err ? <p className="mt-1 text-[11px] text-danger-700">{err}</p> : null}
    </div>
  );
}
