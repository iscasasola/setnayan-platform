import { Smartphone } from 'lucide-react';
import { countNoun } from '@/lib/format-number';
import { papicCaptureCost } from '@/lib/papic-cameras-pure';
import { readPhoneUploadsSetting } from '@/lib/papic-phone-uploads.server';
import { SettingRow } from './setting-row';
import { PhoneUploadsHeldPicker } from './phone-uploads-held-picker';

import { InfoTip } from '@/app/_components/info-tip';
/**
 * 📲 PHOTOS FROM GUESTS' PHONES — one row in Papic's settings (guest upload v2, approved 2026-11-13; prototype
 * `guest_phone_uploads_2026-11-13`, state "Couple — setting"). Its answer: "Right away" or "After I check".
 *
 * Owner, verbatim: *"Depends if they allow realtime or after they check (upon publishing of the story of the event)"*.
 * The sheet holds the two-way choice and what each one does to a guest's photo; the save goes through
 * /api/papic/phone-uploads (the server-action budget is at its ceiling). The price line is asked of
 * `papicCaptureCost(…, 'upload')` — the function the route charges with — never typed.
 *
 * ⚠ AN UNREAD SETTING IS SAID AS ONE — never shown as the default "Right away".
 */
export async function PhoneUploadsChoice({ eventId }: { eventId: string }) {
  const setting = await readPhoneUploadsSetting(eventId);
  const per = countNoun(papicCaptureCost('photo', null, 'upload'), 'credit', 'credits');
  const day = setting?.daysWords ?? 'the event day';
  const value = setting === null ? 'Couldn’t check' : setting.held ? 'After I check' : 'Right away';
  return (
    <div data-phone-uploads-row="">
      <SettingRow
        icon={<Smartphone aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
        label="Photos from guests’ phones"
        value={value}
        sheetTitle="Photos from guests’ phones"
      >
        <div className="px-5 py-4">
          <InfoTip labelAs="p" label="A guest can add photos they took on from their own phone." labelNode={<>A guest can add photos they took on {day} from their own phone.</>} labelClassName="text-sm text-ink/70" className="mb-4" align="start">
            Each one uses {per} from your pot, the same
            as a photo you add yourself.
          </InfoTip>
          {setting === null ? (
            <p className="text-sm text-danger-700" role="alert">
              Couldn’t check this setting just now. Close this and try again in a moment.
            </p>
          ) : (
            <PhoneUploadsHeldPicker eventId={eventId} held={setting.held} />
          )}
        </div>
      </SettingRow>
    </div>
  );
}
