'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import type { MarchOption } from '@/lib/march-moves';
import type { MarchResult } from '@/lib/march-result';
import { setEntourageLineOrder } from '../../guests/entourage-order-actions';
import { joinEntourageLine, swapEntouragePlaces } from '../../guests/march-actions';
import { unpairGuestAction } from '../../guests/pair-actions';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { HubSavesImmediately } from '../../website/_components/hub-draft-field';
import { DetailsPieceButton, useDetailsPiece } from './details-go';

/**
 * THE MARCH, IN THE MAKER'S THREE PARTS (owner 2026-09-29, DECISION_LOG "A TOOL
 * MOVED INTO THE MAKER IS REBUILT INTO THE THREE PARTS" + "THE WEDDING MARCH
 * ON THE INVITATION TELLS EACH ENTOURAGE MEMBER THEIR ROLE…"):
 *
 *   LEFT    the sections and their lines, in walking order (`MarchPieces`);
 *   MIDDLE  the aisle, the picked line or section in focus (`MarchAisleFocus`);
 *   RIGHT   the picked line's controls — move it earlier or later, who walks
 *           beside whom — or, for a picked section, the Guest list's own
 *           walking-order panel for that section (`MarchControls`).
 *
 * 🔑 +0 WRITERS, ONE ORDER. Every move is a shipped march action
 * (`setEntourageLineOrder` · `swapEntouragePlaces` · `joinEntourageLine`) and
 * every option is the rule the server asks again (`lib/march-moves.ts`,
 * computed on the server and handed in). The lines are `buildEntourage`'s —
 * the order the invitation and The Entourage card print.
 */

export type MarchSlotData =
  | { kind: 'name'; id: string; name: string; role: string | null; swapWith: MarchOption[] }
  | { kind: 'empty'; anchorId: string; anchorName: string; joiners: MarchOption[] };

export type MarchLineData = {
  leadId: string;
  /** "Ramon Casasola and Lita Reyes". */
  label: string;
  /** Its step in the whole march, 1-based. */
  step: number;
  slots: [MarchSlotData, MarchSlotData];
  /* ⚖ No couple state here (owner 2026-10-01, "A WALK AND A COUPLE ARE
     INDEPENDENT"): the march sets only who walks together and in what order. */
};

export type MarchSectionData = { key: string; label: string; lines: MarchLineData[] };

const SECTION = 'section:';

/** The picked piece: a line's lead id, or `section:<key>`; the first section when none. */
function usePick(sections: readonly MarchSectionData[]): [string | null, (v: string | null) => void] {
  const first = sections[0] ? `${SECTION}${sections[0].key}` : null;
  // Part 3's ONE piece mechanism (`details-go.tsx`), under the item's own key.
  const [pick, setPick] = useDetailsPiece('march');
  const known =
    pick !== null &&
    sections.some((s) => `${SECTION}${s.key}` === pick || s.lines.some((l) => l.leadId === pick));
  return [known ? pick : first, (v) => setPick(v, { openEditor: true })];
}

/** LEFT — the sections and their lines, as part 3's navigator pieces. */
export function MarchPieces({ sections }: { sections: readonly MarchSectionData[] }) {
  const [pick, setPick] = usePick(sections);
  return (
    <>
      {sections.map((s) => (
        <div key={s.key} className="contents" data-march-piece-section={s.key}>
          <p className="hidden px-1 pb-0.5 pt-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/50 lg:block">{s.label}</p>
          <DetailsPieceButton on={pick === `${SECTION}${s.key}`} onPick={() => setPick(`${SECTION}${s.key}`)} data={`${SECTION}${s.key}`}>
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{s.label}</span>
              <small className="truncate text-[11px] opacity-70">
                {s.lines.length} line{s.lines.length === 1 ? '' : 's'} · the whole section
              </small>
            </span>
          </DetailsPieceButton>
          {s.lines.map((l) => (
            <DetailsPieceButton key={l.leadId} on={pick === l.leadId} onPick={() => setPick(l.leadId)} data={l.leadId}>
              <span className="w-5 shrink-0 text-right font-mono text-[11px] opacity-60">{l.step}</span>
              <span className="truncate">{l.label}</span>
            </DetailsPieceButton>
          ))}
        </div>
      ))}
    </>
  );
}

