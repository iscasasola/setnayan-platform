/**
 * add-to-event-cta.tsx — the hero's primary button, which is the ONLY thing on
 * a service page that differs between signed out and signed in.
 *
 * Owner, 2026-08-21: *"when you are not inside an event. it is only the same as
 * the signed out version"* … *"the only difference is add to an event button.
 * then it will let them pick which event will this be added to."*
 *
 * 🔴 THIS WAS BUILT AS A SWAP AND THAT WAS WRONG — the owner lost a button.
 * "Start planning · free" IS the create button on all seven pages, and
 * replacing it meant a signed-in person could no longer start a celebration
 * from the page at all; creating had moved one click deep, inside the dialog.
 * Owner, within the hour: *"i lost the create button on my page."*
 *
 * *"The only difference is add to an event button"* means the page GAINS one
 * button. It does not mean it trades one for another. So signed in now renders
 * BOTH — the picker as the primary action, because somebody with celebrations
 * usually wants to add rather than start another, and the original create link
 * beside it, still one press away. Nothing is removed in either state, and
 * `add-to-event-is-the-only-difference.test.ts` pins THAT now.
 *
 * An async server component rendered from a synchronous one, on purpose: the
 * doorway kit stays sync, and the one await lives with the thing that needs it.
 */
import Link from 'next/link';

import { resolveAddToEvent } from './add-to-event-data';
import { AddToEvent } from './add-to-event';

const PRIMARY_CTA =
  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full ' +
  'bg-[var(--m-mulberry)] px-7 py-3 text-sm font-semibold text-[var(--m-paper)] ' +
  'transition-opacity hover:opacity-90';

/** the quiet twin, copied from the kit so the two rows sit level */
const SECONDARY_CTA =
  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full ' +
  'border border-[var(--m-ink)]/20 px-7 py-3 text-sm font-semibold text-[var(--m-ink)] ' +
  'transition-colors hover:bg-[var(--m-ink)]/[0.04]';

export async function AddToEventCta({
  studioKey,
  primary,
}: {
  /** the `STUDIO_APPS` key for this page — absent means "no picker here" */
  studioKey: string;
  primary: { href: string; label: string };
}) {
  const state = await resolveAddToEvent(studioKey);

  if (!state.signedIn) {
    return (
      <Link href={primary.href} className={PRIMARY_CTA}>
        {primary.label}
      </Link>
    );
  }

  return (
    <>
      <AddToEvent
        serviceName={state.serviceName}
        options={state.options}
        emptyReason={state.emptyReason}
      /*
        The create row goes exactly where the signed-out button goes, so this
        page has ONE route into starting a celebration rather than two that can
        drift. It also means we make no claim here about which kinds of
        celebration this service works with — a claim that would need a read of
        every event-type profile to stay true, and would rot the first time an
        admin changed one.
      */
        createHref={primary.href}
        createLabel={primary.label}
      />
      {/*
        THE CREATE BUTTON IS NEVER TAKEN AWAY. It is the same link a stranger
        sees, same href, same label — demoted to the quiet style because the
        picker is the likelier action for somebody who already has a
        celebration, but never removed.
      */}
      <Link href={primary.href} className={SECONDARY_CTA}>
        {primary.label}
      </Link>
    </>
  );
}
