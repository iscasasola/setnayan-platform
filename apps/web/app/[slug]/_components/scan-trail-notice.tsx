import { InfoTip } from '@/app/_components/info-tip';
import { scanTrailLines } from '@/lib/scan-trail-words';
import { CircleSlash, RotateCcw } from 'lucide-react';
import { ME_PILL } from './sign-out-of-invitation';
import { SubmitButton } from '@/app/_components/submit-button';
import { createAdminClient } from '@/lib/supabase/admin';
import { setGuestScanTracking } from '../actions';
import { SIMULATED_GUEST_ID } from '@/lib/simulated-guest-preview';

/**
 * THE HANDLE FOR `guests.scan_tracking_opt_out`.
 *
 * The column has existed since 2026-05-13 citing RA 10173 and had no writer and
 * no reader — a switch a guest could not reach, beside a trail nothing told them
 * about. `lib/scan-trail.ts` now honours it at the one door that writes
 * `scan_events`; this is where a guest actually moves it.
 *
 * ⚖ NOT PART OF `FaceDataNotice`, and not gated the same way. That notice is
 * about the guest's LIKENESS and renders only for guests with a stored selfie
 * (`photo_source === 'selfie'`). Every guest who opens an invitation leaves a
 * scan trail, selfie or not, so this control renders for every recognised guest.
 * Folding them together would have hidden this switch from most of the people
 * it exists for.
 */

/**
 * This guest's CURRENT setting, read here rather than threaded down — the same
 * reasoning as `readFaceBlock`: a value carried from a page rendered before the
 * guest flipped it shows a switch in the wrong position, which on a privacy
 * control is worse than no switch at all.
 *
 * ⚠ FAILS TOWARD "WE ARE KEEPING A RECORD". A read error returns null (NOT
 * MEASURED), and the control offers the PROTECTIVE action — while the sentence
 * says it could not check, rather than stating either setting as fact (S41b). The alternative tells a guest they are
 * already untracked on the strength of a failed read. The gate itself is in
 * `recordScan`, which is unaffected by this: it fails the other way, toward
 * writing nothing, because there a wrong guess costs a greeting rather than a
 * record somebody asked us not to keep.
 */
async function readScanOptOut(eventId: string, guestId: string): Promise<boolean | null> {
  try {
    const { data, error } = await createAdminClient()
      .from('guests')
      .select('scan_tracking_opt_out')
      .eq('event_id', eventId)
      .eq('guest_id', guestId)
      .maybeSingle();
    if (error) {
      console.error('[supabase-error] app/[slug]/_components/scan-trail-notice.tsx · from:guests.select', error);
      return null;
    }
    return (data as { scan_tracking_opt_out?: boolean } | null)?.scan_tracking_opt_out === true;
  } catch {
    return null;
  }
}

/**
 * What the one button sets the opt-out TO. `null` (not measured) offers the
 * PROTECTIVE action — stop keeping a record (S41b).
 */
export function scanOptOutTarget(current: boolean | null): boolean {
  return current !== true;
}

export async function ScanTrailNotice({
  eventId,
  guestId,
  preview = false,
  card = false,
  me = false,
}: {
  eventId: string;
  guestId: string;
  /** The Maker's canvas (`isEditorCanvas`). */
  preview?: boolean;
  /** 🃏 On Me: drawn on the Hub's own scene card (`ScanTrailForm`). */
  card?: boolean;
  /** 🔘 On the redrawn Me (owner 2026-10-24): one line with its ⓘ, then a small icon-and-word pill. */
  me?: boolean;
}) {
  // 🖼 NOT IN THE MAKER'S CANVAS, AND NEVER FOR THE SAMPLE GUEST (owner
  // 2026-09-27). The sample of the "After they reply" preview has no row, so
  // the read fails (its id is not a uuid — 22P02) and the honest "we couldn't
  // check" line would be said about a person who does not exist. Decided HERE,
  // so every recognised guest's mount stays unconditional.
  if (preview || guestId === SIMULATED_GUEST_ID) return null;
  const optedOut = await readScanOptOut(eventId, guestId);
  const toggle = setGuestScanTracking.bind(null, eventId, guestId, scanOptOutTarget(optedOut));

  // The OFF sentence carries the cost, said plainly. A guest who turns this off
  // should not later wonder why the page stopped welcoming them on arrival —
  // that greeting is the trail's only reader anywhere in the product.
  /* 🗣 "AT THIS EVENT" (owner 2026-10-24, the Me redraw: the event type's word → "event") — our own copy says
     "event", never the event type's word (the house rule: say "event"). */
  const lines = scanTrailLines(optedOut);
  const sentence = lines.more ? `${lines.main} ${lines.more}` : lines.main;

  return <ScanTrailForm sentence={sentence} optedOut={optedOut === true} toggle={toggle} card={card} me={me} lines={lines} />;
}

