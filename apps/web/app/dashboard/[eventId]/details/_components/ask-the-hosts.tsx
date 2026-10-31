'use client';

import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, KeyRound, Send } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { usePortalHost } from '@/lib/use-portal-host';
import { AREA_LEVEL_WORD, type DelegateArea } from '@/lib/delegate-areas';
import { ASK_HOSTS_LINE, ASK_HOSTS_TIP, askRefusalWords, askableParts, askedTimeLabel, type AreaCell } from '@/lib/people-with-access';

/**
 * ask-the-hosts.tsx — 🪪 ASK THE HOSTS, the one press in a helper's "Your access" besides its ⓘ (owner 2026-10-31, "yes"
 * to building it; DECISION_LOG "A HELPER SEES THEIR OWN ACCESS AS THE FIRST ROW OF HOME ⚙ EVENT SETTINGS — read-only,
 * with 'Ask the hosts'").
 *
 * The press opens the house `Sheet` (its `OverlayBackdrop`, Esc, focus trap and the phone's Back are the sheet's own):
 * which part — a `PickMenu` of the parts they hold less than the hosts could give (`askableParts`) — an optional line
 * ("What do you need?"), then Send. Send calls the database's ONE door, `ask_hosts_for_more_access`, which checks the
 * caller's own accepted seat (a limited helper included — asking is not editing), refuses a second ask for the same
 * part within a day, and writes one in-app notice to every host. Nothing is granted by asking, and nothing is emailed.
 *
 * 🔑 No server action of its own: the action budget is at its ceiling (`lint-server-action-budget.mjs`), and the
 * database already is the door — a definer granted to `authenticated` that reads `auth.uid()`, called with the ONE
 * browser client (`@/lib/supabase/client`, loaded at Send), as `mark-group-read.tsx` calls its own.
 *
 * A SAVE NEVER RESETS THE SCREEN: after Send the sheet closes in place and the button reads "Asked · <time>"; the
 * settings sheet behind it is untouched. A refusal is said in the sheet, in words, and nothing changes.
 */
export function AskTheHosts({
  eventId,
  areas,
  askedAt: firstAskedAt = null,
}: {
  eventId: string;
  /** The helper's own cells (`ownAccessOf` → `areaCells`) — the same ones "Your access" draws. */
  areas: readonly AreaCell[];
  /** When their last ask went (the Home lab's fixture) — absent: none yet this visit. */
  askedAt?: string | null;
}) {
  const parts = askableParts(areas);
  const titleId = useId();
  const host = usePortalHost();
  const [open, setOpen] = useState(false);
  const [part, setPart] = useState<DelegateArea | null>(parts[0]?.area ?? null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [askedAt, setAskedAt] = useState<string | null>(firstAskedAt);
  // Nothing they could be given more of — there is nothing to ask.
  if (parts.length === 0) return null;

  const options: PickOption[] = parts.map((c) => ({
    key: c.area,
    label: c.label,
    trail: { text: AREA_LEVEL_WORD[c.choice], tone: 'muted', label: `You have ${AREA_LEVEL_WORD[c.choice]} now` },
  }));
  const partLabel = parts.find((c) => c.area === part)?.label ?? null;

  const send = async () => {
    if (!part || sending) return;
    setSending(true);
    setRefusal(null);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const { data, error } = await createClient().rpc('ask_hosts_for_more_access', {
        p_event_id: eventId,
        p_area: part,
        p_note: note.trim() ? note.trim().slice(0, 140) : null,
      });
      if (error) {
        console.error('[supabase-error] ask_hosts_for_more_access', error);
        setRefusal(askRefusalWords(null));
        return;
      }
      const r = (data ?? {}) as { status?: string; asked_at?: string };
      if (r.status === 'ok' && r.asked_at) {
        setAskedAt(r.asked_at);
        setNote('');
        setOpen(false);
        return;
      }
      if (r.status === 'already_asked' && r.asked_at) setAskedAt(r.asked_at);
      setRefusal(askRefusalWords(r.status, partLabel));
    } catch (e) {
      console.error('[ask-the-hosts] could not send:', e instanceof Error ? e.message : e);
      setRefusal(askRefusalWords(null));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <ActionButton
        tone="neutral"
        icon={askedAt ? Check : KeyRound}
        label={askedAt ? `Asked · ${askedTimeLabel(askedAt)}` : 'Ask the hosts'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setRefusal(null);
          setOpen(true);
        }}
        data-testid="ask-the-hosts"
      />
      {open && host
        ? createPortal(
            <Sheet open onClose={() => setOpen(false)} labelledById={titleId} rise>
              <div className="px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-5" data-ask-the-hosts-sheet="">
                <h2 id={titleId} className="pr-10 text-[20px] font-semibold tracking-[-0.01em] text-ink">
                  Ask the hosts
                </h2>
                <p className="mt-1 text-[13px] text-ink/65">
                  <InfoTip label={ASK_HOSTS_LINE} align="start">
                    {ASK_HOSTS_TIP}
                  </InfoTip>
                </p>
                <div className="mt-4 flex flex-col gap-4 border-t border-ink/10 pt-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[13px] text-ink/60">More on</span>
                    <PickMenu
                      label="Which part you want more on"
                      value={part}
                      options={options}
                      onPick={(k) => setPart(k as DelegateArea)}
                      dataAttr="data-ask-the-hosts-part"
                    />
                  </div>
                  <label className="flex flex-col gap-1.5 text-[13px] text-ink/60">
                    What do you need? (optional)
                    <input
                      type="text"
                      value={note}
                      maxLength={140}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. I’m doing the seat plan with them"
                      enterKeyHint="send"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void send();
                        }
                      }}
                      className="min-h-11 w-full rounded-md border border-ink/15 bg-cream px-3 py-2 text-[15px] text-ink placeholder:text-ink/45 focus:border-ink/40 focus:outline-none"
                      data-ask-the-hosts-note=""
                    />
                  </label>
                  {refusal ? (
                    <p role="alert" className="text-[13px] text-terracotta-700" data-ask-the-hosts-refused="">
                      {refusal}
                    </p>
                  ) : null}
                  <ActionButton
                    tone="brand"
                    main
                    icon={Send}
                    label={sending ? 'Sending…' : 'Send'}
                    waiting={sending}
                    disabled={!part || sending}
                    onClick={() => void send()}
                    className="w-full"
                    data-testid="ask-the-hosts-send"
                  />
                </div>
              </div>
            </Sheet>,
            host,
          )
        : null}
    </>
  );
}
