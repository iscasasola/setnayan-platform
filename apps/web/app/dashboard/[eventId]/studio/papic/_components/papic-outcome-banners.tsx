import { AlertCircle, CheckCircle2, Info, Unlink2 } from 'lucide-react';
import { PAPIC_CAPTURE_MONTHS_BEFORE } from '@/lib/papic-window';
import { PAPIC_CAMERA_SALE_REFUSED, PAPIC_CAMERA_SALE_REFUSED_WORDS } from '@/lib/papic-sells-only-credits';

/**
 * papic-outcome-banners.tsx — EVERY PAPIC SAVE'S ANSWER, SAID ON THE PAPIC CARD (moved here unchanged from the Papic
 * page, removed 2026-10-26 — owner: *"that papic frame with toggle, place that on home and remove that page"*).
 *
 * The non-in-place saves (a form posted without JavaScript, a purchase error, an old link) still answer with a query
 * key — `style_set=MONO`, `papic_pool_error=…` — and now land on Home › Today with the card open
 * (`lib/papic-home-href.ts`). Home hands those keys here and the open card says them first, so a save never answers
 * into the void. 🔒 `outcomes-are-shown.test.ts` holds the bail-out list against the banners below.
 */

/** Every outcome key a Papic save answers with — Home's `searchParams` type and the card read these. */
export const PAPIC_OUTCOME_KEYS = [
  'drive_connected',
  'drive_disconnected',
  'drive_error',
  'papic_access_error',
  'uploads_ready',
  'uploads_error',
  'uploads_open_set',
  'papic_error',
  'limited_error',
  'papic_window_saved',
  'papic_window_error',
  'style_set',
  'style_error',
  'showcase_set',
  'showcase_error',
  'faceTagging',
  'vendorMedia',
  'guestCameras',
  'preserve_set',
  'preserve_error',
  'allotment_set',
  'allotment_error',
] as const;
export type PapicOutcomeKey = (typeof PAPIC_OUTCOME_KEYS)[number];
export type PapicOutcomes = Partial<Record<PapicOutcomeKey, string>>;

/** True when Home was handed any Papic outcome — the card then opens on arrival to say it. */
export function hasPapicOutcome(search: PapicOutcomes | null | undefined): boolean {
  return Boolean(search && PAPIC_OUTCOME_KEYS.some((k) => typeof search[k] === 'string'));
}

/** The banners, from Home's query keys as they arrive. */
export function PapicOutcomeBanners({ eventId, search, appleIap = false }: { eventId: string; search: PapicOutcomes; appleIap?: boolean }) {
  return (
    <StatusBanners
      eventId={eventId}
      driveConnected={!!search.drive_connected}
      driveDisconnected={!!search.drive_disconnected}
      driveError={search.drive_error}
      papicAccessError={search.papic_access_error}
      uploadsReady={search.uploads_ready}
      uploadsError={search.uploads_error}
      uploadsOpenSet={search.uploads_open_set}
      connectedAccount={null}
      papicError={search.papic_error}
      limitedError={search.limited_error}
      papicWindowSaved={search.papic_window_saved}
      papicWindowError={search.papic_window_error}
      styleSet={search.style_set}
      styleError={search.style_error}
      showcaseSet={search.showcase_set}
      showcaseError={search.showcase_error}
      faceTagging={search.faceTagging}
      vendorMedia={search.vendorMedia}
      guestCameras={search.guestCameras}
      preserveSet={search.preserve_set}
      preserveError={search.preserve_error}
      allotmentSet={search.allotment_set}
      allotmentError={search.allotment_error}
      appleIap={appleIap}
    />
  );
}