/** MIDDLE — the aisle, top to bottom; the picked line (or section) in focus. */
export function MarchAisleFocus({ sections }: { sections: readonly MarchSectionData[] }) {
  const [pick, setPick] = usePick(sections);
  const ref = useRef<HTMLOListElement>(null);
  /* Bring the picked line into view — inside the aisle only, never the page. */
  useEffect(() => {
    const box = ref.current;
    const el = box?.querySelector<HTMLElement>('[data-march-focus="on"]');
    if (!box || !el) return;
    if (el.offsetTop < box.scrollTop || el.offsetTop > box.scrollTop + box.clientHeight - el.clientHeight) {
      box.scrollTop = Math.max(0, el.offsetTop - 40);
    }
  }, [pick]);
  if (sections.length === 0) return null;
  return (
    <figure className="m-0 w-full max-w-sm" data-march-aisle="">
      <ol ref={ref} className="relative flex max-h-[60dvh] flex-col gap-1.5 overflow-y-auto border-x-2 border-dashed border-gild/50 px-3 py-2">
        {sections.map((s) => {
          const sectionOn = pick === `${SECTION}${s.key}`;
          return (
            <li key={s.key} className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setPick(`${SECTION}${s.key}`)}
                className={`min-h-9 rounded-md pt-2 text-center font-mono text-[10px] uppercase tracking-[0.18em] ${sectionOn ? 'text-ink' : 'text-ink/50'}`}
              >
                {s.label}
              </button>
              {s.lines.map((l) => {
                const on = pick === l.leadId || sectionOn;
                return (
                  <button
                    key={l.leadId}
                    type="button"
                    onClick={() => setPick(l.leadId)}
                    data-march-focus={pick === l.leadId ? 'on' : undefined}
                    aria-pressed={pick === l.leadId}
                    className={`flex min-h-11 items-baseline gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-opacity ${
                      pick === l.leadId ? 'bg-white ring-2 ring-ink' : 'bg-white/80'
                    } ${on ? '' : 'opacity-55'}`}
                  >
                    <span className="w-6 shrink-0 text-right font-mono text-[11px] text-ink/45">{l.step}</span>
                    <span className="min-w-0 flex-1 text-ink">{l.label}</span>
                  </button>
                );
              })}
            </li>
          );
        })}
      </ol>
      <figcaption className="mt-1.5 text-center text-xs text-ink/55">The aisle, in walking order — tap a line</figcaption>
    </figure>
  );
}

