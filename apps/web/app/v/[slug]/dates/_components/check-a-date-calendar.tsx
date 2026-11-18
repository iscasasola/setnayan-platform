'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck, CalendarX, Check, LogIn, MessageCircle, Plus, Send, Undo2, X } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { DemoOnlyMarker } from '@/app/_components/sample-marker';
import { SignInHereLink } from '@/app/_components/auth/sign-in-here-link';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { ChosenRow, FormRows, SwitchRow } from '@/app/_components/form-row';
import {
  CHECK_DATE_POPULAR,
  CHECK_DATE_WORDS,
  checkDateAskLine,
  checkDateResumeHref,
  checkDateStateOf,
  checkDateWords,
  type CheckDateEvent,
} from '@/lib/check-a-date';
import { startServiceInquiry } from '@/app/v/[slug]/inquiry-actions';
import { SeatMonths } from './seat-months';
import { dayShines } from '@/lib/hot-date';

/**
 * CHECK A DATE — the month and its one sheet (approved prototype `prototypes/check_a_date_2026-10-28/index.html`,
 * frames A · B · C · D), RE-DRAWN by SHOP-02 v7 (14 Nov 2026): it is a sheet over the shop now (`CheckADateSheet`), the
 * month is the seat plan (`SeatMonths`: green you can ask, grey striped you can't, popular days shine), and a tapped day
 * lists the shop's services at once, the ones that can take it first. Before v7 the month was the app's ONE grid (`CalendarGrid`, kind 31: a Not-bookable day was the hatched
 * square); the steps are the app's ONE sheet (`Sheet`).
 *
 * The page hands this file the shop's Not-bookable days and nothing else about its calendar — the answer, never the
 * reasons (`lib/check-a-date.server.ts`). The ask goes through the SHIPPED inquiry action, `startServiceInquiry`:
 * one conversation per event and shop, the services recorded as its interests, the date in the opening note.
 *
 * ↺ UNDO (5 s). Pressing Send HOLDS the ask for five seconds with an Undo beside it; nothing reaches the shop until the
 * window closes, so Undo takes nothing back — it simply never sends. Leaving the page inside the window sends nothing,
 * and the sheet says "Sending in N s" so that is never a surprise.
 */

export type { CheckDateEvent };

type Service = { serviceId: string; label: string; price: string; category: string | null };
type Step = 'day' | 'event' | 'sending' | 'sent';

/** How long Send waits for an Undo (owner brief: "Undo (5 s)"). */
export const CHECK_DATE_UNDO_MS = 5000;

const MAIN = 'w-full justify-center !min-h-12';

