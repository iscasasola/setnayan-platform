import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { routes } from '@/lib/routes';
import { getIapGate } from '@/lib/request-platform';
import { CapizLight } from '@/app/_components/signature/capiz-light';
import { PageMasthead } from '@/app/_components/page-masthead';
import { readEventServices } from '@/lib/event-services.server';
import { PACK_KEYS, SINGLE_KEYS, singleTickable, singlesInPlan, type EventServicesPick, type PackKey, type SingleKey } from '@/lib/event-services';
import { EventServicesBody } from './_components/event-services-body';
import { UNLOCK_AND_APPLY_PARAM } from '@/lib/hub-pro-effects';

export const metadata = { title: 'Event services' };

/**
 * 🛒 /dashboard/[eventId]/studio/website-pro — EVENT SERVICES, the one place to buy for an event (owner 2026-11-23,
 * DECISION_LOG "ONE PLACE TO BUY FOR AN EVENT" · "EVENT PLANS ARE PACKAGES; SINGLES ARE THE SECOND CHOICE" · "EVENT
 * SERVICES v4 — APPROVED TO BUILD"; drawing `prototypes/buy_event_services_one_place_2026-11-23/frames_v4_clean_warm/`).
 *
 * The shipped plans page grew into it (RULE 0 — the address every plan door already uses, `planScreenHref`, is kept):
 * Your plan · the packs with their saving · the singles as the quieter second choice · ONE cart → ONE order → the shipped
 * `/pay/[reference]` (Maya; the BDO QR route only when Maya will not open).
 *
 * ONE batched read (`readEventServices`) — every price through the charge authority the order is billed by.
 *
 * Doors (closed values only):
 *   · `?plan=plus|pro|ultra` — a plan door (`lib/plan-buy-doors.ts`): that pack picked on arrival;
 *   · `?buy=full` — the Maker's ✓ Apply for the whole Hub: the cheapest pack holding it (Event Plus) picked;
 *   · `?add=photos|live|ai|hub` — Papic "Add more", the Live Watch page, Setnayan AI, a Hub lock: the singles open,
 *     that single ticked when it can be.
 */
type Props = {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ plan?: string; buy?: string; add?: string; from?: string; then?: string }>;
};

const ADD_KEYS = ['photos', ...SINGLE_KEYS] as const;

export default async function EventServicesPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = (await searchParams) ?? {};
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  /* 🍎 The App Store shell never sees a web price or a way to pay on the web (Apple's rule). Until the iPhone half of
     Event services lands, the app keeps its shipped Apple screen; without Apple, Today. */
  const gate = await getIapGate();
  if (gate.storeShell) redirect(gate.iap ? `/dashboard/${eventId}/apple-pro` : `/dashboard/${eventId}`);

  const facts = await readEventServices(eventId);
  /* 💎 From the Maker's Apply sheet (`?from=maker`, owner 2026-09-28): the way back is the Maker, where the draft waits
     untouched; "Unlock … and Apply" (`then=apply`) comes back with `?apply=1`, which applies the draft once its parts
     are active (`unlockAndApplyOnReturn`). A closed value, never a URL from the request. */
  const back =
    search.from === 'maker'
      ? { href: `/dashboard/${eventId}/launch${search.then === 'apply' ? `?${UNLOCK_AND_APPLY_PARAM}=1` : ''}`, label: 'Back to the Maker' }
      : null;

  // ── a door's pick on arrival — closed values, and only what can really be picked ──
  const wantPack: PackKey | null =
    typeof search.plan === 'string' && (PACK_KEYS as readonly string[]).includes(search.plan)
      ? (search.plan as PackKey)
      : search.buy === 'full'
        ? 'plus'
        : null;
  const pack = wantPack && facts.packs.some((p) => p.key === wantPack && p.state === 'buy' && p.php !== null) ? wantPack : null;
  const add = typeof search.add === 'string' && (ADD_KEYS as readonly string[]).includes(search.add) ? search.add : null;
  const addSingle = add && add !== 'photos' ? (add as SingleKey) : null;
  const single = addSingle ? facts.singles.find((s) => s.key === addSingle) : undefined;
  const initialPick: EventServicesPick = {
    pack,
    singles: single && singleTickable(single, singlesInPlan(facts.plan, pack)) ? [single.key] : [],
    photos: null,
  };

  return (
    <>
      <CapizLight subject={`event:${eventId}`} plan={facts.plan && facts.plan !== 'free' ? facts.plan : null} word={`${facts.planName ?? ''} unlocked`} />
      <PageMasthead title="Event services" />
      <EventServicesBody
        eventId={eventId}
        facts={facts}
        ordersHref={routes.dashboard.orders.index(eventId)}
        initialPick={initialPick}
        initialOpen={add !== null}
        back={back}
      />
    </>
  );
}
