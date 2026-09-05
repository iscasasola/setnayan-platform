'use client';

/**
 * RejectionNotice — THE SUPPLIER FINDS OUT WHY (MB21).
 *
 * 🔑 WHY THIS IS ITS OWN FILE. Until MB21 an admin's only refusal was
 * `retireAsset`, which hid the photo and said nothing. The supplier's editor
 * went on reading "draft (pending review)" — forever, for a photo nobody was
 * going to review again. A decision was made, recorded in the database, and
 * never reached the one person who could act on it. That is the same defect
 * class as the couple with 180 guests being told their wedding was empty, and
 * the repo's shorthand for it is A LOG LINE NEVER CHANGED A PIXEL.
 *
 * Extracting it buys a real render test
 * (`a-rejection-reaches-the-vendor.test.ts`) against the actual sentence, and
 * lets that test pin the MOUNT inside `stylist-library-editor.tsx` so deleting
 * the mount is red rather than invisible.
 *
 * ⚠ THE WORDING IS THE HARD-BLOCK WORDING. `rejectionSentence` frames the
 * reviewer's clause the same way `contentRejectionMessage` frames an automatic
 * refusal, so a supplier does not have to learn two vocabularies for "this
 * photo cannot go up".
 */

import { rejectionSentence } from '@/lib/moodboard-screen-findings';

export type RejectionNoticeProps = {
  /** `moodboard_library_assets.rejected_at`. Null ⇒ nothing to say. */
  rejectedAt: string | null;
  /** The reviewer's own words. The DB CHECK pairs it with `rejectedAt`. */
  reason: string | null;
};

export function RejectionNotice({ rejectedAt, reason }: RejectionNoticeProps) {
  if (!rejectedAt) return null;

  const sentence = rejectionSentence(reason);

  return (
    <div
      role="status"
      data-testid="rejection-notice"
      className="rounded-lg border border-danger-300 bg-danger-50 px-4 py-3 text-sm text-danger-700"
    >
      {/* 🛑 A REJECTION WITH NO READABLE REASON STILL SAYS SOMETHING. The DB
          CHECK makes a blank reason unrepresentable, but a render that depends
          on a constraint it cannot see is how "pending review forever" happened
          in the first place — so the fallback names the state rather than
          drawing an empty red box. */}
      <p className="font-medium">
        {sentence || 'We couldn’t publish this photo.'}
      </p>
      <p className="mt-1 text-danger-700/80">
        Nothing is deleted — fix what’s named above, upload the corrected photo,
        and it goes back into review.
      </p>
    </div>
  );
}
