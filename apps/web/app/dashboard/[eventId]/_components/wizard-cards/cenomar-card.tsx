/**
 * Card 25/25.1 Cenomar (PSA) · Phase 5 · Legal + Paperwork tier.
 *
 * Cenomar = Certificate of No Marriage Record from PSA. Required for
 * marriage license application. Processing takes ~2-3 weeks via online
 * application (psahelpline.ph) or in-person at PSA branches.
 *
 * 2026-05-24 owner directive: split into bride + groom (PR #534). PH
 * marriage license needs BOTH partners' Cenomars · each filed separately
 * at PSA. The dispatcher passes either `cenomar_bride` or `cenomar_groom`
 * as taskId; this component switches its copy to match the active
 * partner.
 *
 * Typical sequence per partner: apply online → wait 2-3 weeks → claim
 * at PSA branch or get couriered → both Cenomars then submit to the
 * civil registrar with the marriage license application.
 */

import type { WizardTaskId } from '@/lib/wizard';
import { PaperworkCard } from './paperwork-card';

type Props = {
  eventId: string;
  /** Which partner's Cenomar this card tracks. The component reuses the
   *  same PaperworkCard primitive for both · copy + tracking key differ. */
  taskId: Extract<WizardTaskId, 'cenomar_bride' | 'cenomar_groom'>;
};

export function CenomarCard({ eventId, taskId }: Props) {
  const partner = taskId === 'cenomar_bride' ? 'bride' : 'groom';
  const partnerLabel = partner === 'bride' ? "the bride's" : "the groom's";
  return (
    <PaperworkCard
      eventId={eventId}
      taskId={taskId}
      intro={
        <>
          <p>
            {partner === 'bride' ? 'She' : 'He'} needs{' '}
            <strong>{partnerLabel} Certificate of No Marriage Record</strong>{' '}
            from PSA before you can apply for your marriage license. Apply
            online via psahelpline.ph or in-person at any PSA branch.
          </p>
          <p className="mt-2 text-ink/65">
            Processing usually takes 2-3 weeks. Click{' '}
            <em>Submitted · in flight</em> once the application is in —
            we&apos;ll surface this card in your in-flight tray so you can
            mark it done when the certificate arrives.
          </p>
        </>
      }
      metaFields={[
        {
          name: 'reference',
          label: 'PSA reference number (optional)',
          placeholder: 'e.g. PSA-2026-12345678',
          maxLength: 64,
        },
      ]}
      inFlightLabel="Application submitted"
      doneLabel={`We have ${partnerLabel} Cenomar`}
    />
  );
}
