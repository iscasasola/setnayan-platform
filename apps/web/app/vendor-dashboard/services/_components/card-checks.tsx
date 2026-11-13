'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowDown, Check, Flag, MoveRight, X } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton } from '@/components/action-button';
import { cardFairTexts, findFairHits, type FairHit } from '@/lib/fair-presentation';
import {
  REPORT_NOTE_MAX,
  cardPhotoLine,
  findServiceMismatch,
  photoBlocks,
  photoRefsKey,
  serviceMismatchLine,
  type CardCheckInput,
  type CardPhotoVerdict,
  type CheckTrade,
  type ClaimWord,
  type ServiceMismatch,
} from '@/lib/service-card-checks';
import { cardPhotoAction, type ReportCardPhotoResult } from '../card-check-actions';
import { TypedRow } from '@/app/_components/form-row';
import { useRevealOnOpen } from '@/app/_components/reveal-on-open';
import { formatCount } from '@/lib/format-number';

/**
 * THE CARD CHECKS, INSIDE THE SHIPPED MAKER — "fix before Create" (owner 2026-10-26).
 *
 * `canvas-maker.tsx` reads the form once per change (its existing live read) and hands the text and photo refs here.
 * Each problem is drawn ON ITS OWN ROW (Name · What's included · Extras · Photos) as a plain line — no box, the why
 * inside the ⓘ — and the maker keeps Create (Save on an edit) waiting while `open > 0`. The save asks again.
 *
 * REQUESTS (counted from this file): typing costs NONE — claim words and the service match are pure functions over
 * lists the page already read. Photos cost ONE server action per change of the card's SET of photos (debounced
 * 250 ms, latest wins), never per keystroke, and none when no photo is on the card. "It's mine — report it" is one
 * more action, only when pressed.
 */

/** What the page read for the checks (`lib/service-card-checks.server.ts`). `null` = unread. */
export type MakerCheckRules = {
  claimWords: ClaimWord[] | null;
  trades: CheckTrade[] | null;
  /** 🚫 This shop's card names — check 9 (flooding). Absent/`null` = the save checks it instead. */
  ownCards?: { id: string; title: string }[] | null;
};

/** The photo ask — the server action in the app; a fixture server action in `/dev/card-maker-lab`. */
export type PhotoCheckAsk = (input: { serviceId: string | null; cover: string | null; showcase: string[] }) => Promise<CardPhotoVerdict[]>;

const DANGER = { color: 'rgb(var(--color-danger))' } as const;
/**
 * A note line owns a 46 px row: its ⓘ's press halo is 46 × 46 (`.sn-dot-btn`, the 44 px press rule), so two notes any
 * closer would put one ⓘ's target over the other's (measured at 375 px, 2026-11-08 — the second word's ⓘ took the
 * first one's press).
 */
const NOTE = 'flex min-h-12 items-center gap-2 text-sm font-medium leading-snug';
const QUIET = 'mt-1.5 text-sm leading-snug text-[color:var(--m-slate-2)]';
/** A check that could not run — amber, never the quiet grey of "nothing to say" (template rule 6). */
const UNREAD = 'mt-1.5 text-sm leading-snug text-warn-700';

export type CardChecks = {
  /**
   * 🚫 THE FAIR-PRESENTATION CHECKS (owner 2026-11-08) — the claim words (disguised forms too), rank forms, no emoji and
   * the text checks of the 18, on the name, each what's-included line and each extra (`lib/fair-presentation.ts`).
   */
  fair: FairHit[];
  mismatch: ServiceMismatch | null;
  photos: CardPhotoVerdict[];
  /** A photo ask is in flight (or the set changed and has not been asked yet). */
  checkingPhotos: boolean;
  /** Problems that keep Create waiting. */
  open: number;
  /** A list that could not be read — said on the card, never shown as "nothing to fix". */
  unread: string[];
};

