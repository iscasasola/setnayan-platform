/**
 * add-to-event-cta.tsx — the hero's primary button, which is the ONLY thing on
 * a service page that differs between signed out and signed in.
 *
 * Owner, 2026-08-21: *"when you are not inside an event. it is only the same as
 * the signed out version"* … *"the only difference is add to an event button.
 * then it will let them pick which event will this be added to."*
 *
 * So this renders EITHER the page's own "start planning" link (a stranger, and
 * anyone whose events could not be read) OR the picker button. The heading,
 * the lede, the price anchor, the secondary CTA and every section below are
 * untouched in both states — that identity is the ruling, and
 * `add-to-event-is-the-only-difference.test.ts` pins it.
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
  );
}
