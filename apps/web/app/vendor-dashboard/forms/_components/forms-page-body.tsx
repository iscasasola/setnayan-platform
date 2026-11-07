'use client';

import { useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, ClipboardList, FolderOpen, Plus } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { ThumbRow } from '@/components/thumb-row';
import { ActionButton } from '@/components/action-button';
import { SupplierThumbRow } from '@/app/vendor-dashboard/_components/supplier-thumb-row';
import { draftItemOf, usedWithLine, type FormDraft } from '@/lib/vendor-forms';
import type { EventFormsRead, ShopForm, SuggestionsRead } from '@/lib/vendor-forms.server';
import { formsAction } from '../actions';
import { FormMaker, type FormMakerCard, type FormMakerLocks } from './form-maker';

type EventForms = Extract<EventFormsRead, { status: 'ok' }>;
type Suggestions = Extract<SuggestionsRead, { status: 'ok' }>;

const H2 = 'text-[17px] font-semibold text-ink';
const ROW =
  'flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-ink/[0.04] px-3.5 py-2.5 text-left';

/**
 * 📋 The Forms page's own parts (THE ONE BUILD · C3, v113 `page=forms`), under the shipped "Questions for the couple":
 * forms sent to this couple · the library · the forms added from the cards they booked · the thumb row (Load a form ·
 * ＋ New form) · the Forms Maker sheet · the Form Maker. Also mounted with no event (a shop's library on its own).
 *
 * Honest states: `null` data = the read was refused → "couldn't load", never "no forms yet".
 */
