/**
 * /open-shop/invite — "Invite shops you trust" (Door C, after the shop opens), while the server answers.
 *
 * WHY: the speed audit of 2026-11-27 (Group J) listed the open-shop steps: a tap here showed nothing until the server
 * answered — 3 reads in 3 steps before paint (the account, the active shop, its name and address) plus the QR drawing.
 * Without this file it would borrow `/open-shop`'s step-1 wizard skeleton, which is the wrong shape.
 *
 * SHAPE: inside the one open-shop layer (its head carries the title and line), as the page draws it — the wordmark,
 * the centred QR card (the code plate, the shop's name, the owner's line, the share note), then the bottom bar with
 * Later on the left and Done on the right. The shop's name is not known here, so it is a grey Ghost.
 */
import { Ghost, Screen, Sk } from '@/components/skeletons';

export default function InviteShopsLoading() {
  return (
    <Screen className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto grid w-full max-w-xl flex-1 content-start gap-5 px-4 pt-6 md:px-7">
        <Sk className="h-3.5 w-24 rounded" />
        {/* The QR card — plate, name, line, note. */}
        <div className="flex flex-col items-center gap-2.5 py-1.5">
          <Sk className="h-48 w-48 rounded-lg" />
          <Ghost className="h-4 w-40 rounded" />
          <Sk className="h-3.5 w-3/5 rounded" />
          <Sk className="mt-2 h-3 w-4/5 rounded" />
        </div>
      </div>
      <div className="sticky bottom-0 mt-auto flex items-center gap-2 border-t border-ink/10 px-4 pb-3 pt-3 md:px-7">
        <Sk className="h-11 w-24 rounded-full" />
        <Sk className="ml-auto h-11 w-28 rounded-full" />
      </div>
    </Screen>
  );
}
