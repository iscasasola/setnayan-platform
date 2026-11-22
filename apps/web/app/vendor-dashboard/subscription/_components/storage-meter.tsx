import { CircleAlert } from 'lucide-react';
import { DatesRow } from '../../customers/_components/dates-row';
import { ShopNotice } from '../../_components/kit';
import { storageWords } from '@/lib/downgrade-limits';
import {
  STORAGE_KINDS,
  STORAGE_UNREAD,
  meterWords,
  roomLine,
  storageAllowanceBytes,
  storageMeterState,
  storageNotice,
  storageTotal,
  storageUsedLine,
  type StorageBreakdownRead,
} from '@/lib/supplier-storage';
import { planWord } from '@/lib/vendor-plan-change-words';
import { asVendorTier } from '@/lib/vendor-tier-caps';

/**
 * 📏 THE STORAGE METER — the top block of the Plans page (drawing `prototypes/supplier_storage_page_2026-11-22/`,
 * approved by the owner 22 Nov, § 1 "Top block: plan · size, one bar split by kind, X of Y used · Z free, the kinds";
 * spec § ★ H). It REPLACES the old "Storage" row (drawing: "it became the top block of this page").
 *
 * The kinds are the owner's 23 Nov three, not the drawing's five (DECISION_LOG "THE SUPPLIER STORAGE METER COUNTS
 * EVERYTHING THE SHOP OWNS — FILES AND DATA" (4): "the meter shows the split Photos & video · Files · Records"). The
 * chat & documents room carries its own second line under the bar (spec § ★ H, the room's label delta). Real usage
 * only: no reserve, so a new shop reads its true few KB (owner 23 Nov, "No, real usage only").
 *
 * The rows have no way in yet: each kind's own file list is the next build (spec § ★ G, Make room), so they are
 * statements, never presses. Colours are the category tokens (light and dark paired in globals.css), each with a word
 * and a size beside it.
 *
 * Presentational: every value arrives read. The Plans page and `/dev/supplier-plan-lab` both mount it.
 */
const KIND_FILL: Record<(typeof STORAGE_KINDS)[number]['key'], string> = {
  photosVideo: 'bg-cat-schedule',
  files: 'bg-cat-collect',
  records: 'bg-cat-booked',
};

const LEVEL_WORD: Record<'ok' | 'near' | 'full', string> = {
  ok: 'text-ink',
  near: 'text-warn-700',
  full: 'text-danger-600',
};
const LEVEL_FILL: Record<'ok' | 'near' | 'full', string> = {
  ok: 'bg-cat-collect',
  near: 'bg-warn-600',
  full: 'bg-danger-600',
};

export function StorageMeter({ tier, read }: { tier: string; read: StorageBreakdownRead }) {
  const allowance = storageAllowanceBytes(tier);
  if (allowance === null) return null;
  const name = `${planWord(asVendorTier(tier))} · ${storageWords(allowance)}`;

  if (read.status !== 'ok') {
    return (
      <section className="sn-frame mt-3" aria-label="Storage" data-plan-storage="unread">
        <p className="text-sn-2xl font-bold text-ink">{name}</p>
        <p className="mt-2 flex items-center gap-2 text-sn-base text-ink/70" role="status">
          <CircleAlert aria-hidden className="h-4 w-4 flex-none" strokeWidth={1.75} />
          {STORAGE_UNREAD}
        </p>
      </section>
    );
  }

  const b = read.breakdown;
  const used = storageTotal(b);
  const state = storageMeterState(tier, b);
  if (!state) return null;
  const { pct, level, roomLevel, roomPct } = state;
  const notice = storageNotice(state);
  const over = used > allowance;
  const base = over ? used : allowance;
  // Photos full but the plan not: the free part is the room, kept for chat and documents — never "8 GB free" alone.
  const usedLine =
    state.mediaPct >= 100 && !over
      ? `${meterWords(used)} of ${storageWords(allowance)} used · the rest is kept for chat and documents`
      : storageUsedLine(tier, used);
  const free = Math.max(0, allowance - used);
  const label = [
    ...STORAGE_KINDS.map((k) => `${k.name} ${meterWords(b[k.key])}`),
    ...(over ? [] : [`free ${meterWords(free)}`]),
  ].join(', ');

  return (
    <section className="sn-frame mt-3" aria-label="Storage" data-plan-storage={level}>
      <div className="flex items-baseline gap-3">
        <p className="min-w-0 flex-1 text-sn-2xl font-bold text-ink">{name}</p>
        <p className={`flex-none text-sn-3xl font-bold tabular-nums ${LEVEL_WORD[level]}`} data-plan-storage-pct="">
          {over ? `${meterWords(used - allowance)} over` : `${pct}%`}
        </p>
      </div>

      <div role="img" aria-label={label} className="mt-3 flex h-5 gap-0.5 overflow-hidden rounded bg-ink/10">
        {STORAGE_KINDS.map((k) =>
          b[k.key] > 0 ? (
            <i
              key={k.key}
              className={`block h-full min-w-1 ${KIND_FILL[k.key]}`}
              style={{ flex: `0 0 ${((b[k.key] / base) * 100).toFixed(3)}%` }}
            />
          ) : null,
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sn-sm text-ink/70" aria-hidden>
        {STORAGE_KINDS.map((k) => (
          <span key={k.key} className="inline-flex items-center gap-1.5">
            <b className={`h-2.5 w-2.5 flex-none rounded-sm ${KIND_FILL[k.key]}`} />
            {k.name}
          </span>
        ))}
        {over ? null : (
          <span className="inline-flex items-center gap-1.5">
            <b className="h-2.5 w-2.5 flex-none rounded-sm bg-ink/10 ring-1 ring-inset ring-ink/30" />
            Free
          </span>
        )}
      </div>

      <p className="mt-3 text-sn-lg font-semibold tabular-nums text-ink" data-plan-storage-used="">
        {usedLine}
      </p>

      <div className="mt-3 border-t border-ink/10 pt-3" data-plan-storage-room={roomLevel}>
        <p className="text-sn-md tabular-nums text-ink/70">{roomLine(tier, b.room)}</p>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden>
          <i className={`block h-full ${LEVEL_FILL[roomLevel]}`} style={{ width: `${Math.min(100, roomPct)}%` }} />
        </div>
      </div>

      {notice ? (
        <ShopNotice tone={notice.tone} role={notice.tone === 'danger' ? 'alert' : 'status'} className="mt-3">
          {notice.words}
        </ShopNotice>
      ) : null}

      <div className="mt-2" data-plan-storage-kinds="">
        {STORAGE_KINDS.map((k) => (
          <DatesRow
            key={k.key}
            data="plan-storage-kind"
            lead={<b className={`h-3 w-3 flex-none rounded-sm ${KIND_FILL[k.key]}`} aria-hidden />}
            title={k.name}
            line={k.line}
            strong={meterWords(b[k.key])}
          />
        ))}
      </div>
    </section>
  );
}
