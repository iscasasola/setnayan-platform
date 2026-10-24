'use client';

import { useId, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { FORM_PICK_CLASS, FormRow, FormRows } from '@/app/_components/form-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { formatCount } from '@/lib/format-number';
import { allotmentChunks } from '@/lib/papic-guest-allotments';
import {
  GUEST_CAMERA_ABOUT,
  GUEST_CAMERA_CHOICES,
  GUEST_CAMERA_LINES,
  GUEST_CAMERA_WORDS,
  checkGuestCredits,
  guestCameraPost,
  guestCameraRefusal,
  type GuestCamera,
} from '@/lib/papic-guest-camera';
import { GuestPopup } from './guest-popup';
import { useGuestActions } from './guest-actions-context';
import { guestToast } from './undo-store';

/** Select → Set… ▾ › Papic — the three choices, as the menu lists them (`papic:share` · `papic:set` · `papic:none`). */
export const PAPIC_SET_OPTIONS = [
  { key: 'papic:share', label: GUEST_CAMERA_WORDS.share, group: 'Papic' },
  { key: 'papic:set', label: `${GUEST_CAMERA_WORDS.set}…`, group: 'Papic' },
  { key: 'papic:none', label: GUEST_CAMERA_WORDS.none, group: 'Papic' },
] as const;

/**
 * guest-papic-bulk.tsx — "Papic · set N each" (owner 2026-10-23; prototype `guest_card_groups_and_papic_2026-10-23.html`,
 * frame 4). With guests selected, the shipped Set… ▾ menu's Papic group opens this ONE small sheet — the same three
 * choices as the card's "Their camera ▾" — and its button applies the choice to every selected guest through the SHIPPED
 * writer (`setGuestAllotment`, quiet, one RPC call per guest, the same target for each — never a delta), in chunks of at
 * most `ALLOTMENT_BATCH_MAX` guests per call. No new button in the thumb row.
 *
 * 🔑 IT ASKS FIRST, EVEN FOR ONE TAP'S CHOICE: there is no Undo for it (each guest had their own number before), so the
 * sheet says how many and to what before anything changes. A refusal is said in the sheet, with how many were set before
 * it stopped — never the look of success.
 */
export function GuestPapicBulkSheet({
  eventId,
  ids,
  names,
  start,
  onClose,
  onDone,
}: {
  eventId: string;
  ids: readonly string[];
  /** The selected guests' names, for the sheet's one line. */
  names: readonly string[];
  start: GuestCamera;
  onClose: () => void;
  onDone: () => void;
}) {
  const { setGuestAllotment } = useGuestActions();
  const [camera, setCamera] = useState<GuestCamera>(start);
  const [credits, setCredits] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** How many have landed while a long selection is still going ("120 of 300 set…"); null when not part-way. */
  const [progress, setProgress] = useState<number | null>(null);
  const titleId = useId();
  const creditsId = useId();
  const n = ids.length;
  const typed = credits.trim();
  const creditsWrong = camera === 'set' ? (typed === '' ? 'Add a number.' : checkGuestCredits(typed)) : null;
  const each = camera === 'set' && !creditsWrong ? Number(typed) : null;
  const button =
    camera === 'set' ? `Papic · set ${each === null ? 'N' : formatCount(each)} each` : `Papic · ${GUEST_CAMERA_WORDS[camera].toLowerCase()}`;
  const who = names.length <= 3 ? names.join(', ') : `${names.slice(0, 2).join(', ')} and ${formatCount(names.length - 2)} more`;

  /**
   * 🧱 IN CHUNKS, HONESTLY (review 2026-10-23). One call sets at most `ALLOTMENT_BATCH_MAX` guests (the action refuses
   * more), so the selection goes in chunks, in turn, and the sheet counts what LANDED: a refusal or a dropped connection
   * part-way says "X of N set" — never the look of success, never "nothing" when some were. Each chunk that lands has
   * already refreshed the pages that draw a camera (the action revalidates after every success, partial ones included).
   */
  const apply = async () => {
    if (busy || creditsWrong) return;
    const allotment = guestCameraPost(camera, each ?? undefined);
    setBusy(true);
    setProblem(null);
    let done = 0;
    const partly = (why: string) => (done > 0 ? `${formatCount(done)} of ${formatCount(n)} set, then: ${why}` : why);
    try {
      for (const chunk of allotmentChunks(ids)) {
        const fd = new FormData();
        fd.set('event_id', eventId);
        for (const id of chunk) fd.append('guest_id', id);
        fd.set('allotment', allotment);
        fd.set('quiet', '1');
        let res: Awaited<ReturnType<typeof setGuestAllotment>>;
        try {
          res = await setGuestAllotment(fd);
        } catch {
          setProblem(partly('Couldn’t save — check your connection and try again.'));
          return;
        }
        if (res && 'refused' in res) {
          done += res.set;
          setProblem(partly(guestCameraRefusal(res.refused)));
          return;
        }
        done += res && 'set' in res ? res.set : chunk.length;
        if (done < n) setProgress(done);
      }
      guestToast.success(`${formatCount(n)} ${n === 1 ? 'guest' : 'guests'} · ${camera === 'set' && each !== null ? `${formatCount(each)} credits each` : GUEST_CAMERA_WORDS[camera]}`);
      onDone();
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <GuestPopup
      onClose={onClose}
      rootClassName="fixed inset-0 z-[96] flex items-end justify-center tab:items-stretch tab:justify-end"
      panelClassName="relative w-full max-w-md rounded-t-3xl bg-cream pb-[max(env(safe-area-inset-bottom),16px)] shadow-[0_-30px_80px_-40px_rgba(26,26,26,0.4)] tab:max-w-none tab:w-[min(27.5rem,calc(100vw-3.5rem))] tab:rounded-none tab:rounded-l-3xl tab:shadow-[-30px_0_80px_-40px_rgba(26,26,26,0.4)]"
      labelledById={titleId}
      panelData={{ 'data-papic-bulk-sheet': '' }}
    >
      <div className="space-y-3 p-5 text-ink">
        <div>
          <h2 id={titleId} className="font-display text-xl">
            Papic · {formatCount(n)} {n === 1 ? 'guest' : 'guests'}
          </h2>
          <p className="mt-0.5 truncate text-sm text-ink/60">{who}</p>
        </div>
        <FormRows data="papic-bulk">
          <FormRow name="Their camera" about={{ words: GUEST_CAMERA_ABOUT }} line={GUEST_CAMERA_LINES[camera]} data="papic-bulk-camera">
            <PickMenu
              label="Their camera"
              value={camera}
              options={GUEST_CAMERA_CHOICES.map((c) => ({ key: c, label: GUEST_CAMERA_WORDS[c] }))}
              onPick={(k) => {
                setCamera(k as GuestCamera);
                setProblem(null);
              }}
              className={FORM_PICK_CLASS}
            />
          </FormRow>
          {camera === 'set' ? (
            <FormRow name="Credits each" line="The most each may take" data="papic-bulk-credits" problem={typed !== '' ? creditsWrong : null}>
              <input
                id={creditsId}
                aria-label="Credits each"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={credits}
                placeholder="e.g. 50"
                onChange={(e) => setCredits(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void apply();
                }}
                className="input-field w-24 text-right"
              />
            </FormRow>
          ) : null}
        </FormRows>
        {progress !== null ? (
          <p role="status" className="text-sm text-ink/60" data-papic-bulk-progress="">
            {formatCount(progress)} of {formatCount(n)} set…
          </p>
        ) : null}
        {problem ? (
          <p role="alert" className="text-sm font-medium text-danger-700">
            {problem}
          </p>
        ) : null}
        <div className="flex items-stretch gap-2 [&>*]:min-w-0">
          <ActionButton tone="neutral" icon={X} label="Cancel" onClick={onClose} />
          <ActionButton
            tone="brand"
            main
            icon={Camera}
            label={button}
            waiting={busy || Boolean(creditsWrong)}
            onClick={() => void apply()}
            className="flex-1"
            data-testid="papic-bulk-apply"
          />
        </div>
      </div>
    </GuestPopup>
  );
}