export function useCardChecks(args: {
  rules: MakerCheckRules | null;
  input: CardCheckInput;
  category: string;
  categoryLabel: string;
  serviceId: string | null;
  /** Defaults to `checkCardPhotosAction`; only the dev lab hands in another. */
  ask?: PhotoCheckAsk;
}): CardChecks {
  const { rules, input, category, categoryLabel, serviceId } = args;
  const ask: PhotoCheckAsk = args.ask ?? ((i) => cardPhotoAction({ op: 'check', ...i }) as Promise<CardPhotoVerdict[]>);

  const fair = useMemo(
    () =>
      // Pure, over lists the page already read — typing costs no request. An unread word list skips ONLY the word
      // check (said under the status); the other checks need no list and run anyway.
      findFairHits(cardFairTexts(input), {
        words: rules?.claimWords ?? null,
        siblingNames: (rules?.ownCards ?? []).filter((c) => c.id !== serviceId).map((c) => c.title),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the text fields are the identity; `input` is rebuilt per read
    [rules, serviceId, input.title, input.inclusionLabels.join('\u0001'), input.addonLabels.join('\u0001')],
  );

  const mismatch = useMemo(
    () =>
      rules?.trades && category
        ? findServiceMismatch({ title: input.title, lines: input.inclusionLabels, category, categoryLabel, trades: rules.trades })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as above
    [rules, category, categoryLabel, input.title, input.inclusionLabels.join('\u0001')],
  );

  const refsKey = photoRefsKey(input);
  const [asked, setAsked] = useState<{ key: string; verdicts: CardPhotoVerdict[] }>({ key: '', verdicts: [] });
  const [inFlight, setInFlight] = useState(false);
  useEffect(() => {
    if (!refsKey) return;
    let live = true;
    const cover = input.coverRef;
    const showcase = input.showcaseRefs;
    const timer = setTimeout(() => {
      setInFlight(true);
      ask({ serviceId, cover, showcase })
        .then((verdicts) => {
          if (live) setAsked({ key: refsKey, verdicts });
        })
        .catch(() => {
          if (!live) return;
          const all = [
            ...(cover ? [{ ref: cover, where: 'cover' as const, verdict: 'unchecked' as const }] : []),
            ...showcase.map((ref) => ({ ref, where: 'showcase' as const, verdict: 'unchecked' as const })),
          ];
          setAsked({ key: refsKey, verdicts: all });
        })
        .finally(() => {
          if (live) setInFlight(false);
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refsKey IS cover + showcase; `ask` is fixed per page
  }, [refsKey, serviceId]);

  const photos = refsKey && asked.key === refsKey ? asked.verdicts : [];
  const unread: string[] = [];
  if (rules && rules.claimWords === null) unread.push('the word check');
  if (rules && rules.trades === null) unread.push('the service check');

  return {
    fair,
    mismatch,
    photos,
    checkingPhotos: Boolean(refsKey) && (inFlight || asked.key !== refsKey),
    open: fair.length + (mismatch ? 1 : 0) + photos.filter(photoBlocks).length,
    unread,
  };
}

/** 🚫 The fair-presentation note on one row of the maker — the shared note every supplier-written field draws. */
export { FairNote } from '@/app/_components/fair-note';

/** "The card matches its service" — on the Name row, with the right service offered in place on a new card. */
export function ServiceMismatchNote({
  mismatch,
  categoryLabel,
  onMove,
  moveWhy,
}: {
  mismatch: ServiceMismatch | null;
  categoryLabel: string;
  /** Present when this card's service can still be changed here (a new card with the kind list). */
  onMove: ((key: string) => void) | null;
  /** Why the suggested service cannot be picked by this shop (its plan), when it cannot. */
  moveWhy: string | null;
}) {
  if (!mismatch) return null;
  return (
    <div data-card-check="service">
      <p role="alert" className={NOTE} style={DANGER}>
        <span className="min-w-0 flex-1">{serviceMismatchLine(mismatch, categoryLabel)}</span>
        <InfoTip label="" ariaLabel="About filing a card" align="end">
          <span className="block font-semibold">One card, one service</span>
          <span className="mt-1 block">
            Couples find a card under the service it is filed under. Rename it to say what it is
            {onMove ? `, or move it to ${mismatch.says.label}` : `, or make a ${mismatch.says.label} card`}.
          </span>
          {moveWhy ? <span className="mt-1 block text-[color:var(--m-slate-2)]">{moveWhy}</span> : null}
        </InfoTip>
      </p>
      {onMove && !moveWhy ? (
        <div>
          <ActionButton tone="neutral" icon={MoveRight} label={`Move to ${mismatch.says.label}`} onClick={() => onMove(mismatch.says.key)} />
        </div>
      ) : !onMove ? (
        <p className={QUIET}>
          <Link href="/vendor-dashboard/services/new" className="font-semibold text-sn-accent">Make a {mismatch.says.label} card ›</Link>
        </p>
      ) : null}
    </div>
  );
}

/** One photo = one service card — on the Photos row. */
export function PhotoCheckNotes({
  checks,
  serviceId,
  showcaseRefs,
}: {
  checks: Pick<CardChecks, 'photos' | 'checkingPhotos'>;
  serviceId: string | null;
  showcaseRefs: ReadonlyArray<string>;
}) {
  const blocked = checks.photos.filter(photoBlocks);
  const unchecked = checks.photos.filter((p) => p.verdict === 'unchecked');
  if (blocked.length === 0 && unchecked.length === 0 && !checks.checkingPhotos) return null;
  const uncheckedWords = unchecked.length === 1 ? 'one photo' : `${formatCount(unchecked.length)} photos`;
  return (
    <div data-card-check="photo" className="mt-2 space-y-1">
      {blocked.map((v) => (
        <PhotoBlockedNote key={v.ref} verdict={v} serviceId={serviceId} position={v.where === 'showcase' ? showcaseRefs.indexOf(v.ref) + 1 : 0} />
      ))}
      {unchecked.length > 0 ? (
        <p className={UNREAD} data-card-check-unchecked="">
          Couldn’t check {uncheckedWords} just now — Create checks again.
        </p>
      ) : null}
      {checks.checkingPhotos && blocked.length === 0 ? (
        <p className={QUIET} data-card-check-checking="" aria-live="polite">
          Checking the photos aren’t on another card…
        </p>
      ) : null}
    </div>
  );
}

function PhotoBlockedNote({ verdict, serviceId, position }: { verdict: CardPhotoVerdict; serviceId: string | null; position: number }) {
  const [open, setOpen] = useState(false);
  const reportBox = useRef<HTMLDivElement>(null);
  // The note opens IN PLACE under its line and is brought into view (the app-wide reveal-on-open).
  const intend = useRevealOnOpen(open, () => ({ head: reportBox.current }));
  const [note, setNote] = useState('');
  const [sent, setSent] = useState<null | { ok: boolean; text: string }>(null);
  const [sending, startSending] = useTransition();
  const base = cardPhotoLine(verdict) ?? '';
  const text = verdict.where === 'showcase' && position > 0 ? base.replace('One of your photos', `Photo ${position} under More photos`) : base;
  return (
    <div data-card-check-photo={verdict.verdict}>
      <p role="alert" className={NOTE} style={DANGER}>
        <span className="min-w-0 flex-1">{text}</span>
        <InfoTip label="" ariaLabel="About one photo, one card" align="end">
          <span className="block font-semibold">One photo, one card</span>
          <span className="mt-1 block">
            {verdict.verdict === 'another_shop'
              ? 'A photo can be on one service card only. We never say which shop — if it is your own photo, report it and we’ll look.'
              : 'A photo can be on one service card only, so each card shows its own work.'}
          </span>
        </InfoTip>
      </p>
      {verdict.verdict === 'another_shop' ? (
        sent?.ok ? (
          <p className={`${QUIET} flex items-center gap-1.5`} data-card-check-reported="">
            <Check aria-hidden className="h-4 w-4 flex-none" strokeWidth={2} /> Sent to Setnayan. Replace the photo to save now.
          </p>
        ) : (
          <div ref={reportBox}>
            {!open ? (
              <ActionButton
                tone="neutral"
                icon={Flag}
                label="It’s mine — report it"
                onClick={() => {
                  intend();
                  setOpen(true);
                }}
                aria-expanded={false}
              />
            ) : (
              <div className="space-y-2">
                <TypedRow
                  name="A short note for Setnayan"
                  value={note}
                  long
                  boxed
                  maxLength={REPORT_NOTE_MAX}
                  empty="Optional"
                  placeholder="e.g. I shot this at our March wedding"
                  onKeep={(t) => setNote(t)}
                  data="card-photo-report-note"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <ActionButton tone="neutral" icon={X} label="Cancel" onClick={() => setOpen(false)} />
                  <ActionButton
                    tone="brand"
                    icon={Flag}
                    label={sending ? 'Sending…' : 'Send report'}
                    waiting={sending}
                    onClick={() =>
                      startSending(async () => {
                        const res = await (cardPhotoAction({ op: 'report', serviceId, ref: verdict.ref, where: verdict.where, note }) as Promise<ReportCardPhotoResult>).catch(() => ({
                          ok: false as const,
                          message: 'We couldn’t send that just now — try again.',
                        }));
                        setSent(res.ok ? { ok: true, text: '' } : { ok: false, text: res.message });
                      })
                    }
                  />
                </div>
                {sent && !sent.ok ? (
                  <p role="alert" className="text-sm" style={DANGER}>
                    {sent.text}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        )
      ) : null}
    </div>
  );
}

/** One line under the status: how many things keep Create waiting, and where the first one is. */
export function CardChecksSummary({ open, unread, isEdit }: { open: number; unread: string[]; isEdit: boolean }) {
  if (open === 0 && unread.length === 0) return null;
  return (
    <div className="text-sm leading-snug" data-card-checks-open={open} style={open > 0 ? DANGER : undefined}>
      {open > 0 ? (
        <span className="flex flex-wrap items-center gap-x-2">
          {isEdit ? 'Save' : 'Create'} waits for {open === 1 ? '1 thing' : `${open} things`} to fix on the card.
          <ActionButton
            tone="neutral"
            quiet
            icon={ArrowDown}
            label="Show me"
            onClick={() => document.querySelector('[data-card-check] [role="alert"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' })}
          />
        </span>
      ) : null}
      {unread.length > 0 ? (
        <span className="block text-warn-700">Couldn’t load {unread.join(' · ')} — {isEdit ? 'Save' : 'Create'} checks it again.</span>
      ) : null}
    </div>
  );
}
