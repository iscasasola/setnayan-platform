'use client';

/**
 * hub-parts-switches.tsx — THE PARTS OF THE PAGE, A SWITCH EACH (owner 2026-10-23, approved
 * `prototypes/home_service_widgets_2026-10-23.html` frame 2: *"on home, we can pick what part of event hub will be
 * active. and if it is on or off?"*).
 *
 * The rows are "What guests see" (`lib/guests-see-table.ts`) for ONE page at a time — the page guests see now, or
 * another picked from the one dropdown. A tap is the table's own tap (`guestsSeeToggle`) and is written exactly as the
 * Maker writes it: `stage_show` into the Event Hub DRAFT through `hubDraftAction` (`guestsSeePatch`). Guests see
 * nothing until Apply — the shipped Apply bar sits under these rows and counts the change. A row that cannot be on
 * that page is not drawn; a row that is always shown says so and has no switch.
 */

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { hubDraftAction } from '../../website/hub-draft-actions';
import { HUB_DRAFT_BAR_FIELD, makerSave } from '@/lib/maker-refresh';
import {
  GUESTS_SEE_COLUMNS,
  guestsSeeOn,
  guestsSeePatch,
  guestsSeeToggle,
  type GuestsSeeTable,
  type GuestsSeeWrites,
} from '@/lib/guests-see-table';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import { HomeCardRow } from '../home-service-card';

/** The columns a couple picks a page from — the four pages (the RSVP reply screens draw no scene yet). */
const PAGES = GUESTS_SEE_COLUMNS.map((c, col) => ({ ...c, col })).filter((c) => c.stage !== null);

export function HubPartsSwitches({ eventId, table, now }: { eventId: string; table: GuestsSeeTable; now: LifecyclePhase | null }) {
  const router = useRouter();
  const [col, setCol] = useState<number>(() => PAGES.find((p) => p.stage === now)?.col ?? PAGES.find((p) => p.stage === 'rsvp')!.col);
  /* The taps already sent, laid over the table until the refreshed one arrives — so a switch moves at once. */
  const [sent, setSent] = useState<GuestsSeeWrites>({});
  const [line, setLine] = useState<string | null>(null);
  const [saving, start] = useTransition();
  // A fresh table from the server already holds what was sent.
  useEffect(() => setSent({}), [table]);

  const rows = table.groups.flatMap((g) => g.rows).filter((r) => r.cells[col]?.kind !== 'dash');

  const tap = (rowKey: string) => {
    const t = guestsSeeToggle(table, sent, rowKey, col);
    setLine(t.line);
    if (!t.changed) return;
    // ONLY THE CELL THIS TAP CHANGED is sent (review 2026-10-24) — never the taps before it again, so a step back of an
    // earlier one cannot be undone by a later save.
    const id = Object.keys(t.writes).find((k) => !(k in sent) || t.writes[k] !== sent[k]);
    if (!id) return;
    const want = t.writes[id] ?? null;
    const patch = guestsSeePatch({ [id]: want });
    if (!patch) return;
    // What this cell held before the tap — the overlay's, else the server's stored choice. ↺ puts exactly that back,
    // whatever the table has been refreshed to since.
    const cell = table.groups.flatMap((g) => g.rows).find((r) => r.key === rowKey)?.cells[col];
    const prior: boolean | null = id in sent ? (sent[id] ?? null) : cell?.kind === 'box' ? cell.choice : null;
    const put = (v: boolean | null) => setSent((cur) => ({ ...cur, [id]: v }));
    put(want);
    start(async () => {
      const fd = new FormData();
      fd.set('intent', 'save');
      fd.set('patch', JSON.stringify(patch));
      fd.set(HUB_DRAFT_BAR_FIELD, '1');
      // The Maker's one save door: the Apply bar's count comes back WITH the write (`HUB_DRAFT_BAR_FIELD`, announced
      // by `makerSave`), and the switch already shows the tap — held, so no second render is owed.
      const r = await makerSave(
        () => hubDraftAction(eventId, fd),
        // one-render: keep (batched) — handed to makerSave, which owes no refresh for a held write.
        () => router.refresh(),
        {
          held: true,
          // ↺ The inverse, drawn at once: the switches go back to what they showed before this tap (and forward again
          // if the step back does not land). The server's own step back is the journal's (`lib/maker-drawn-undo.ts`).
          undo: {
            undraw: () => {
              put(prior);
              return { settle: Promise.resolve('shown' as const), now: true as const, landed: (ok: boolean) => { if (!ok) put(want); } };
            },
          },
        },
      ).catch(() => null);
      if (!r || !r.ok) {
        put(prior);
        setLine(r && !r.ok && r.error ? r.error : 'That did not save, so it is back as it was. Please try again.');
      }
    });
  };

  return (
    <div className="flex flex-col" data-home-hub-parts="">
      <HomeCardRow
        label="Parts of the page"
        hint="Guests see a change after you press Apply."
        marker="hub-page"
        control={
          <PickMenu
            label="Which page"
            value={String(col)}
            options={PAGES.map((p) => ({ key: String(p.col), label: p.label, ...(p.stage === now ? { trail: { text: 'Now', tone: 'ok' as const } } : {}) }))}
            onPick={(k) => {
              setCol(Number(k));
              setLine(null);
            }}
            dataAttr="data-home-hub-page"
            compact
          />
        }
      />
      {rows.map((row) => {
        const cell = row.cells[col]!;
        const on = guestsSeeOn(row, col, sent);
        return (
          <HomeCardRow
            key={row.key}
            label={row.label}
            hint={cell.kind === 'locked' ? cell.why : row.empty ? 'Nothing in it yet — guests are not shown an empty part.' : row.note}
            marker={row.key}
            control={
              cell.kind === 'box' ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={row.label}
                  className={SWITCH_BUTTON}
                  disabled={saving}
                  onClick={() => tap(row.key)}
                  data-home-hub-part={row.key}
                >
                  <SwitchTrack on={on} />
                </button>
              ) : (
                <span className="text-[12.5px] text-ink/60">{on ? 'Always on' : 'Off'}</span>
              )
            }
          />
        );
      })}
      {line ? (
        <p role="status" className="pt-2 text-[12.5px] text-ink/65" data-home-hub-line="">
          {line}
        </p>
      ) : null}
    </div>
  );
}