/**
 * The note and its one button, as drawn. 🃏 `card` — ON ME IT SITS ON THE HUB'S OWN SCENE CARD (owner 2026-10-21,
 * "Yes to all" on guest_page_fixes_2_4, fix 2): the stage's other topics are `.sn-hub-cards > section` cards
 * (`guest-me.tsx`), and this note was the last words left bare on the couple's photo. The same wrapper, no new CSS.
 * Under a page that is one scroll (the foot, `data-guest-foot`) it stays a plain line, as before.
 */
export function ScanTrailForm({
  sentence,
  optedOut,
  toggle,
  card = false,
  me = false,
  lines = null,
}: {
  sentence: string;
  optedOut: boolean;
  toggle: (formData: FormData) => void | Promise<void>;
  card?: boolean;
  me?: boolean;
  lines?: { main: string; more: string | null } | null;
}) {
  /* 🪪 ON THE REDRAWN ME (owner 2026-10-24, `me_tab_redraw_2026-10-24_fable.html`): the record line with its ⓘ (the
     rest of the sentence inside — details go inside the ⓘ), then a small icon-and-word pill — no box, no bare link.
     The pill and "Sign out of this invitation" stand side by side (both inline). */
  if (me) {
    const said = lines ?? { main: sentence, more: null };
    return (
      <>
        {said.more ? (
          <InfoTip label={said.main} labelAs="p" labelClassName="text-sm text-ink/70" className="justify-center" ariaLabel="About this record">
            {said.more}
          </InfoTip>
        ) : (
          <p className="text-sm text-ink/70">{said.main}</p>
        )}
        <form action={toggle} data-scan-trail="" className="m-1 mt-3 inline-block align-middle text-sm text-ink/70">
          <SubmitButton className={ME_PILL} pendingLabel={optedOut ? 'Turning on…' : 'Turning off…'}>
            {optedOut ? <RotateCcw aria-hidden className="h-4 w-4 shrink-0" /> : <CircleSlash aria-hidden className="h-4 w-4 shrink-0" />}
            <span>{optedOut ? 'Keep a record again' : 'Stop keeping a record'}</span>
          </SubmitButton>
        </form>
      </>
    );
  }
  const form = (
    /* 🔎 READABLE AND PRESSABLE (a guest's walk 2026-10-11): the note was 3.98:1 (`text-ink/60`); it is 5.4:1 now,
       and the button says its own 44px. NO "are you sure?": the press only flips this guest's one setting
       (`setGuestScanTracking` — nothing is deleted), and the same button, now reading "Keep a record again",
       puts it back at once. The gutter is the page's, given by whoever draws this (`site-body.tsx`). */
    <form
      action={toggle}
      data-scan-trail=""
      className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink/70"
    >
      <span className="min-w-0">{sentence}</span>
      <SubmitButton
        className="inline-flex min-h-[44px] shrink-0 items-center font-medium text-mulberry underline-offset-2 hover:underline"
        pendingLabel={optedOut ? 'Turning on…' : 'Turning off…'}
      >
        {optedOut ? 'Keep a record again' : 'Stop keeping a record'}
      </SubmitButton>
    </form>
  );
  /* `!mt-4`: 16 px under the card above it on Me's stage — the Hub's own card rhythm (`sn-hub-cards space-y-4`),
     not the stage's wider gap between topics. Drawn only when there is a note, so there is never an empty card. */
  return card ? (
    <div className="sn-hub-cards !mt-4" data-me-card="record">
      <section>{form}</section>
    </div>
  ) : (
    form
  );
}
