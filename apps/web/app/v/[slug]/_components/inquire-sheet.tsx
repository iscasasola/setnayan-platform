'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, LogIn, MessageCircle, Plus, Send, Undo2 } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { SignInHereLink } from '@/app/_components/auth/sign-in-here-link';
import { useSignInPanel } from '@/app/_components/auth/sign-in-here';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { ChosenRow, FormRows, SwitchRow } from '@/app/_components/form-row';
import { startServiceInquiry, type StartServiceInquiryResult } from '@/app/v/[slug]/inquiry-actions';
import {
  INQUIRE_UNDO_MS,
  inquireClearedHref,
  inquireResumeHref,
  inquireResumeOf,
  inquireSendPicks,
  NO_SERVICES_LINE,
  PRICE_ON_REQUEST,
  type InquireListItem,
} from '@/lib/shop-inquire';

/**
 * INQUIRE — the shop page's one pop-up (owner 2026-11-07, verbatim: *"inquire for your event is it should have been a
 * pop up to first ask what service/s are they interested to then connect them to which event the user has and it will
 * add them to those categories automatically and send inquire. if they created a new event, it should also do the
 * same. still add that chosen service to the user's event's supplier>find."*; DECISION_LOG 2026-10-04 "INQUIRE ASKS
 * FOR WHICH CELEBRATION (OR STARTS ONE)" and "ONE INQUIRE — THE BUTTON OPENS THE INQUIRY").
 *
 * 🔁 RULE 0 — IT IS CHECK A DATE'S SHEET, WITHOUT THE DATE. `dates/_components/check-a-date-calendar.tsx` already ships
 * services (one or more) → which event (or start one, the picks kept in the address) → Send with a 5 s Undo, through
 * the SHIPPED `startServiceInquiry`. This is the same steps, the same parts (`Sheet`, `SwitchRow`, `ChosenRow`,
 * `ActionButton`, `SignInHereLink`) and the same ONE send — never a second inquiry path.
 *
 *   1 · Which services?  EVERY service the shop provides (owner 2026-11-07, "Yes, list all"): its ACTIVE cards with
 *       their prices, then each service it picked at sign-up (`vendor_profiles.services`) that has no card, by its
 *       taxonomy name with "Price on request" (`inquireServiceList`). Several may be picked. A shop with neither skips
 *       this step and sends a general question (`general: true`), saying so in one line.
 *   2 · For which event? the couple's events (`resolveAddShopToEvent`, the shipped picker's list), or Start a new event
 *       → create-event `?next=` this shop with `?inquire=1&isvc=…`, which reopens this sheet on this step.
 *   3 · Send (Undo 5 s) → the thread, the opening note + their words, the services as interests, the shop on that
 *       event's Suppliers › Find under the FIRST pick's category — a card's, or a card-less service's own key
 *       (`serviceKeys`, `inquireSendPicks`) — as `event_vendors` considering.
 *
 * 🔑 SIGNED OUT: THE SIGN-IN SHEET FIRST (owner 2026-11-07, "never just link to /signup"). The press writes the ask
 * into the address, then opens the SHIPPED sign-in sheet (`useSignInPanel`) over the shop. Signed in there, the page
 * refreshes in place and this pop-up opens for the same shop; signed in through Google, the return lands on that
 * address and `?inquire=1` opens it.
 *
 * 🚪 OPENED BY THE PAGE'S OWN INQUIRE LINKS. Every `<a href="#get-in-touch">` on the shop (the hero's, the action
 * row's, a service sheet's) stays a real link — with no JavaScript it still scrolls to the section — and a press is
 * caught here and opens the sheet instead. `?inquire=1` on arrival (back from sign-in or a new event) reopens it.
 */

export type InquireService = InquireListItem;
export type InquireEvent = { eventId: string; label: string };

type Step = 'services' | 'event' | 'sending' | 'sent';
type SendArgs = Parameters<typeof startServiceInquiry>[0];

const MAIN = 'w-full justify-center !min-h-12';