export function CheckADateCalendar({
  shop,
  logoUrl,
  onClose,
  inquirySource,
  inquiryVia = null,
  inquiryUtm = null,
  services,
  today,
  to,
  notBookable,
  perService,
  signedIn,
  events,
  initialDay,
  initialServices,
  initialStep,
}: {
  shop: { vendorProfileId: string; slug: string; name: string; initials: string; verified: boolean; isDemo?: boolean };
  /** The shop's own logo (a display URL), or null — its initials show instead, as everywhere else. */
  logoUrl: string | null;
  /** × — the sheet lowers back onto the shop (SHOP-02 v7: "See the shop" goes; × is the one way out). */
  onClose: () => void;
  /** 💳 RW-19: what an ask from here is stamped — the same rule as the shop page (`arrivalInquirySourceOf`). */
  inquirySource: string;
  /** 🏷 The material tag and campaign tags of the arrival (owner 2026-11-16) — carried into the inquiry, never shown. */
  inquiryVia?: string | null;
  inquiryUtm?: string | null;
  services: Service[];
  today: string;
  to: string;
  notBookable: string[];
  perService: Record<string, string[]> | null;
  signedIn: boolean;
  events: CheckDateEvent[];
  initialDay: string | null;
  initialServices: string[];
  initialStep: 'event' | null;
}) {
  const closed = useMemo(() => new Set(notBookable), [notBookable]);
  const closedFor = useMemo(
    () => (perService ? new Map(Object.entries(perService).map(([id, days]) => [id, new Set(days)])) : null),
    [perService],
  );

  const firstDay = initialDay && checkDateStateOf(initialDay, { notBookable: closed, today, to }) ? initialDay : null;
  const [day, setDay] = useState<string | null>(firstDay);
  const [step, setStep] = useState<Step | null>(firstDay ? (initialStep ?? 'day') : null);
  const serviceOpen = (id: string, d: string | null) => !d || !closedFor || !(closedFor.get(id)?.has(d) ?? false);
  const [chosen, setChosen] = useState<string[]>(() => {
    const known = initialServices.filter((id) => services.some((s) => s.serviceId === id));
    if (known.length > 0) return known;
    const first = services.find((s) => serviceOpen(s.serviceId, firstDay));
    return first ? [first.serviceId] : [];
  });
  const [eventId, setEventId] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [sent, setSent] = useState<{ eventId: string; threadId: string } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const state = day ? checkDateStateOf(day, { notBookable: closed, today, to }) : null;
  const words = day ? checkDateWords(day) : '';

  // The event step's choices: the couple's events on that day first (one is picked for them).
  const sameDay = useMemo(
    () => (day ? events.filter((e) => e.date !== null && e.date <= day && (e.endDate ?? e.date) >= day) : []),
    [events, day],
  );
  const others = useMemo(() => events.filter((e) => !sameDay.includes(e)), [events, sameDay]);
  useEffect(() => {
    if (step !== 'event') return;
    setEventId((cur) => (cur && events.some((e) => e.eventId === cur) ? cur : sameDay.length === 1 ? (sameDay[0]?.eventId ?? null) : null));
  }, [step, sameDay, events]);

  // The sign-in panel reads the whole address: keep the date and the services in it from the event step on.
  useEffect(() => {
    if (step !== 'event' || !day || typeof window === 'undefined') return;
    const href = checkDateResumeHref(shop.slug, day, chosen);
    if (`${window.location.pathname}${window.location.search}` !== href) window.history.replaceState(window.history.state, '', href);
  }, [step, day, chosen, shop.slug]);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const pick = (d: string) => {
    setDay(d);
    setNote(null);
    setSent(null);
    const open = services.filter((s) => serviceOpen(s.serviceId, d)).map((s) => s.serviceId);
    setChosen((cur) => {
      const kept = cur.filter((id) => open.includes(id));
      return kept.length > 0 ? kept : open.slice(0, 1);
    });
    setStep('day');
  };
  const close = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setStep(null);
    setDay(null);
    setNote(null);
  };

  const send = async () => {
    const [first, ...also] = chosen;
    if (!day || !eventId || !first) return;
    const svc = services.find((s) => s.serviceId === first);
    try {
      const res = await startServiceInquiry({
        vendorProfileId: shop.vendorProfileId,
        eventId,
        initialServiceId: first,
        initialCategoryKey: svc?.category ?? null,
        alsoServiceIds: also,
        requirements: { specialRequest: checkDateAskLine(day) },
        inquirySource,
        inquiryVia,
        inquiryUtm,
      });
      if (res.status === 'ok' || res.status === 'ok_build_not_sent') {
        setSent({ eventId: res.eventId, threadId: res.threadId });
        setStep('sent');
        return;
      }
      setStep('event');
      setNote(
        res.status === 'not_signed_in' || res.status === 'not_secured'
          ? 'Sign in to send this — your date and services are kept.'
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
    if (!eventId || chosen.length === 0) return;
    setNote(null);
    setStep('sending');
    const until = Date.now() + CHECK_DATE_UNDO_MS;
    setLeft(Math.ceil(CHECK_DATE_UNDO_MS / 1000));
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      const ms = until - Date.now();
      if (ms <= 0) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        void send();
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

  const eventWord = (e: CheckDateEvent) => `${e.name}${e.typeLabel ? ` · ${e.typeLabel}` : ''}`;
  const createHref = day
    ? `/dashboard/create-event?next=${encodeURIComponent(checkDateResumeHref(shop.slug, day, chosen))}`
    : '/dashboard/create-event';

  // 🎟 The day's services, the ones that can take it FIRST (SHOP-02 v7: shown as soon as a day is tapped).
  const dayServices = day
    ? [...services].sort((a, b) => Number(serviceOpen(b.serviceId, day)) - Number(serviceOpen(a.serviceId, day)))
    : services;

  return (
    <div className="flex w-full flex-col" data-check-date-shop={shop.slug}>
      <header className="flex items-center gap-2.5 border-b border-ink/10 px-4 py-3">
        <ActionButton tone="neutral" icon={X} label="Close" iconOnly onClick={onClose} className="flex-none" data-testid="check-date-close" />
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a 40px logo already resolved for the shop page above
          <img src={logoUrl} alt="" className="h-10 w-10 flex-none rounded-full object-cover" data-check-date-logo="" />
        ) : (
          <span aria-hidden className="grid h-10 w-10 flex-none place-items-center rounded-full bg-ink text-[15px] font-bold text-cream">
            {shop.initials}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold" data-check-date-name="">
            {shop.name}
          </p>
          {shop.verified ? <p className="text-[11px] font-bold text-[rgb(var(--color-ok))]">SETNAYAN Verified ✓</p> : null}
          {/* 🧪 A demo shop's date page is public too, marked (owner, DECISION_LOG 2026-11-06 "DEMO SHOPS + DEMO EVENTS"). */}
          {shop.isDemo ? <DemoOnlyMarker /> : null}
        </div>
      </header>

      <div className="px-4 pb-16 pt-3.5">
        <h1 className="text-[20px] font-semibold leading-tight">Check a date</h1>
        <p className="mb-3 text-[13px] text-ink/60">Tap a date to know if it is available.</p>
        <SeatMonths
          today={today}
          to={to}
          value={day}
          startAt={firstDay ?? today}
          stateOf={(d) => checkDateStateOf(d, { notBookable: closed, today, to })}
          onPick={pick}
        />
      </div>

      <Sheet open={step !== null && day !== null && state !== null} onClose={close} labelledById="check-date-sheet-title" rise>
        <div className="overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5" data-check-date-step={step ?? ''}>
          {step === 'day' && state === 'not_bookable' ? (
            <>
              <h2 id="check-date-sheet-title" className="pr-12 text-[17px] font-bold">
                {words}
              </h2>
              <span className="mb-2.5 mt-1 inline-block rounded-full bg-ink/[0.06] px-2.5 py-0.5 text-[12px] font-bold text-ink/60" data-check-date-state="not_bookable">
                {CHECK_DATE_WORDS.not_bookable}
              </span>
              <p className="text-[13px] text-ink/60">This day can&rsquo;t be booked. Try another date.</p>
              <div className="mt-3">
                <ActionButton tone="brand" main icon={CalendarX} label="Try another date" onClick={close} className={MAIN} data-testid="check-date-try-another" />
              </div>
            </>
          ) : step === 'day' ? (
            <>
              <h2 id="check-date-sheet-title" className="pr-12 text-[17px] font-bold">
                {words}
              </h2>
              <span className="mb-2.5 mt-1 inline-block rounded-full bg-[rgb(var(--color-ok)/0.12)] px-2.5 py-0.5 text-[12px] font-bold text-[rgb(var(--color-ok))]" data-check-date-state="available">
                {CHECK_DATE_WORDS.available}
              </span>
              {/* ✦ v16 `cadDaySheet`: a popular day (the shipped hot-date rule, `dayShines`) says so beside Available —
                  in the legend's own seat colours, and never instead of Available. */}
              {day && dayShines(day) ? (
                <span
                  className="mb-2.5 ml-1.5 mt-1 inline-block rounded-full bg-[var(--seat-top)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--seat-ink)] shadow-[inset_0_0_0_1.5px_var(--seat-hot-line)]"
                  data-check-date-popular=""
                >
                  ✦ {CHECK_DATE_POPULAR}
                </span>
              ) : null}
              {services.length === 0 ? (
                <p className="py-3 text-[14px] text-ink/70" data-check-date-no-services="">
                  This shop hasn&rsquo;t listed its services yet. Ask from the shop page.
                </p>
              ) : (
                <>
                  <p className="mb-1 text-[12.5px] font-bold text-ink/70">What {shop.name} can do that day</p>
                  <FormRows data="check-date-services">
                    {dayServices.map((s) => {
                      const open = serviceOpen(s.serviceId, day);
                      return (
                        <SwitchRow
                          key={s.serviceId}
                          name={s.label}
                          on={open && chosen.includes(s.serviceId)}
                          disabled={!open}
                          note={open ? s.price || undefined : 'Not bookable that day'}
                          onChange={(next) => setChosen((cur) => (next ? [...cur.filter((x) => x !== s.serviceId), s.serviceId] : cur.filter((x) => x !== s.serviceId)))}
                          attrs={{ 'data-check-date-service': s.serviceId, 'data-check-date-service-open': open ? '1' : '0' }}
                        />
                      );
                    })}
                  </FormRows>
                </>
              )}
              <div className="mt-3 grid gap-2.5">
                {services.length === 0 ? (
                  <ActionButton tone="neutral" icon={X} label="Back to the shop" onClick={onClose} className={MAIN} />
                ) : (
                  <ActionButton tone="brand" main icon={CalendarCheck} label="Ask about this date" onClick={() => setStep('event')} disabled={chosen.length === 0} className={MAIN} data-testid="check-date-ask" />
                )}
                <ActionButton tone="neutral" icon={CalendarX} label="Pick another day" onClick={close} className={MAIN} data-testid="check-date-pick-another" />
              </div>
            </>
          ) : step === 'event' ? (
            <>
              <h2 id="check-date-sheet-title" className="pr-12 text-[17px] font-bold">
                For which event?
              </h2>
              <p className="mb-2 text-[13px] text-ink/60">{words}</p>
              {!signedIn ? (
                <div data-check-date-sign-in="">
                  <p className="py-2 text-[14px] text-ink/75">Sign in to pick your event. Your picks are kept.</p>
                  {/* The shared sign-in door, worn as the button rule's main brand button (it must stay a real link). */}
                  <SignInHereLink href="/login" className={actionButtonClass('brand', { main: true, extra: MAIN })}>
                    <LogIn aria-hidden className="h-4 w-4" strokeWidth={2} />
                    <span className="lbl">Sign in</span>
                  </SignInHereLink>
                </div>
              ) : (
                <>
                  {sameDay.length > 0 || others.length > 0 ? (
                    <FormRows data="check-date-event">
                      <ChosenRow
                        name={sameDay.length > 0 ? 'Event' : 'Or one of yours'}
                        label="Your events"
                        value={eventId}
                        buttonText={eventId ? undefined : 'Pick'}
                        options={(sameDay.length > 0 ? sameDay : others).map((e) => ({ key: e.eventId, label: eventWord(e) }))}
                        onPick={(k) => setEventId(k)}
                        dataAttr="data-check-date-event"
                        attrs={sameDay.length === 1 && sameDay[0] ? { 'data-check-date-event-auto': sameDay[0].eventId } : { 'data-check-date-event-pick': '' }}
                      />
                    </FormRows>
                  ) : null}
                  {sameDay.length === 0 ? (
                    <div className="mt-2">
                      <ActionButton
                        tone={eventId ? 'neutral' : 'brand'}
                        main={!eventId}
                        icon={Plus}
                        label={`Start an event on ${words}`}
                        href={createHref}
                        className={MAIN}
                        data-testid="check-date-start-event"
                      />
                    </div>
                  ) : null}
                  {note ? (
                    <p role="status" className="mt-2 text-[13px] text-ink/70" data-check-date-note="">
                      {note}
                    </p>
                  ) : null}
                  <div className="mt-3">
                    <ActionButton tone="brand" main icon={Send} label="Send" onClick={hold} disabled={!eventId || chosen.length === 0} className={MAIN} data-testid="check-date-send" />
                  </div>
                </>
              )}
            </>
          ) : step === 'sending' ? (
            <>
              <h2 id="check-date-sheet-title" className="pr-12 text-[17px] font-bold" aria-live="polite">
                Sending in {left} s…
              </h2>
              <p className="mb-2 text-[13px] text-ink/60">
                To {shop.name} · {words}
              </p>
              <ActionButton tone="neutral" icon={Undo2} label="Undo" onClick={undo} className={MAIN} data-testid="check-date-undo" />
            </>
          ) : step === 'sent' ? (
            <>
              <h2 id="check-date-sheet-title" className="pr-12 text-[17px] font-bold" data-check-date-sent="">
                Sent ✓
              </h2>
              <p className="mb-2 text-[13px] text-ink/60">{shop.name} will reply in your chat.</p>
              <div className="grid gap-2.5">
                {sent ? (
                  <ActionButton tone="info" main icon={MessageCircle} label="Open the chat" href={`/dashboard/${sent.eventId}/messages/${sent.threadId}`} className={MAIN} data-testid="check-date-open-chat" />
                ) : null}
                <ActionButton tone="neutral" icon={Check} label="Done" onClick={close} className={MAIN} data-testid="check-date-done" />
              </div>
            </>
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}