export function FormsPageBody({
  eventId,
  coupleName,
  canSend,
  returnPath,
  library,
  cards,
  event,
  bookedUnread,
  suggestions,
  locks,
  answersOpen,
}: {
  eventId: string | null;
  coupleName: string;
  canSend: boolean;
  returnPath: string;
  library: ShopForm[] | null;
  cards: FormMakerCard[];
  event: EventForms | null;
  bookedUnread: boolean;
  suggestions: Suggestions | null;
  locks: FormMakerLocks;
  answersOpen: boolean;
}) {
  const router = useRouter();
  const loadTitle = useId();
  const [maker, setMaker] = useState<{ open: boolean; draft: FormDraft | null }>({ open: false, draft: null });
  const [loadOpen, setLoadOpen] = useState(false);
  const [openSent, setOpenSent] = useState<string | null>(null);
  const [using, startUse] = useTransition();
  const [said, setSaid] = useState<string | null>(null);

  const edit = (f: ShopForm) =>
    setMaker({ open: true, draft: { formId: f.formId, title: f.title, items: f.items.map(draftItemOf), serviceIds: f.serviceIds } });
  const fresh = () => setMaker({ open: true, draft: null });
  const useSuggestion = (templateKey: string) =>
    startUse(async () => {
      const fd = new FormData();
      fd.set('op', 'use');
      fd.set('template_key', templateKey);
      fd.set('return_path', returnPath);
      const r = await formsAction({ status: 'idle' }, fd);
      setSaid(r.status === 'error' ? r.message : r.status === 'saved' ? r.message : null);
      router.refresh();
    });

  return (
    <div className="space-y-8" data-forms-body>
      {eventId ? (
        <section className="space-y-3" aria-labelledby="forms-sent-h">
          <h2 id="forms-sent-h" className={H2}>
            Forms sent to {coupleName}
          </h2>
          {event === null ? (
            <Unread what="the forms you sent" />
          ) : event.sent.length === 0 ? (
            <p className="text-sm text-ink/60">None yet. Load a form and send it to the chat — they answer in their event.</p>
          ) : (
            <ul className="space-y-2" data-forms-sent>
              {event.sent.map((s) => (
                <li key={s.formId}>
                  <button type="button" className={ROW} aria-expanded={openSent === s.formId} onClick={() => setOpenSent((k) => (k === s.formId ? null : s.formId))}>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium text-ink">{s.title}</span>
                      <span className="block text-[12px] text-ink/60">
                        {s.sentBy === 'on_booking' ? 'Sent on booking' : 'Sent'} · {formatDay(s.sentAt)}
                      </span>
                    </span>
                    <span
                      className={`flex-none rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                        s.total > 0 && s.answered === s.total ? 'bg-success-100 text-success-800' : 'bg-warn-100 text-warn-900'
                      }`}
                    >
                      {s.total === 0 ? 'No questions' : `${s.answered} of ${s.total} answered`}
                    </span>
                  </button>
                  {openSent === s.formId ? (
                    <div className="mt-1 space-y-2 rounded-xl bg-ink/[0.03] px-3.5 py-3" data-forms-answers={s.formId}>
                      {!answersOpen ? (
                        <p className="text-sm text-ink/70">Their answers open with the event, once the booking fee is settled.</p>
                      ) : (
                        s.items
                          .filter((i) => i.item_kind === 'question')
                          .map((i) => (
                            <div key={i.question_id}>
                              <p className="text-[13px] font-medium text-ink">{i.prompt}</p>
                              <p className={`text-[14px] ${s.answers[i.question_id] ? 'text-ink/80' : 'text-ink/50'}`}>
                                {s.answers[i.question_id] ?? 'Not answered yet.'}
                              </p>
                            </div>
                          ))
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="forms-lib-h">
        <h2 id="forms-lib-h" className={H2}>
          Your forms · the library
        </h2>
        <p className="text-sm text-ink/70">Every form is open to every service. Make it once, send it to any couple; they answer in their event.</p>
        {library === null ? (
          <Unread what="your forms" />
        ) : library.length === 0 ? (
          <p className="text-sm text-ink/60">No forms yet. Tap ＋ New form to make your first.</p>
        ) : (
          <ul className="space-y-2" data-forms-library>
            {library.map((f) => (
              <li key={f.formId}>
                <button type="button" className={ROW} onClick={() => edit(f)}>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium text-ink">{f.title}</span>
                    <span className="block text-[12px] text-ink/60">
                      {f.sizeLine} · {usedWithLine(f.usedWith)}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 flex-none text-ink/40" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {eventId ? (
        <section className="space-y-3" aria-labelledby="forms-booked-h">
          <h2 id="forms-booked-h" className={H2}>
            Added from the service cards they booked
          </h2>
          {bookedUnread || event === null ? (
            <Unread what="the cards they booked" />
          ) : event.linkedToBooked.length === 0 ? (
            <p className="text-sm text-ink/60">No form is linked to a card they booked. Link one in the Form Maker — it is sent by itself when they book.</p>
          ) : (
            <ul className="space-y-2" data-forms-booked>
              {event.linkedToBooked.map((l) => (
                <li key={l.formId} className={ROW}>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium text-ink">{l.cardTitles.join(' · ')}</span>
                    <span className="block text-[12px] text-ink/60">Its card’s form · {l.title}</span>
                  </span>
                  <span className={`flex-none rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${l.sent ? 'bg-success-100 text-success-800' : 'bg-ink/[0.06] text-ink/70'}`}>
                    {l.sent ? 'Attached' : 'Sends on booking'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {said ? (
        <p role="status" className="text-sm text-ink/70">
          {said}
        </p>
      ) : null}

      <SupplierThumbRow
        name="client-forms"
        label="Form tools"
        row={
          <ThumbRow
            name="client-forms"
            right={[{ icon: FolderOpen, label: 'Load a form', onClick: () => setLoadOpen(true), testId: 'forms-load' }]}
            action={{ icon: Plus, label: '＋ New form', onClick: fresh, testId: 'forms-new' }}
          />
        }
      />

      <Sheet open={loadOpen} onClose={() => setLoadOpen(false)} labelledById={loadTitle} rise page>
        <div className="space-y-5 px-1 pb-4" data-forms-load>
          <h2 id={loadTitle} className="text-[19px] font-semibold text-ink">
            Forms Maker
          </h2>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/60">Your forms · saved to your library</p>
            {library === null ? (
              <Unread what="your forms" />
            ) : library.length === 0 ? (
              <p className="text-sm text-ink/60">No forms yet.</p>
            ) : (
              library.map((f) => (
                <button
                  key={f.formId}
                  type="button"
                  className={ROW}
                  onClick={() => {
                    setLoadOpen(false);
                    edit(f);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium text-ink">{f.title}</span>
                    <span className="block text-[12px] text-ink/60">
                      {f.sizeLine} · {usedWithLine(f.usedWith)}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 flex-none text-ink/40" aria-hidden />
                </button>
              ))
            )}
          </div>
          <SuggestionList
            heading={`Suggested for ${suggestions?.serviceLabel ?? 'your service'}`}
            items={suggestions?.own ?? null}
            emptyLine="No suggested forms for this service yet"
            onUse={useSuggestion}
            busy={using}
          />
          {suggestions && suggestions.alsoUseful.length > 0 ? (
            <SuggestionList
              heading={`Also useful for ${suggestions.groupLabel ?? 'your service'}`}
              items={suggestions.alsoUseful}
              emptyLine=""
              onUse={useSuggestion}
              busy={using}
            />
          ) : null}
          <p className="text-[13px] text-ink/60">Every form is open to every service. A form is sent to the couple from the chat; they answer in their event.</p>
          <ActionButton
            tone="brand"
            main
            icon={Plus}
            label="New form"
            className="w-full"
            onClick={() => {
              setLoadOpen(false);
              fresh();
            }}
          />
        </div>
      </Sheet>

      <FormMaker
        open={maker.open}
        onClose={() => {
          setMaker((m) => ({ ...m, open: false }));
          router.refresh();
        }}
        initial={maker.draft}
        cards={cards}
        locks={locks}
        eventId={eventId && canSend ? eventId : null}
        returnPath={returnPath}
      />
    </div>
  );
}

function SuggestionList({
  heading,
  items,
  emptyLine,
  onUse,
  busy,
}: {
  heading: string;
  items: { templateKey: string; title: string; itemCount: number }[] | null;
  emptyLine: string;
  onUse: (key: string) => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-2" data-forms-suggested>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/60">{heading}</p>
      {items === null ? (
        <Unread what="the suggestions" />
      ) : items.length === 0 ? (
        <p className="text-sm text-ink/60">{emptyLine}</p>
      ) : (
        items.map((s) => (
          <div key={s.templateKey} className={ROW}>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-medium text-ink">{s.title}</span>
              <span className="block text-[12px] text-ink/60">
                {s.itemCount} question{s.itemCount === 1 ? '' : 's'}
              </span>
            </span>
            <button
              type="button"
              disabled={busy}
              className="min-h-11 flex-none px-2 text-[14px] font-semibold text-sn-accent disabled:opacity-50"
              onClick={() => onUse(s.templateKey)}
            >
              Use this
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function Unread({ what }: { what: string }) {
  return (
    <p role="alert" className="text-sm text-ink/70">
      <ClipboardList className="mr-1 inline h-4 w-4 align-[-2px] text-ink/50" aria-hidden />
      We couldn’t load {what}. Reload in a moment — nothing was lost.
    </p>
  );
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PH', { day: 'numeric', month: 'short', timeZone: 'Asia/Manila' });
}