/** RIGHT — the picked line's controls, or the picked section's own panel. */
export function MarchControls({
  eventId,
  sections,
  sectionPanel,
}: {
  eventId: string;
  sections: readonly MarchSectionData[];
  /** The Guest list's walking-order panel (every section; this shows the picked one). */
  sectionPanel: ReactNode;
}) {
  const [pick] = usePick(sections);
  const [pending, start] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  if (!pick) return null;

  if (pick.startsWith(SECTION)) {
    const key = pick.slice(SECTION.length);
    return (
      <section data-march-section-controls={key} className="flex flex-col gap-2">
        <HubSavesImmediately />
        {/* The shipped panel, one section showing: its arrows, its swaps, its
            section moves and its Reset — the same island the Guest list used. */}
        <div data-march-only={key}>
          {sectionPanel}
          <style>{`[data-march-only="${key}"] [data-march-section]:not([data-march-section="${key}"]){display:none}`}</style>
        </div>
      </section>
    );
  }

  const section = sections.find((s) => s.lines.some((l) => l.leadId === pick))!;
  const at = section.lines.findIndex((l) => l.leadId === pick);
  const line = section.lines[at]!;

  const run = (send: () => Promise<MarchResult>) => {
    setProblem(null);
    start(async () => {
      try {
        const r = await makerSave(send, requestMakerRefresh);
        if (!r.ok) setProblem(r.reason);
      } catch {
        setProblem('That did not go through — nothing was changed.');
      }
    });
  };
  /* "Leave the other side blank" — the Guest list's own unpair, in place: the
     pair becomes two lines, each with its other side blank (owner: "a blank
     stays blank"). */
  const pairIds = line.slots.flatMap((sl) => (sl.kind === 'name' && sl.id ? [sl.id] : []));
  const leaveBlank = () => {
    setProblem(null);
    start(async () => {
      try {
        await makerSave(async () => {
          await unpairGuestAction(eventId, pairIds[0]!, 'in-place');
          return { ok: true as const };
        }, requestMakerRefresh);
      } catch (e) {
        setProblem(e instanceof Error ? e.message : 'That did not go through — nothing was changed.');
      }
    });
  };
  const move = (delta: -1 | 1) => {
    const order = section.lines.map((l) => l.leadId);
    const to = at + delta;
    if (to < 0 || to >= order.length) return;
    order.splice(to, 0, order.splice(at, 1)[0]!);
    run(() => setEntourageLineOrder(eventId, section.key, order));
  };

  return (
    <section data-march-line-controls={line.leadId} className="flex flex-col gap-3">
      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/55">
          {section.label} · step {line.step}
        </p>
        <p className="font-serif text-lg text-ink">{line.label}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || at === 0}
          onClick={() => move(-1)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-ink/15 bg-white px-3 text-sm font-medium text-ink disabled:opacity-40"
        >
          <ArrowUp aria-hidden className="h-4 w-4" strokeWidth={2} />
          Walk earlier
        </button>
        <button
          type="button"
          disabled={pending || at === section.lines.length - 1}
          onClick={() => move(1)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-ink/15 bg-white px-3 text-sm font-medium text-ink disabled:opacity-40"
        >
          <ArrowDown aria-hidden className="h-4 w-4" strokeWidth={2} />
          Walk later
        </button>
      </div>
      {line.slots.map((slot, i) => (
        <div key={i} className="flex flex-col gap-1.5" data-march-slot={slot.kind}>
          {slot.kind === 'name' ? (
            <>
              <p className="text-sm text-ink">
                {slot.name}
                {slot.role ? <span className="text-ink/55"> · {slot.role}</span> : null}
              </p>
              {slot.swapWith.length ? (
                <PickMenu
                  label="Trade places with…"
                  value={null}
                  dataAttr="data-march-swap"
                  options={slot.swapWith.map((o) => ({ key: o.id, label: o.note ? `${o.name} — ${o.note}` : o.name }))}
                  onPick={(id) => run(() => swapEntouragePlaces(eventId, section.key, slot.id, id))}
                />
              ) : null}
            </>
          ) : (
            <>
              <p className="text-sm italic text-ink/45">Left blank beside {slot.anchorName}</p>
              {slot.joiners.length ? (
                <PickMenu
                  label="Walks with…"
                  value={null}
                  dataAttr="data-march-join"
                  options={slot.joiners.map((o) => ({ key: o.id, label: o.note ? `${o.name} — ${o.note}` : o.name }))}
                  onPick={(id) => run(() => joinEntourageLine(eventId, section.key, slot.anchorId, id))}
                />
              ) : (
                <p className="text-xs text-ink/55">Nobody else in this section can walk here.</p>
              )}
            </>
          )}
        </div>
      ))}
      {pairIds.length === 2 ? (
        <button
          type="button"
          className="inline-flex min-h-11 w-fit items-center rounded-xl border border-ink/15 bg-white px-3 text-sm font-medium text-ink disabled:opacity-40"
          disabled={pending}
          onClick={leaveBlank}
          data-march-leave-blank=""
        >
          Leave the other side blank
        </button>
      ) : null}
      {problem ? (
        <p role="status" className="rounded-md border border-danger-200 bg-danger-50/70 px-2 py-1.5 text-xs text-danger-900">
          {problem}
        </p>
      ) : null}
      <HubSavesImmediately />
    </section>
  );
}
