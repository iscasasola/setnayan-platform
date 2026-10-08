'use client';

import type { ComponentProps } from 'react';
import { MakerRsvpSettings } from '@/app/dashboard/[eventId]/launch/_components/maker-rsvp-ask';

/**
 * 🧪 STUDIO › RSVP IN THE LAB (DEV-ONLY — `/dev/maker-lab?studio=1`, `/dev/details-lab?studio=1`).
 *
 * The REAL panel (`MakerRsvpSettings`, `studio`), with ONE stand-in: Reply by's writer. The lab has no database
 * and no sign-in, so the real `updatePaxSettings` cannot take a date — and a day picked on the calendar then read as
 * a refused save ("Reply by did not save. It is back as it was."), which is not what the page does for a couple.
 * The stand-in answers as the action does when it lands. A client file, because a server one cannot hand a
 * function to the panel. Nothing a real user can reach: the lab pages 404 in production.
 */
const replyByLanded = (async () => ({ ok: true })) as unknown as NonNullable<ComponentProps<typeof MakerRsvpSettings>['replyByAction']>;

export function LabStudioRsvp(props: Omit<ComponentProps<typeof MakerRsvpSettings>, 'replyByAction' | 'studio'>) {
  return <MakerRsvpSettings {...props} studio replyByAction={replyByLanded} />;
}