export function InquireSheet({
  shop,
  services,
  signedIn,
  events,
  inquirySource,
  referringChapterPublicId,
  send = startServiceInquiry,
}: {
  shop: { vendorProfileId: string; slug: string; name: string };
  services: InquireService[];
  signedIn: boolean;
  events: InquireEvent[];
  inquirySource: string | null;
  referringChapterPublicId: string | null;
  /** The one send. A lab passes a stand-in; the shop page never does. */
  send?: (input: SendArgs) => Promise<StartServiceInquiryResult>;
}) {
  const general = services.length === 0;
  const [step, setStep] = useState<Step | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [sent, setSent] = useState<{ eventId: string; threadId: string } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { openSignIn, panel } = useSignInPanel();

  const open = useCallback(
    (at?: Step, picks?: string[]) => {
      setNote(null);
      setSent(null);
      const known = (picks ?? []).filter((id) => services.some((s) => s.serviceId === id));
      setChosen(known.length > 0 ? known : services[0] ? [services[0].serviceId] : []);
      setEventId(events.length === 1 ? (events[0]?.eventId ?? null) : null);
      setStep(at ?? (general ? 'event' : 'services'));
    },
    [services, events, general],
  );

  // The page's own Inquire links open the sheet (captured, so the link's scroll never runs).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href="#get-in-touch"]');
      if (!a) return;
      e.preventDefault();
      // A service card's own "Inquire about this" names its card, so the pop-up opens with it picked.
      const svc = a.getAttribute('data-inquire-service');
      const picks = svc ? [svc] : undefined;
      if (!signedIn) {
        // The sign-in sheet first; the ask waits in the address (a Google sign-in comes back to it).
        window.history.replaceState(window.history.state, '', inquireResumeHref(window.location.href, picks ?? []));
        openSignIn({ onSignedIn: () => open(undefined, picks) });
        return;
      }
      open(undefined, picks);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [open, openSignIn, signedIn]);

  // Back from sign-in or from starting an event: `?inquire=1&isvc=…` reopens on the event step, the picks kept.
  useEffect(() => {
    const ask = inquireResumeOf(window.location.search);
    if (!ask) return;
    // Picks already made → straight back to the event step; otherwise from the top.
    open(ask.serviceIds.length > 0 || general ? 'event' : 'services', ask.serviceIds);
    // Once, on arrival — not again when the page refreshes its props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One event → it is picked for them (also after a sign-in in place brings the list in).
  useEffect(() => {
    if (step !== 'event') return;
    setEventId((cur) => (cur && events.some((e) => e.eventId === cur) ? cur : events.length === 1 ? (events[0]?.eventId ?? null) : null));
  }, [step, events]);

  // From the event step on, keep the picks in the address — the sign-in panel and create-event both come back to it.
  useEffect(() => {
    if (step !== 'event') return;
    const href = inquireResumeHref(window.location.href, chosen);
    if (href !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState(window.history.state, '', href);
    }
  }, [step, chosen]);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const close = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setStep(null);
    setNote(null);
    const cleared = inquireClearedHref(window.location.href);
    if (cleared !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState(window.history.state, '', cleared);
    }
  };

  const fire = async () => {
    if (!eventId) return;
    // In pick order: the first pick is where the shop is filed on the event's Find (a card, or a card-less service).
    const picks = inquireSendPicks(
      general ? [] : chosen.map((id) => services.find((s) => s.serviceId === id)).filter((s): s is InquireService => !!s),
    );
    try {
      const res = await send({
        vendorProfileId: shop.vendorProfileId,
        eventId,
        initialServiceId: picks.initialServiceId,
        initialCategoryKey: picks.initialCategoryKey,
        alsoServiceIds: picks.alsoServiceIds,
        serviceKeys: picks.serviceKeys,
        general,
        requirements: message.trim() ? { specialRequest: message.trim() } : undefined,
        inquirySource,
        referringChapterPublicId,
      });
      if (res.status === 'ok' || res.status === 'ok_build_not_sent') {
        setSent({ eventId: res.eventId, threadId: res.threadId });
        setStep('sent');
        // Sent: the ask leaves the address, so a reload does not open it again.
        window.history.replaceState(window.history.state, '', inquireClearedHref(window.location.href));
        return;
      }
      setStep('event');
      setNote(
        res.status === 'not_signed_in' || res.status === 'not_secured'
          ? 'Sign in to send this — your picks are kept.'
          : res.status === 'no_event'
            ? 'That event isn’t yours to ask from. Pick another.'
            : res.message || 'It didn’t send. Try again.',
      );
    } catch {
      setStep('event');
      setNote('It didn’t send. Check your connection and try again.');
    }
  };

  const hold = () => {
    if (!eventId || (!general && chosen.length === 0)) return;
    setNote(null);
    setStep('sending');
    const until = Date.now() + INQUIRE_UNDO_MS;
    setLeft(Math.ceil(INQUIRE_UNDO_MS / 1000));
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      const ms = until - Date.now();
      if (ms <= 0) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        void fire();
        return;
      }
      setLeft(Math.ceil(ms / 1000));
    }, 200);
  };
  const undo = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setStep('event');
    setNote('Not sent.');
  };

  const createHref = `/dashboard/create-event?next=${encodeURIComponent(
    typeof window === 'undefined' ? `/${shop.slug}` : inquireResumeHref(window.location.href, chosen),
  )}`;

  return (
    <>
    {panel}
    <Sheet open={step !== null} onClose={close} labelledById="inquire-sheet-title" rise>
      <div className="overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5" data-inquire-step={step ?? ''}>
        {step === 'services' ? (
          <>
            <h2 id="inquire-sheet-title" className="pr-12 text-[17px] font-bold">
              Which services?
            </h2>
            <p className="mb-2 text-[13px] text-ink/60">{shop.name} · pick one or more</p>
            <FormRows data="inquire-services">
              {services.map((s) => (
                <SwitchRow
                  key={s.serviceId}
                  name={s.label}
                  on={chosen.includes(s.serviceId)}
                  note={s.price || (s.provided ? PRICE_ON_REQUEST : undefined)}
                  onChange={(next) =>
                    setChosen((cur) => (next ? [...cur.filter((x) => x !== s.serviceId), s.serviceId] : cur.filter((x) => x !== s.serviceId)))
                  }
                  attrs={{ 'data-inquire-service': s.serviceId }}
                />
              ))}
            </FormRows>
            <div className="mt-3">
              <ActionButton tone="brand" main icon={ArrowRight} label="Next" onClick={() => setStep('event')} disabled={chosen.length === 0} className={MAIN} data-testid="inquire-next" />
            </div>
          </>
        ) : step === 'event' ? (
          <>
            <h2 id="inquire-sheet-title" className="pr-12 text-[17px] font-bold">
              For which event?
            </h2>
            <p className="mb-2 text-[13px] text-ink/60" data-inquire-for="">
              {general ? NO_SERVICES_LINE(shop.name) : `${shop.name} · ${chosen.length} service${chosen.length === 1 ? '' : 's'}`}
            </p>
            {!signedIn ? (
              <div data-inquire-sign-in="">
                <p className="py-2 text-[14px] text-ink/75">Sign in to pick your event. Your picks are kept.</p>
                <SignInHereLink href="/login" className={actionButtonClass('brand', { main: true, extra: MAIN })}>
                  <LogIn aria-hidden className="h-4 w-4" strokeWidth={2} />
                  <span className="lbl">Sign in</span>
                </SignInHereLink>
              </div>
            ) : (
              <>
                {events.length > 0 ? (
                  <FormRows data="inquire-event">
                    <ChosenRow
                      name="Event"
                      label="Your events"
                      value={eventId}
                      buttonText={eventId ? undefined : 'Pick'}
                      options={events.map((e) => ({ key: e.eventId, label: e.label }))}
                      onPick={(k) => setEventId(k)}
                      dataAttr="data-inquire-event"
                    />
                  </FormRows>
                ) : null}
                <div className="mt-2">
                  <ActionButton
                    tone={eventId ? 'neutral' : 'brand'}
                    main={!eventId}
                    icon={Plus}
                    label="Start a new event"
                    href={createHref}
                    className={MAIN}
                    data-testid="inquire-start-event"
                  />
                </div>
                <label className="mt-3 block text-[13px] text-ink/60" htmlFor="inquire-message">
                  {general ? 'Your question' : 'Anything to add? (optional)'}
                </label>
                <textarea
                  id="inquire-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-cream px-3 py-2 text-[15px] text-ink placeholder:text-ink/40"
                  placeholder={general ? `What would you like to ask ${shop.name}?` : 'Your date, your guest count, anything they should know'}
                  data-inquire-message=""
                />
                {note ? (
                  <p role="status" className="mt-2 text-[13px] text-ink/70" data-inquire-note="">
                    {note}
                  </p>
                ) : null}
                <div className="mt-3">
                  <ActionButton
                    tone="brand"
                    main
                    icon={Send}
                    label="Send"
                    onClick={hold}
                    disabled={!eventId || (!general && chosen.length === 0)}
                    className={MAIN}
                    data-testid="inquire-send"
                  />
                </div>
              </>
            )}
          </>
        ) : step === 'sending' ? (
          <>
            <h2 id="inquire-sheet-title" className="pr-12 text-[17px] font-bold" aria-live="polite">
              Sending in {left} s…
            </h2>
            <p className="mb-2 text-[13px] text-ink/60">To {shop.name}</p>
            <ActionButton tone="neutral" icon={Undo2} label="Undo" onClick={undo} className={MAIN} data-testid="inquire-undo" />
          </>
        ) : step === 'sent' ? (
          <>
            <h2 id="inquire-sheet-title" className="pr-12 text-[17px] font-bold" data-inquire-sent="">
              Sent ✓
            </h2>
            <p className="mb-2 text-[13px] text-ink/60">
              {shop.name} will reply in your chat. They&rsquo;re on your event&rsquo;s Suppliers now.
            </p>
            <div className="grid gap-2.5">
              {sent ? (
                <ActionButton tone="info" main icon={MessageCircle} label="Open the chat" href={`/dashboard/${sent.eventId}/messages/${sent.threadId}`} className={MAIN} data-testid="inquire-open-chat" />
              ) : null}
              <ActionButton tone="neutral" icon={Check} label="Done" onClick={close} className={MAIN} data-testid="inquire-done" />
            </div>
          </>
        ) : null}
      </div>
    </Sheet>
    </>
  );
}
