import 'server-only';
import type { MonogramStayDoor } from '@/lib/stay-doors/monogram';
import { eventScreen, type StayWords } from '@/lib/save-in-place';
import { STUDIO_NOTICES } from '@/app/dashboard/[eventId]/monogram/studio-notices';
import { clearStudioAction, saveStudioAction } from '@/app/dashboard/[eventId]/monogram/studio-actions';
import { clearUploadedMarkAction } from '@/app/dashboard/[eventId]/monogram/upload-actions';
import { kind, type Door } from './_door';

/** The monogram page's own banner words (`studio-notices.ts`) — `?studio_error=` / `?upload_error=`. */
const MONOGRAM_WORDS: StayWords = {
  within: [eventScreen('monogram')],
  refuse: (q) => {
    const code = q.get('studio_error') ?? q.get('upload_error');
    return code ? (STUDIO_NOTICES[code]?.text ?? null) : null;
  },
};
const monogram = kind(MONOGRAM_WORDS, 'invitations');

export const MONOGRAM: Readonly<Record<MonogramStayDoor, Door>> = {
  'monogram.saveStudioAction': monogram(saveStudioAction),
  'monogram.clearStudioAction': monogram(clearStudioAction),
  'monogram.clearUploadedMarkAction': monogram(clearUploadedMarkAction),
};
