/**
 * /claim/[token] — the wait before a loved one's claim link answers.
 *
 * Why: speed audit 2026-11-27, Group J. A tap showed nothing until the server answered.
 *
 * Shape: `DoorShell` on the page ground — the Setnayan wordmark above the card → the card: the eyebrow, the
 * visible heading ("Claim your profile, …" — it carries the person's name, so grey), the paragraph under it →
 * the two door actions (Sign in · Create your account) stacked on a phone.
 */
import { Ghost, Screen, Sk, SkLine } from '@/components/skeletons';

export default function ClaimLoading() {
  return (
    <Screen className="flex min-h-dvh w-full flex-col items-center justify-start bg-page px-4 py-4 sm:justify-center sm:px-6 sm:py-10">
      <div className="w-full max-w-md">
        {/* The wordmark — the way home. */}
        <Sk className="mb-4 h-6 w-28 rounded sm:mb-5" />
        <div className="sn-frame p-6 sm:p-8">
          <div className="space-y-2">
            <Sk className="h-2.5 w-20 rounded" />
            <Ghost className="h-8 w-4/5 rounded-md" />
            <div className="space-y-2 pt-1">
              <SkLine />
              <SkLine />
              <SkLine w="w-3/4" />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:mt-6 sm:flex-row">
            <Sk className="h-11 w-full rounded-md sm:flex-1" />
            <Sk className="h-11 w-full rounded-md sm:flex-1" />
          </div>
        </div>
      </div>
    </Screen>
  );
}
