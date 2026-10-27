'use client';

import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { createClient } from '@/lib/supabase/client';
import { askOutcome, cleanAskLabel, type AskOutcome } from '@/lib/event-type-requests';

/**
 * ➕ "CAN'T FIND YOURS? ASK US TO ADD IT" — the grid's last row (owner 2026-10-28, DECISION_LOG "EVENT TYPES MUST BE
 * SPECIFIC"; prototype who_is_it_for_2026-10-28 frames B–D). Every event type is specific because it decides which
 * suppliers cover the event, so a missing one is ASKED for — never typed in as "Other".
 *
 * The sheet takes one name and writes ONE row to `event_type_requests` with the person's own session: RLS lets them
 * insert only their own open, untyped ask (migration 20271294233183) — +0 server actions. It lands in Admin › Event
 * types; when that type is in the picker they are told in the app (`event_type_added`). No email (owner 2026-10-11).
 * The sheet never navigates: the grid behind it stays exactly where it was, so they start with the closest type.
 */
export function AskForEventType() {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [outcome, setOutcome] = useState<AskOutcome | null>(null);
  const [sending, setSending] = useState(false);
  const headingId = useId();

  async function send() {
    const clean = cleanAskLabel(label);
    if (!clean) {
      setOutcome('too_short');
      return;
    }
    setSending(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setOutcome('signed_out');
        return;
      }
      const { error } = await supabase.from('event_type_requests').insert({ user_id: user.id, label: clean });
      setOutcome(askOutcome(error));
    } catch {
      setOutcome('failed');
    } finally {
      setSending(false);
    }
  }

  const sent = outcome === 'sent' || outcome === 'already';

  return (
    <>
      <button
        type="button"
        data-ask-event-type=""
        onClick={() => {
          setOutcome(null);
          setOpen(true);
        }}
        className="sn-press sn-press-ring mt-4 flex min-h-11 w-full items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-ink/15 px-4 py-3 text-left transition-colors hover:border-gold/40"
      >
        <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink/[0.06] text-terracotta">
          <Plus className="h-5 w-5" strokeWidth={2} />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold text-ink">Can’t find yours? Ask us to add it</span>
          <span className="block text-[13px] text-ink/60">We add it with the right suppliers</span>
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} labelledById={headingId} rise>
        <div className="space-y-3 px-5 pb-4 pt-5" data-ask-sheet="">
          <h2 id={headingId} className="pr-12 text-lg font-semibold text-ink">
            What’s your event?
          </h2>
          {sent ? (
            <p role="status" className="text-sm text-ink/75" data-ask-sent="">
              {outcome === 'already'
                ? 'You already asked for that one — we’ll tell you here when it’s added.'
                : 'Sent. We’ll tell you here when it’s added — meanwhile, start with the closest type.'}
            </p>
          ) : (
            <>
              <p className="text-sm text-ink/65">
                Tell us the kind of event. We’ll add it with the suppliers it needs and let you know here.
              </p>
              <input
                aria-label="The kind of event"
                autoComplete="off"
                className="input-field"
                maxLength={80}
                name="ask_event_type"
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Alumni homecoming"
                type="text"
                value={label}
              />
              <p className="text-[13px] text-ink/60">
                Meanwhile, start with the closest type — you can switch once yours is added.
              </p>
              {outcome ? (
                <p role="alert" className="text-sm text-terracotta-700">
                  {outcome === 'too_short'
                    ? 'Type the kind of event first.'
                    : outcome === 'signed_out'
                      ? 'Sign in again to send this.'
                      : 'We couldn’t send that. Please try again.'}
                </p>
              ) : null}
            </>
          )}
          <button
            type="button"
            disabled={sending}
            onClick={sent ? () => setOpen(false) : send}
            className="button-primary min-h-12 w-full"
          >
            {sent ? 'Done' : sending ? 'Sending…' : 'Send to Setnayan'}
          </button>
        </div>
      </Sheet>
    </>
  );
}