function StatusBanners({
  eventId,
  driveConnected,
  driveDisconnected,
  driveError,
  papicAccessError,
  uploadsReady,
  uploadsError,
  uploadsOpenSet,
  allotmentSet,
  allotmentError,
  connectedAccount,
  papicError,
  limitedError,
  papicWindowSaved,
  papicWindowError,
  styleSet,
  styleError,
  showcaseSet,
  showcaseError,
  faceTagging,
  vendorMedia,
  guestCameras,
  preserveSet,
  preserveError,
  appleIap = false,
}: {
  eventId: string;
  driveConnected: boolean;
  driveDisconnected: boolean;
  driveError: string | undefined;
  papicAccessError: string | undefined;
  uploadsReady: string | undefined;
  uploadsError: string | undefined;
  uploadsOpenSet: string | undefined;
  allotmentSet: string | undefined;
  allotmentError: string | undefined;
  connectedAccount: string | null;
  papicError: string | undefined;
  limitedError: string | undefined;
  papicWindowSaved: string | undefined;
  papicWindowError: string | undefined;
  styleSet: string | undefined;
  styleError: string | undefined;
  showcaseSet: string | undefined;
  showcaseError: string | undefined;
  faceTagging: string | undefined;
  vendorMedia: string | undefined;
  guestCameras: string | undefined;
  preserveSet: string | undefined;
  preserveError: string | undefined;
  /** 🍎 The iPhone app where Apple sells — no line that speaks of a web price. */
  appleIap?: boolean;
}) {
  const ok =
    'inline-flex items-center gap-2 rounded-2xl border border-success-300/70 bg-success-50 px-4 py-3 text-sm text-success-900';
  const neutral =
    'inline-flex items-start gap-2 rounded-2xl border border-ink/15 bg-cream px-4 py-3 text-sm text-ink/75';
  const bad =
    'inline-flex items-start gap-2 rounded-2xl border border-danger-300/70 bg-danger-50 px-4 py-3 text-sm text-danger-900';

  const hasAny =
    driveConnected ||
    driveDisconnected ||
    driveError ||
    papicAccessError ||
    uploadsReady ||
    uploadsError ||
    uploadsOpenSet ||
    papicError ||
    limitedError ||
    papicWindowSaved !== undefined ||
    papicWindowError ||
    // ⚠ THE BAIL-OUT IS HALF THE BUG. Adding a banner below without adding its
    // param here returns null before anything renders — the confirmation would
    // be written, passed in, and still never shown. That is exactly how these
    // nine got lost the first time.
    styleSet ||
    styleError ||
    showcaseSet ||
    showcaseError ||
    faceTagging ||
    vendorMedia ||
    guestCameras ||
    preserveSet ||
    preserveError ||
    allotmentSet ||
    allotmentError;
  if (!hasAny) return null;

  return (
    <div className="space-y-3">
      {/* 💳 THE "ORDER RECEIVED" BANNER LIVED HERE, AND IT WAS THE DETOUR.
          It printed the amount and the reference and then offered "See how to
          pay" → the order page → "Pay now" → /pay. The owner asked why a Papic
          purchase did not land where the others land; it now does, at the mint
          (app/.../studio/papic/actions.ts), so there is no state left for this
          banner to describe. Deleted rather than left unreachable: a
          confirmation nothing can trigger reads to the next person as a live
          screen with a broken trigger. */}
      {/* ⛔ "N Unlimited cameras added — free with Unlock all" and "N new guest cameras added from your
          list" were the two confirmations of camera sales that no longer exist (2026-10-23). Nothing sets
          their params any more; an old link carrying one shows nothing rather than a camera count. */}

      {papicWindowSaved !== undefined ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Capture window saved — {papicWindowSaved} day
          {papicWindowSaved === '1' ? '' : 's'}.
        </p>
      ) : null}

      {papicWindowError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          {papicWindowError === 'end_after_event_date'
            ? 'Capture has to cover your event day — start on or before it.'
            : papicWindowError === 'start_after_end'
              ? 'The end date is before the start date.'
              : papicWindowError === 'missing_event_date'
                ? 'Set your event date first, then choose a window.'
                : papicWindowError === 'start_too_early'
                  ? `You can start up to ${PAPIC_CAPTURE_MONTHS_BEFORE} months before your event — pick a later start date.`
                  : 'Could not save the window — please try again.'}
        </p>
      ) : null}

      {/* ⚠ NINE CONFIRMATIONS THAT WENT NOWHERE. Each of these was already being
          written into the URL by an action and read by nothing at all — so a
          couple changing their Papic look, their photo quality, face matching,
          showcase state, vendor visibility or guest cameras got no answer
          whether it worked or failed. Wording is plain English: what a PERSON
          did, never the name of the thing that stores it. */}

      {styleSet ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Look saved — every camera at your event shoots it from now on.
        </p>
      ) : null}
      {styleError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          Could not save that look — please try again.
        </p>
      ) : null}

      {showcaseSet ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {showcaseSet === 'removed'
            ? 'Taken out of your public memory orb.'
            : 'Added to your public memory orb — it goes live once the guest in it has agreed to public sharing too.'}
        </p>
      ) : null}
      {showcaseError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          {showcaseError === 'missing_photo'
            ? 'That snippet is no longer in your Memories.'
            : 'Could not change that — please try again.'}
        </p>
      ) : null}

      {faceTagging ? (
        faceTagging === 'error' ? (
          <p className={bad}>
            <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
            Could not change face matching — please try again.
          </p>
        ) : (
          <p className={ok}>
            <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {faceTagging === 'off'
              ? 'Face matching is off for your event. Guests can still be tagged by scanning a QR.'
              : 'Face matching is on. Guests who add a selfie get their photos found for them.'}
          </p>
        )
      ) : null}

      {vendorMedia ? (
        vendorMedia === 'error' ? (
          <p className={bad}>
            <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
            Could not change that — please try again.
          </p>
        ) : (
          <p className={ok}>
            <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {vendorMedia === 'hidden'
              ? 'Your suppliers’ photos are hidden from your Memories.'
              : 'Your suppliers’ photos are showing in your Memories.'}
          </p>
        )
      ) : null}

      {guestCameras ? (
        guestCameras === 'error' ? (
          <p className={bad}>
            <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
            Could not change when guests can shoot — please try again.
          </p>
        ) : (
          <p className={ok}>
            <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {guestCameras === 'early'
              ? 'Guests can shoot before your event day as well.'
              : 'Guests can shoot on your event day.'}
          </p>
        )
      ) : null}

      {preserveSet ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {preserveSet === 'released'
            ? 'Released — this one becomes a smaller copy after your event. It stays in your Memories.'
            : 'Saved — this one stays at full size.'}
        </p>
      ) : null}
      {preserveError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          {preserveError === 'already_compressed'
            ? 'That one is already a smaller copy — its full-size original has been replaced, and that cannot be undone.'
            : preserveError === 'not_found'
              ? 'That photo is no longer in your Memories.'
              : 'Could not save that choice — please try again.'}
        </p>
      ) : null}

      {/* ⛔ A RETIRED CAMERA SALE, REFUSED (2026-10-23) — an old page posting the guest-camera tier or a crew
          camera lands here, told in one sentence what Papic sells now, and is told nothing was charged. */}
      {papicError === PAPIC_CAMERA_SALE_REFUSED || limitedError === PAPIC_CAMERA_SALE_REFUSED ? (
        <p className={neutral}>
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          {PAPIC_CAMERA_SALE_REFUSED_WORDS}
        </p>
      ) : papicError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          Something went wrong — please try again.
        </p>
      ) : limitedError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          Something went wrong — please try again.
        </p>
      ) : null}

      {driveConnected ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Google Drive connected{connectedAccount ? ` — ${connectedAccount}` : ''}.
          Your Setnayan folder is ready in your Drive.
        </p>
      ) : null}

      {driveDisconnected ? (
        <p className={neutral}>
          <Unlink2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          Google Drive disconnected. Storage is back on Setnayan.
        </p>
      ) : null}

      {driveError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          <span>
            Google Drive connection failed (
            <span className="font-mono text-xs">{driveError}</span>). Try again, or
            contact support.
          </span>
        </p>
      ) : null}

      {allotmentSet ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {allotmentSet === 'released'
            ? 'Every limit is lifted — the whole pot is open to everyone now.'
            : allotmentSet === 'cleared'
              ? 'That guest is no longer named — they share what is left with everyone else.'
              : allotmentSet === '0'
                ? 'Every guest draws from the same pot again, until it runs out.'
                : 'Saved. Your guests can see their own limit on their camera.'}
        </p>
      ) : null}

      {allotmentError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          {allotmentError === 'bad_everyone'
            ? 'A limit of nothing is not a limit, so that number starts at 1. Leave it empty to cap them at an equal share of what is left, or name a guest to stop her taking anything.'
            : allotmentError === 'bad_minimum'
            ? 'A minimum of nothing is not a promise, so that number starts at 1. Leave it empty for no minimum.'
            : allotmentError === 'minimum_above_limit'
            ? 'The least anybody gets cannot be more than the limit you set for everyone — that would promise your guests more than you allow them to take.'
            : allotmentError === 'bad_number'
            ? 'That needs to be a whole number of credits, or empty to let it work itself out.'
            : allotmentError === 'unknown_guest'
              ? 'We could not find that guest on your list.'
              : 'We could not save that. Nothing changed — please try again.'}
        </p>
      ) : null}

      {uploadsOpenSet ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {uploadsOpenSet === '1'
            ? 'Photos can now be added by hand. Each one uses a credit, the same as a camera shot.'
            : 'Adding photos by hand is off. Only what your cameras capture goes into your Memories.'}
        </p>
      ) : null}

      {uploadsReady ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Uploads are on. Add photos and clips from your phone or laptop — each
          one uses a credit, the same as a camera shot.
        </p>
      ) : null}
      {uploadsError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          {uploadsError === 'taken'
            ? 'Someone else is already holding this event’s uploads camera.'
            : uploadsError === 'no_camera'
              ? 'Your uploads camera isn’t ready yet — refresh in a moment.'
              : 'We couldn’t turn uploads on just now. Try again in a moment.'}
        </p>
      ) : null}

      {papicAccessError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          <span>
            {papicAccessError === 'not_a_couple'
              ? 'Only the couple can change this event’s Papic settings.'
              : 'That didn’t go through — try again, or contact support.'}
          </span>
        </p>
      ) : null}
    </div>
  );
}
