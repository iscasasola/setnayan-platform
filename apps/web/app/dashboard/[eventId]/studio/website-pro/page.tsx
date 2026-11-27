import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { routes } from '@/lib/routes';
import { getIapGate } from '@/lib/request-platform';
import { iapProductForServiceKey, IAP_PAPIC_PRODUCTS } from '@/lib/iap/products';
import { CapizLight } from '@/app/_components/signature/capiz-light';
import { PageMasthead } from '@/app/_components/page-masthead';
import { readEventServices } from '@/lib/event-services.server';
import { PACK_KEYS, SINGLE_CODES, SINGLE_KEYS, singleTickable, singlesInPlan, type EventServicesFacts, type EventServicesPick, type PackKey, type SingleKey } from '@/lib/event-services';
import { PLAN_PRICE_CODES } from '@/lib/event-plans';
import { EventServicesBody } from './_components/event-services-body';
import { UNLOCK_AND_APPLY_PARAM } from '@/lib/hub-pro-effects';
import { createClient } from '@/lib/supabase/server';
import { startRefusalLine } from '@/lib/iap/iap-outcome';
// 🎨 The website template's look for this page (v5) — loaded here and in its lab, never in a unit render.
import './_components/event-services-website.css';

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
  /* 🍎 THE iPHONE APP (drawing v4 frames 08 · 08b · 08c · 08e · 08f): the same page, Apple's prices only. The store
     shell never receives a web figure — every peso the read produced is stripped HERE, before anything reaches the
     browser — and without Apple's shop (an old build, Apple off) it offers nothing: Today. */
  const gate = await getIapGate();
  if (gate.storeShell && !gate.iap) redirect(`/dashboard/${eventId}`);
  // 📸 In the app, Papic is the couple's alone (`startAppStorePurchase` refuses anyone else — a co-host is stored as
  // 'coordinator'), so the same membership read decides whether the photo buy is offered at all.
  const [read, coupleHere] = await Promise.all([readEventServices(eventId), gate.storeShell ? isCoupleOf(eventId, user.id) : Promise.resolve<boolean | null>(true)]);
  const appleProducts = gate.storeShell ? appleProductsFor(coupleHere === true) : null;
  const photosRefusal = coupleHere === true ? null : coupleHere === false ? startRefusalLine('couple_only') : PHOTOS_UNREAD;
  const facts = appleProducts ? withoutWebFigures(read) : read;
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
  // In the app no web figure is handed in, so a pack Apple sells can be picked on arrival without one.
  const pack = wantPack && facts.packs.some((p) => p.key === wantPack && p.state === 'buy' && (appleProducts !== null || p.php !== null)) ? wantPack : null;
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
        appleProducts={appleProducts}
        photosRefusal={photosRefusal}
      />
    </>
  );
}

/** 🍎 What Apple sells on this page: the three plans, Live Watch and the photo packs — catalogue code → product id.
 *  Event Hub and Setnayan AI have no Apple product, so the app does not show them (no link out to the web). */
function appleProductsFor(withPapic: boolean): Record<string, string> {
  const out: Record<string, string> = {};
  for (const code of [...Object.values(PLAN_PRICE_CODES), SINGLE_CODES.live]) {
    const p = iapProductForServiceKey(code);
    if (p) out[code] = p.productId;
  }
  // 📸 Only the couple is sold Papic in the app — the same rule `startAppStorePurchase` holds on the server.
  if (withPapic) for (const p of IAP_PAPIC_PRODUCTS) out[p.serviceKey] = p.productId;
  return out;
}

/** The photo row's own "couldn't read" line — said when who may buy could not be read (never a guess either way). */
const PHOTOS_UNREAD = 'The photo sizes couldn’t be read. Try again in a moment.';

/** 📸 Is this person the event's couple (`event_members.member_type`)? Null = the read failed. */
async function isCoupleOf(eventId: string, userId: string): Promise<boolean | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return (data as { member_type?: string } | null)?.member_type === 'couple';
}

/** 🍎 Every web peso out of the facts before they reach the app's browser (Apple's rule: no web price in the app). */
function withoutWebFigures(f: EventServicesFacts): EventServicesFacts {
  return {
    ...f,
    packs: f.packs.map((p) => ({ ...p, php: null, savePhp: null })),
    singles: f.singles.map((x) => ({ ...x, php: null })),
    photos: f.photos ? f.photos.map((x) => ({ ...x, php: 0 })) : null,
  };
}
