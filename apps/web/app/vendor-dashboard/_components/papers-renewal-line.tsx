import { ArrowRight } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';

import { ActionButton } from '@/components/action-button';
import { Notice } from '@/app/_components/notices/notices';
import { readRenewalView } from '@/lib/papers-renewal.server';
import { renewalNotice, renewedNotice, type RenewalNoticeSpec } from '@/lib/papers-renewal';

/**
 * 📄 PAPERS RENEWAL ON TODAY — §1, §2 and §6 of the approved design (`prototypes/supplier_papers_renewal_2026-11-14_
 * fable.html`), through the one notice system (#7631): at 60 and 30 days a to-do (open ring, Not now); at 7 days a
 * live band in the warning tone with no close word; the day after 30 March a live band in the problem tone that stays
 * until the papers are checked; after a clean renewal one news line (Got it). At most two at the top — the rest wait
 * in the bell — is the notice system's rule, not this file's.
 *
 * It REPLACES Today's old "Business permit expires in N days" row (`permitNeed`), which named the permit's printed
 * date — the one thing ruling (1) says never decides the badge.
 *
 * A read that failed draws nothing: never a deadline that was not read.
 */
export async function PapersRenewalLine({ supabase, vendorProfileId }: { supabase: SupabaseClient; vendorProfileId: string }) {
  const view = await readRenewalView(supabase, vendorProfileId);
  if (!view) return null;
  const now = new Date();
  const spec =
    renewalNotice({ verified: view.verified, dueAt: view.dueAt, lapsedAt: view.lapsedAt }, now, {
      bookings: view.bookings,
      asksBefore: null,
    }) ??
    (view.renewed
      ? renewedNotice({ renewedAt: view.lastVerifiedAt, nextDueAt: view.dueAt, verified: view.verified, lapsedAt: view.lapsedAt }, now)
      : null);
  if (!spec) return null;
  return <PapersRenewalLineView spec={spec} />;
}

/** The drawn notice. Exported so the dev lab and the shots mount this, not a copy. */
export function PapersRenewalLineView({ spec }: { spec: RenewalNoticeSpec }) {
  const detail =
    spec.detail.length > 1 ? (
      <ul className="list-disc space-y-1 pl-4">
        {spec.detail.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    ) : (
      spec.detail[0]
    );
  return (
    <Notice
      kind={spec.kind}
      noticeKey={spec.key}
      title={spec.title}
      detail={detail}
      tone={spec.tone}
      closable={spec.closable}
      actions={
        spec.action ? (
          <ActionButton
            tone="brand"
            main
            icon={<ArrowRight aria-hidden strokeWidth={1.9} />}
            label={spec.action.label}
            href={spec.action.href}
            className="!h-11 !min-h-11"
          />
        ) : undefined
      }
    />
  );
}
