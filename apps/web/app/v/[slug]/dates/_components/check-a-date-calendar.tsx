'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CalendarCheck, CalendarX, Check, MessageCircle, Plus, Send, Store, Undo2 } from 'lucide-react';
import { CalendarGrid } from '@/app/_components/calendar';
import { Sheet } from '@/app/_components/sheet';
import { SignInHereLink } from '@/app/_components/auth/sign-in-here-link';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { CALENDAR_HATCH, type CalendarDayState } from '@/lib/calendar-grid';
import {
  CHECK_DATE_WORDS,
  checkDateAskLine,
  checkDateResumeHref,
  checkDateStateOf,
  checkDateWords,
} from '@/lib/check-a-date';
import { startServiceInquiry } from '@/app/v/[slug]/inquiry-actions';

/**
 * CHECK A DATE — the month and its one sheet (approved prototype `prototypes/check_a_date_2026-10-28/index.html`,
 * frames A · B · C · D). The month is the app's ONE grid (`CalendarGrid`, kind 31: a Not-bookable day is the hatched
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

export type CheckDateEvent = {
  eventId: string;
  name: string;
  typeLabel: string | null;
  eventType: string;
  date: string | null;
  endDate: string | null;
};

type Service = { serviceId: string; label: string; price: string; category: string | null };
type Step = 'day' | 'services' | 'event' | 'sending' | 'sent';

/** How long Send waits for an Undo (owner brief: "Undo (5 s)"). */
export const CHECK_DATE_UNDO_MS = 5000;

const MAIN = 'w-full justify-center !min-h-12';

export function CheckADateCalendar({
  shop,
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
  shop: { vendorProfileId: string; slug: string; name: string; initials: string; verified: boolean };
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
  const states = useMemo(() => {
    const m = new Map<string, CalendarDayState>();
    for (const d of notBookable) m.set(d, { blocked: true });
    return m;
  }, [notBookable]);

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

  return (
    <div className="mx-auto flex w-full max-w-md flex-col" data-check-date-shop={shop.slug}>
      <header className="flex items-center gap-2.5 border-b border-ink/10 px-4 pb-2.5 pt-3.5">
        <span aria-hidden className="grid h-10 w-10 flex-none place-items-center rounded-full bg-ink text-[15px] font-bold text-cream">
          {shop.initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold" data-check-date-name="">
            {shop.name}
          </p>
          {shop.verified ? <p className="text-[11px] font-bold text-[rgb(var(--color-ok))]">SETNAYAN Verified ✓</p> : null}
        </div>
      </header>

      <div className="px-4 pb-16 pt-3.5">
        <h1 className="text-[20px] font-semibold leading-tight">Check a date</h1>
        <p className="mb-3 text-[13px] text-ink/60">Tap a day to see if it can be booked.</p>
        <CalendarGrid value={day} states={states} today={today} min={today} max={to} startAt={firstDay ?? today} onPick={pick} data="check-a-date" />
        <p className="flex gap-4 px-0.5 pt-3 text-[12.5px] text-ink/65" data-check-date-legend="">
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden className="block h-3.5 w-3.5 rounded-full border border-ink/25" />
            {CHECK_DATE_WORDS.available}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden className="block h-3.5 w-3.5 rounded-[4px]" style={{ backgroundImage: CALENDAR_HATCH }} />
            {CHECK_DATE_WORDS.not_bookable}
          </span>
        </p>
        <div className="mt-4">
          <ActionButton tone="neutral" icon={Store} label="See the shop" href={`/v/${encodeURIComponent(shop.slug)}`} className={MAIN} data-testid="check-date-shop" />
        </div>
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
              <p className="text-[13px] text-ink/60">Ask the shop about this day. They reply in your chat.</p>
              <div className="mt-3 grid gap-2.5">
                <ActionButton tone="brand" main icon={CalendarCheck} label="Ask about this date" onClick={() => setStep('services')} className={MAIN} data-testid="check-date-ask" />
                <ActionButton tone="neutral" icon={CalendarX} label="Pick another day" onClick={close} className={MAIN} data-testid="check-date-pick-another" />
              </div>
            </>
          ) : step === 'services' ? (
            <>
              <h2 id="check-date-sheet-title" className="pr-12 text-[17px] font-bold">
                Which services?
              </h2>
              <p className="mb-2 text-[13px] text-ink/60">{words} · pick one or more</p>
              {services.length === 0 ? (
                <p className="py-3 text-[14px] text-ink/70" data-check-date-no-services="">
                  This shop hasn&rsquo;t listed its services yet. Ask from the shop page.
                </p>
              ) : (
                <div role="group" aria-label="Services">
                  {services.map((s) => {
                    const open = serviceOpen(s.serviceId, day);
                    const on = chosen.includes(s.serviceId);
                    return (
                      <label key={s.serviceId} className={`flex min-h-12 items-center gap-2.5 border-b border-ink/10 text-[14.5px] ${open ? 'cursor-pointer' : 'opacity-50'}`} data-check-date-service={s.serviceId}>
                        <input
                          type="checkbox"
                          className="h-5 w-5 flex-none accent-[rgb(var(--color-mulberry))]"
                          checked={on && open}
                          disabled={!open}
                          onChange={(e) => setChosen((cur) => (e.target.checked ? [...cur.filter((x) => x !== s.serviceId), s.serviceId] : cur.filter((x) => x !== s.serviceId)))}
                        />
                        <span className="min-w-0 flex-1">{s.label}</span>
                        <small className="flex-none text-[12.5px] text-ink/55">{open ? s.price : CHECK_DATE_WORDS.not_bookable}</small>
                      </label>
                    );
                  })}
                </div>
              )}
              <div className="mt-3">
                {services.length === 0 ? (
                  <ActionButton tone="neutral" icon={Store} label="See the shop" href={`/v/${encodeURIComponent(shop.slug)}`} className={MAIN} />
                ) : (
                  <ActionButton tone="brand" main icon={ArrowRight} label="Next" onClick={() => setStep('event')} disabled={chosen.length === 0} className={MAIN} data-testid="check-date-next" />
                )}
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
                  <p className="py-2 text-[14px] text-ink/75">Sign in to pick your event. Your date and services are kept.</p>
                  <SignInHereLink
                    href="/login"
                    className="sn-press mt-1 flex min-h-12 w-full items-center justify-center rounded-full bg-sn-accent px-5 text-[15px] font-bold text-sn-on-accent"
                  >
                    Sign in
                  </SignInHereLink>
                </div>
              ) : (
                <>
                  {sameDay.length === 1 && sameDay[0] ? (
                    <div className="flex min-h-12 items-center gap-2.5 border-b border-ink/10 text-[14.5px]" data-check-date-event-auto={sameDay[0].eventId}>
                      <Check aria-hidden className="h-5 w-5 flex-none text-sn-accent" strokeWidth={2.4} />
                      <span className="min-w-0 flex-1 truncate">{eventWord(sameDay[0])}</span>
                    </div>
                  ) : sameDay.length > 1 || others.length > 0 ? (
                    <div className="py-1" data-check-date-event-pick="">
                      <PickMenu
                        label={sameDay.length > 1 ? 'Your events that day' : 'Or one of your events'}
                        value={eventId}
                        buttonText={eventId ? undefined : 'Pick your event'}
                        options={(sameDay.length > 1 ? sameDay : others).map((e) => ({ key: e.eventId, label: eventWord(e) }))}
                        onPick={(k) => setEventId(k)}
                        dataAttr="data-check-date-event"
                        className="!min-h-12 w-full"
                      />
                    </div>
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
