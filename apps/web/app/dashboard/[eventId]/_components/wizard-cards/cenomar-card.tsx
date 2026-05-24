/**
 * Card 25 Cenomar (PSA) · Phase 5 · Legal + Paperwork tier.
 *
 * Cenomar = Certificate of No Marriage Record from PSA. Required for
 * marriage license application. Processing takes ~2-3 weeks via online
 * application (psahelpline.ph) or in-person at PSA branches. Both
 * partners need their own Cenomar.
 *
 * Typical sequence: apply online → wait → claim at PSA branch or get
 * couriered → submit to civil registrar with marriage license app.
 */

import { PaperworkCard } from './paperwork-card';

type Props = { eventId: string };

export function CenomarCard({ eventId }: Props) {
  return (
    <PaperworkCard
      eventId={eventId}
      taskId="cenomar"
      intro={
        <>
          <p>
            Both of you need a <strong>Certificate of No Marriage Record</strong> from
            PSA before you can apply for your marriage license. Apply online
            via psahelpline.ph or in-person at any PSA branch.
          </p>
          <p className="mt-2 text-ink/65">
            Processing usually takes 2–3 weeks. Click <em>Submitted · in flight</em> once
            both applications are in — we&apos;ll surface this card in your in-flight tray
            so you can mark it done when the certificates arrive.
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
      inFlightLabel="Applications submitted"
      doneLabel="We have both Cenomars"
    />
  );
}
