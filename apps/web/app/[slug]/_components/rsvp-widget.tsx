import type { EventWords } from '../_lib/event-words';
import { GuestToHostCta } from '@/app/_components/guest-to-host-cta';
import { SubmitButton } from '@/app/_components/submit-button';
import type { PapicFaceMode } from '@/lib/papic-face-mode';
import { submitRsvp } from '../actions';
import type { GuestRow } from '../_lib/types';
import { plusOneSeats } from '@/lib/guests';
import { RsvpPlusOnes } from './rsvp-plus-ones';
import { rsvpAsks, type RsvpAskConfig, type RsvpAskField, type RsvpWords } from '@/lib/rsvp-ask';
import { rsvpWordBridgeKey } from '@/lib/rsvp-stage-shared';
import { SelfieNoThanksConfirm } from './selfie-no-thanks-confirm';
import {
  FACE_TAGGING_FIELD,
  FACE_TAGGING_NO,
  FACE_TAGGING_QUESTION,
  FACE_TAGGING_YES,
  faceTaggingHint,
} from '@/lib/face-tagging-wish';
// Shared with the keepsake ticket so the reply card and the keepsake always
// print the SAME Nº for a given guest.
import { stubNo } from './pahina-keepsake';
import { TERMS_FIELD } from '@/lib/terms-agreement';
import type { RsvpAnswer } from '@/lib/guest-one-path';
import { RsvpOneAtATime } from './rsvp-one-at-a-time';
import { RsvpOneAtATimeLive } from './rsvp-canvas-bridge';
import { RsvpQuestionHeader, RsvpStyledAnswers, RsvpTicketHeader } from './rsvp-styles';
import Link from 'next/link';
import { formatCount } from '@/lib/format-number';

/**
 * MAKES THE MOBILE BOX REQUIRED WHILE "ATTENDING" IS PICKED. Inline and
 * server-rendered on purpose — the form is a server component and the guest
 * bundle has no headroom for client state — and finding its own form through
 * `document.currentScript` keeps it a no-op anywhere it is not mounted. With the
 * script absent (a client-side navigation does not run inline scripts) the
 * server-side refusal in `submitRsvp` is the backstop.
 */
const MOBILE_REQUIRED_JS =
  "(function(){var s=document.currentScript,f=s&&s.closest('form'),m=f&&f.querySelector('#contact_mobile');if(!m)return;function y(){var r=f.querySelector('input[name=\"rsvp_status\"][value=\"attending\"]');m.required=!!(r&&r.checked)}f.addEventListener('change',y);y()})()";

export function RsvpWidget({
  guest,
  eventId,
  eventPublicId,
  faceMode,
  flash = null,
  replyLocked = false,
  profileDetails = null,
  words,
  doorAction,
  askTagging = false,
  hostPitch = false,
  ask = {},
  gate = null,
  termsOnSend = false,
  oneAtATime = false,
  previewEveryQuestion = false,
  answerWords = null,
  sceneStyle = null,
}: {
  /**
   * 📝 The couple's own YES / NO wording (the RSVP stage, owner 2026-09-30 —
   * `rsvp_ask_config.words`, `readRsvpWords`). DISPLAY ONLY: the radios still
   * post `attending` / `declined`. Absent = today's wording.
   */
  answerWords?: RsvpWords | null;
  /**
   * 🎨 THE SCENE'S STYLE (owner 2026-09-29): `reply-card` (this card, the
   * default) · `question` · `ticket` (`rsvp-styles.tsx`). A style changes the
   * header and the look of the answers ONLY — same questions, same
   * order, same action, the one-at-a-time switch and the Privacy Notice kept.
   */
  sceneStyle?: string | null;
  /**
   * The Maker's RSVP canvas (a host looking at the SAMPLE guest): every
   * switched-on question is shown, none waiting on an "attending" tap — so
   * each switch visibly adds or removes its question (owner 2026-09-27).
   */
  previewEveryQuestion?: boolean;
  /**
   * THE KEY GATE's verdict (lib/guest-one-path.ts `rsvpGate`), on the RSVP page
   * only. When the ANSWER is already on record — the couple marked them
   * attending, or a question was switched on after they replied — the card
   * asks ONLY what is missing (owner 2026-09-26: "a question added later is
   * asked alone") and carries everything else through as it is stored.
   */
  gate?: { missing: RsvpAnswer[]; coupleMarked: boolean } | null;
  /**
   * The RSVP page's Terms tick (owner 2026-09-27: "Terms tick on the RSVP Send
   * step"): unticked, REQUIRED, the `/signup` clickwrap (lib/terms-agreement.ts).
   * Saving to an account is the NEXT screen's one button, never a decision on
   * this one.
   */
  termsOnSend?: boolean;
  /**
   * "Ask one question at a time" (owner 2026-09-27, the ONE switch on the RSVP
   * scene): one question per screen with progress and Back, for elders. Read
   * from `rsvp_ask_config.oneAtATime`. Progressive: without script the page is
   * the one scrolling form it always was.
   */
  oneAtATime?: boolean;

  words: EventWords;
  guest: GuestRow;
  eventId: string;
  eventPublicId: string;
  /** Effective face-tag mode — passed to the selfie so mode_b skips the embedder. */
  faceMode: PapicFaceMode;
  /** Did the last attempt land? Rendered at the TOP of the form, because an
   *  error at the bottom is below the fold on a phone and the whole point is
   *  that the guest must not walk away thinking they replied. */
  flash?: { tone: 'ok' | 'error'; text: string } | null;
  /**
   * The guest list is final, so the GOING-OR-NOT answer is frozen (owner
   * 2026-08-20). Everything else on this card stays open.
   *
   * 🔑 THIS FORM IS NOT A HEADCOUNT — it is five things, and only one of them
   * is the count: the answer · the selfie that makes their photos findable ·
   * their meal · their dietary notes · a note to the host. The list finalizes
   * about two weeks out, which is exactly when "nut allergy" and "vegetarian"
   * matter MOST. Closing the whole card to freeze the count would take the
   * allergy box away from a caterer's last fortnight.
   *
   * The database already drew this line and drew it correctly: its post-lock
   * guard blocks only count-affecting writes and lets meal, photo and seating
   * through by design. This prop makes the screen agree with it.
   *
   * When true no `rsvp_status` control is rendered AT ALL — the answer cannot
   * be posted, rather than being posted and refused.
   */
  replyLocked?: boolean;
  /**
   * This person's OWN saved answers (owner 2026-08-21). Used ONLY as a default
   * where they have not answered for THIS event — so somebody invited to their
   * fourth wedding is not typing "nut allergy" for the fourth time.
   *
   * 🔒 NEVER AN OVERRIDE. `guest.*` wins whenever it holds anything: the answer
   * they gave HERE is the one the caterer cooks from, and a stale profile must
   * not quietly replace it.
   */
  profileDetails?: {
    mealPreference: string | null;
    dietaryRestrictions: string | null;
    email: string | null;
    phone: string | null;
    displayName: string | null;
  } | null;
  /**
   * DOOR 02 · REPLY of the invite arrival (lib/invite-arrival.ts) passes its own
   * save here — `submitInviteReply`, which sends the sign-in link and then calls
   * this card's own `submitRsvp`. Present = the DOOR variant of this card: the
   * same fields, the same reveals and the same write, without the site's
   * letterpress card head and without the start-free pitch — a door carries one
   * decision, and this card is already inside one.
   *
   * 🔑 PASSED IN, NOT IMPORTED. The door's action lives in a server-only module
   * chain; importing it here would drag that chain into every test that renders
   * this card. The card stays one component with one set of fields, so the site
   * and the door can never drift apart.
   */
  doorAction?: (formData: FormData) => Promise<void>;
  /*
   * 📵 NO REPLY CARD DRAWS A CAMERA (owner 2026-09-30 — DECISION_LOG "THE
   * TAGGING QUESTION IS ASKED AT RSVP; THE SELFIE IS TAKEN ON THE DAY").
   * `offerSelfie` is GONE, not defaulted off: the Event Hub card used to pass
   * `offerSelfie={faceTaggingAskable}` and so enrolled a face weeks before the
   * day (`submitRsvp` source 'rsvp_selfie'). The selfie is taken only by the
   * day-of catch (`day-of-face-enroll.tsx`), only from a guest who said Yes,
   * and only while the event's Papic is open. A prop that could turn the
   * camera back on would be a door the rule has to keep shut by hand.
   */
  /**
   * 🏷 THE QUESTION WITHOUT THE CAMERA — on EVERY reply card (the invitation's
   * reply page and the Event Hub's): ask "Want to be tagged in the photos?" and
   * save the answer; the selfie is taken on the day, only from a guest who said
   * Yes (`dayOfFaceCatchShows`). Pass `askable` from `lib/face-tagging-gate.ts`
   * — false unless the event's Papic is active and open and face tagging runs.
   */
  askTagging?: boolean;
  /**
   * The invitation is already linked to their account — only then may the
   * "planning your own celebration?" line show (`hostPitchShows`). Before the
   * link it was one more account prompt in front of the one that matters.
   */
  hostPitch?: boolean;
  /**
   * WHAT DO YOU WANT TO ASK YOUR GUESTS? (owner 2026-09-25, Event Hub Maker
   * Details panel). The couple's on/off for this form's OWN questions —
   * `attending` is not a key here, since it is always on. Sparse: an absent
   * key is ON, so an event that never opens the panel renders byte-identically
   * to before this prop existed. `submitRsvp` re-reads the same config and
   * ignores an off field server-side — this prop only decides what RENDERS.
   */
  ask?: RsvpAskConfig;
}) {
  const action = doorAction ?? submitRsvp.bind(null, eventId, guest.guest_id);
  const onDoor = Boolean(doorAction);

  // The answer is on record and only details are missing → ask ONLY those.
  if (gate && gate.missing.length > 0 && !gate.missing.includes('attending') && !replyLocked) {
    return (
      <RsvpFocusForm
        action={action}
        guest={guest}
        missing={gate.missing}
        coupleMarked={gate.coupleMarked}
        flash={flash}
        oneAtATime={oneAtATime}
        profileDetails={profileDetails}
        theOrganizer={words.theOrganizer}
      />
    );
  }
  /* 🗳 THE RSVP STAGE'S CANVAS (owner 2026-09-30: every edit shows at once):
     on the Maker's sample every question is DRAWN — one the couple switched off
     is hidden and marked (`data-rsvp-ask`), so flipping its switch shows or
     hides it on the tap, with no new page (`rsvp-canvas-bridge.tsx`). A guest's
     page never takes this arm: it draws only what is asked, as before. */
  const asked = (field: RsvpAskField) => previewEveryQuestion || rsvpAsks(ask, field);
  const canvasAsk = (field: RsvpAskField) =>
    previewEveryQuestion ? { 'data-rsvp-ask': field, hidden: !rsvpAsks(ask, field) || undefined } : {};
  const askPlusOnes = asked('plus_ones');
  const askMeal = asked('meal');
  const askDietary = asked('dietary');
  const askNote = asked('note');
  const askMobile = asked('mobile');
  const askSong = asked('song_request');
  // The Maker's canvas shows EVERY switched-on question at once — the couple is
  // looking at what they ask, not answering it, so nothing waits on "attending".
  const revealAll = previewEveryQuestion;
  // Meal + dietary share one reveal wrapper below — hide it outright when
  // BOTH are off, rather than rendering an empty grid with nothing inside it.
  const askMealOrDietary = askMeal || askDietary;
  // With the plus-ones' own "Meal preference" just above, the guest's own box
  // says whose it is (prototype rsvp_plus_ones_2026-09-29.html, frame A).
  const bringsPlusOnes = askPlusOnes && guest.plus_one_allowed && !replyLocked;
  // The key gate found no number on record and the couple asks for one — the
  // page cannot be left without it (owner 2026-09-26: "filled first until they
  // are all answered").
  //
  // 📱 …AND IT IS ASKED HERE, IN THE REPLY, FOR ANYONE WHO SAYS YES (owner
  // walk-through 2026-10-01). The Event Hub's key gate (`rsvpGate`) will not let a
  // guest in without the number the couple asked for, so a sheet that showed
  // Mobile unmarked let Save succeed and then bounced the guest to a second
  // screen ("One more thing") for the very box they had just walked past. Now the
  // box says it is required the moment "attending" is picked, and the browser
  // will not send without it. A decline is never asked for one — the gate's own
  // rule — so the requirement follows the answer (`MOBILE_REQUIRED_JS`), and
  // `submitRsvp` refuses a yes without it for the clients that skip the script.
  // Not on the Maker's canvas (nobody answers there), not on a closed list.
  const mobileRequiredOnYes = askMobile && !replyLocked && !previewEveryQuestion;
  const requireMobile = askMobile && Boolean(gate?.missing.includes('mobile'));

  const mobileField = (
    <>
      <Field
        id="contact_mobile"
        label="Mobile"
        mark={mobileRequiredOnYes ? ' (required)' : null}
        type="tel"
        autoComplete="tel"
        required={requireMobile && !mobileRequiredOnYes}
        defaultValue={guest.mobile ?? profileDetails?.phone ?? ''}
        placeholder="+63 …"
      />
      {mobileRequiredOnYes ? (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: server-rendered, no client bundle
        <script dangerouslySetInnerHTML={{ __html: MOBILE_REQUIRED_JS }} />
      ) : null}
    </>
  );
  // The contact boxes, declared ONCE so the folded and unfolded arms can never
  // drift apart. Both arms render them, so both POST them.
  //
  // 📵 NO EMAIL BOX (owner 2026-09-29, DECISION_LOG "NO EMAIL TO GUESTS — THE QR
  // AND THE LINK DO EVERYTHING": *"No email. Either use the qr and link only"*).
  // Nothing emails a guest any more, so the reply does not collect an address
  // it would never use — and `submitRsvp` no longer reads one. Mobile stays, and
  // only when the couple switched it on.
  const contactFields = (
    <>
      {askMobile ? (
        // 🗳 Wrapped only on the Maker's canvas (to show / hide on its switch).
        previewEveryQuestion ? <div {...canvasAsk('mobile')}>{mobileField}</div> : mobileField
      ) : null}
      <Field
        id="contact_display_name"
        label="What should we call you? (optional)"
        defaultValue={guest.display_name ?? profileDetails?.displayName ?? ''}
        placeholder={guest.first_name}
      />
    </>
  );

  /**
   * "ALL DETAILS ARE FILLED" — owner, 2026-08-21: a guest whose details we
   * already hold is shown a one-line summary, not boxes.
   *
   * 📵 Email is no longer one of them (owner 2026-09-29, no email to guests), so
   * "filled" now means: the mobile is known when the couple asks for it. With
   * mobile off the only box left is the optional "what should we call you",
   * which never needs to unfold on its own.
   * ⚠ Meal and dietary are NOT required. "No preference" and "no allergies" are
   * real answers, and a guest with neither would otherwise be shown the boxes
   * forever for facts that have nothing to add.
   */
  const knownMobile = (guest.mobile ?? profileDetails?.phone ?? '').trim();
  const detailsAlreadyKnown = !askMobile || knownMobile !== '';
  const knownName = (guest.display_name ?? profileDetails?.displayName ?? '').trim();
  const knownSummary = [knownName || `${guest.first_name} ${guest.last_name}`.trim(), askMobile ? knownMobile : '']
    .filter(Boolean)
    .join(' · ');

  // "Want to be tagged in the photos?" — defaulted from the guest's stored
  // answer, never pre-set otherwise (a default would be an answer nobody gave).
  const taggingWish = guest.face_tagging_wanted ?? null;
  const tagQuestion = (
    <>
      <fieldset data-rsvp-step data-face-tagging-choice className="space-y-2">
        <legend className="mb-1 font-serif text-xl text-ink">{FACE_TAGGING_QUESTION}</legend>
        <p className="pb-1 text-xs text-ink/60">{faceTaggingHint(faceMode, words.theOrganizer, { onTheDay: true })}</p>
        {(
          [
            { key: 'yes', label: FACE_TAGGING_YES, on: taggingWish === true },
            { key: 'no', label: FACE_TAGGING_NO, on: taggingWish === false },
          ] as const
        ).map((option) => (
          <label
            key={option.key}
            className="flex min-h-12 cursor-pointer items-center rounded-full bg-ink/[0.05] px-5 font-pahina text-base italic leading-tight text-ink transition-colors has-[:checked]:bg-ink has-[:checked]:text-cream"
          >
            <input
              type="radio"
              name={FACE_TAGGING_FIELD}
              value={option.key}
              defaultChecked={option.on}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
        {/* 🗑 One confirm before a "No" deletes a selfie already given (owner
            2026-09-29, OWNER ANSWERS (3)) — only for a guest who has one. */}
        {guest.photo_source === 'selfie' ? <SelfieNoThanksConfirm /> : null}
      </fieldset>
      {/* 📵 No camera on a reply card: the selfie waits for the day. */}
    </>
  );
  /* 🎨 The scene's style — only the header and the answers' look change. */
  const answerStyle = sceneStyle === 'question' || sceneStyle === 'ticket' ? sceneStyle : 'reply-card';
  const admitCount = 1 + (guest.plus_one_allowed ? plusOneSeats(guest) : 0);
  // The celebratory labels are the spec's reply-card wording and stay
  // byte-identical. A wake cannot ask anyone to "joyfully accept" — its labels
  // answer the only question a mourner is being asked. ONE list, drawn by every
  // style, so no style can offer a different answer.
  const answerOptions = words.solemn
    ? ([
        { key: 'attending', label: 'Will be there' },
        { key: 'declined', label: 'Unable to come' },
      ] as const)
    : ([
        { key: 'attending', label: 'Joyfully accepts' },
        { key: 'declined', label: 'Regretfully declines' },
      ] as const);
  // 📝 The couple's own YES / NO words (the RSVP stage) — every style says them.
  const answerShown = answerOptions.map((o) => ({ ...o, label: answerWords?.[o.key] ?? o.label }));

  return (
    <form action={action} className="rsvp-form space-y-6">
      {/* FIRST in the form: the one-question progress sits above everything
          the guest reads (rsvp-one-at-a-time.tsx, "THE SCREEN'S ORDER"). */}
      {previewEveryQuestion ? <RsvpOneAtATimeLive initial={oneAtATime} /> : oneAtATime ? <RsvpOneAtATime /> : null}
      {flash ? (
        <p
          role={flash.tone === 'error' ? 'alert' : 'status'}
          className={`text-sm font-medium ${flash.tone === 'error' ? 'text-terracotta-700' : 'text-ink/80'}`}
        >
          {flash.text}
        </p>
      ) : null}
      {/* The tagging question (class `selfie-reveal`, kept for the rule's
          sake) reveals once the guest picks "attending" — pure CSS :has(), the
          same pattern as the has-[:checked] ring on the radios below, so this
          stays a server component with no client state.
          Omitted when the answer is locked: there is no radio to watch, so the
          rule is dead weight AND its selector text is the only `rsvp_status`
          left in the markup, which reads to any scan like a live control. */}
      {replyLocked ? null : (
        <style>{`.rsvp-form .selfie-reveal,.rsvp-form .attending-reveal{display:none}.rsvp-form:has(input[name="rsvp_status"][value="attending"]:checked) .selfie-reveal,.rsvp-form:has(input[name="rsvp_status"][value="attending"]:checked) .attending-reveal{display:block}.rsvp-form .attend-mark{display:none}.rsvp-form:has(input[name="rsvp_status"][value="attending"]:checked) .attend-mark{display:inline}`}</style>
      )}

      {/* On the invite arrival's Reply door the door IS the card — its eyebrow,
          the guest's name and the rail already say what this is. */}
      {onDoor ? null : answerStyle === 'question' ? (
        <RsvpQuestionHeader
          firstName={guest.first_name}
          question={words.solemn ? 'Will you be with us?' : 'Will you be there?'}
          admitCount={admitCount}
          pill={<RsvpPill status={guest.rsvp_status} />}
        />
      ) : answerStyle === 'ticket' ? (
        <RsvpTicketHeader
          guestName={knownName || `${guest.first_name} ${guest.last_name}`.trim()}
          stubNumber={stubNo(guest.guest_id)}
          admitCount={admitCount}
          pill={<RsvpPill status={guest.rsvp_status} />}
        />
      ) : (
        <>
          {/* THE REPLY CARD (design 2026-07-25 §7) — the only thing on the page that
              is a card in real life, so it is the only thing still shaped like one:
              heavier paper-deep stock, letterpress "RSVP", a gild ticket stub, and
              the perforation rule. Everything else on the site is a plate. */}
          <header className="space-y-3" data-rsvp-context={oneAtATime ? '' : undefined}>
            <div className="flex items-start justify-between gap-4">
              <p className="pahina-eyebrow">
                <span>Reply</span>
              </p>
              <RsvpPill status={guest.rsvp_status} />
            </div>
            <div className="flex items-end justify-between gap-4">
              <p className="pahina-letterpress font-pahina text-[3.2rem] font-light leading-[0.9] tracking-tight text-ink">
                RSVP
              </p>
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-gild">
                Nº {stubNo(guest.guest_id)}
              </p>
            </div>
            <hr className="pahina-perforation" />
          </header>
        </>
      )}

      {/* Seat reservation: confirming attendance holds the guest's place (the
          couple seats them later). Show the reassurance whenever they're
          attending — this is the "your place is reserved" confirmation. */}
      {guest.rsvp_status === 'attending' ? (
        <InvitationFacts fold={oneAtATime}>
          <p className="flex items-center gap-2.5 text-sm text-ink/80">
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-gild" />
            {words.solemn
              ? 'Your place is noted — thank you for being with the family.'
              : 'Your place is reserved — we can’t wait to celebrate with you.'}
          </p>
          {/* No pitch on a solemn page: "Planning your own celebration? Start
              free" under a wake RSVP is the defect class itself. */}
          {onDoor || !hostPitch ? null : words.solemn ? null : (
            <GuestToHostCta
              surface="rsvp_confirmation"
              eventId={eventId}
              eventPublicId={eventPublicId}
              headline="Planning your own event?"
              sub="Start free on Setnayan — no card needed."
            />
          )}
        </InvitationFacts>
      ) : null}

      {/* TWO quiet outlined options; the chosen one takes the palette's DEEP
          accent fill. Labels are the spec's reply-card wording — the `key`
          values (and therefore the server action's contract) are unchanged.
          ⚖ NO MIDDLE ANSWER (owner 2026-09-30: "for now. let us fix the RSVP
          remove the maybe"). A guest is offered yes or no, nothing else; the
          couple's own Guest list tools still see and set 'maybe'. A guest
          ALREADY saved as 'maybe' keeps that row — but no radio matches it, so
          nothing is preselected, and the answer is REQUIRED for them so a Save
          cannot post an empty answer and be dropped. `submitRsvp` refuses a
          NEW 'maybe' from a crafted post (`?rsvp=choose`). */}
      {replyLocked ? (
        <LockedAnswer status={guest.rsvp_status} />
      ) : (
        answerStyle === 'question' || answerStyle === 'ticket' ? (
          <RsvpStyledAnswers
            sceneStyle={answerStyle}
            legend={words.solemn ? 'Will you be with us?' : 'Will you be there?'}
            options={answerShown}
            current={guest.rsvp_status}
            required={termsOnSend || guest.rsvp_status === 'maybe'}
            legendShown={onDoor}
          />
        ) : (
        <fieldset data-rsvp-step className="space-y-2">
          {/* 2a · THE FABLE WORDS (owner 2026-09-30, "APPROVED — THE FABLE DESIGNS…"):
              "Your reply" over "Will you celebrate with us?". */}
          <legend className="mb-3">
            <span className="block text-xs font-semibold uppercase tracking-[0.26em] text-mulberry">Your reply</span>
            <span className="mt-2 block font-serif text-[32px] font-medium leading-[1.1] tracking-tight text-ink">
              {words.solemn ? 'Will you be with us?' : 'Will you celebrate with us?'}
            </span>
          </legend>
          {answerOptions.map((option) => (
            <label
              key={option.key}
              /* 🔘 Look › Buttons reaches the answers through this hook (globals.css). */
              data-rsvp-answer=""
              className="flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-white px-5 text-sm font-medium leading-tight text-ink ring-[1.5px] ring-ink transition-colors has-[:checked]:bg-ink has-[:checked]:text-cream"
            >
              <input
                type="radio"
                name="rsvp_status"
                value={option.key}
                defaultChecked={guest.rsvp_status === option.key}
                required={termsOnSend || guest.rsvp_status === 'maybe' || undefined}
                className="sr-only"
              />
              {/* 📝 The couple's words for YES / NO (the value posted is unchanged). */}
              <span data-rsvp-word={rsvpWordBridgeKey(option.key)}>
                {answerWords?.[option.key] ?? option.label}
              </span>
            </label>
          ))}
        </fieldset>
        )
      )}

      {/* ⚠ THE QUESTION IS REVEALED BY `:has(rsvp_status=attending:checked)`.
          With the answer locked there IS no radio, so that selector can never
          match — locked + attending renders it outright. ⚖ ONE QUESTION, NO
          CAMERA (owner 2026-09-30): "Yes, tag me" is stored, and the selfie is
          asked on the day, only while the event's Papic is open. */}
      {!askTagging ? null : replyLocked ? (
        guest.rsvp_status === 'attending' ? (
          <div className="space-y-6">{tagQuestion}</div>
        ) : null
      ) : (
        <div className="selfie-reveal space-y-6">{tagQuestion}</div>
      )}

      {/* ── WHO ARE YOU BRINGING ────────────────────────────────────────────
          The card could not ask this before, and the reason was not a missing
          box: it had no way to know the guest was ALLOWED one. `plus_one_allowed`
          was never selected by the guest-side loader and had no slot on GuestRow,
          so the widget was plus-one-BLIND. That fact is threaded now.

          ⚠ Shown only when the host allowed it, and only to a guest who is
          coming — revealed by the same CSS-only `:has()` rule the selfie block
          already uses, so this adds no client JS and no new state.

          ⚖ A BLANK BOX CHANGES NOTHING, deliberately, exactly like the contact
          boxes above: leaving it empty is "I have not decided yet", which is the
          state they were already in. Removing a +1 is the HOST's action — it
          deletes a real guest row with its own QR, and a guest should not do
          that by clearing a field. */}
      {/* ⚙ ASK TOGGLE (owner 2026-09-25): a MASTER switch on top of the
          per-guest `plus_one_allowed` above — turning it off hides the name
          box for every guest the couple already allowed one, without
          touching who is allowed (a host action, done on the Guest list). */}
      {askPlusOnes && guest.plus_one_allowed && !replyLocked ? (
        <div id="plus-ones" data-rsvp-step {...canvasAsk('plus_ones')} className={`${revealAll ? '' : 'attending-reveal '}scroll-mt-6 space-y-1.5`}>
          {/* One short set per seat + one "Filling in for ▾" switcher
              (owner 2026-09-29) — its own file, so this card only mounts it. */}
          <RsvpPlusOnes
            count={plusOneSeats(guest)}
            seats={guest.plus_one_seats}
            legacyName={guest.plus_one_name}
            theOrganizer={words.theOrganizer}
            askMeal={askMeal}
            askDietary={askDietary}
            question={oneAtATime}
            youName={oneAtATime ? null : guest.display_name || `${guest.first_name} ${guest.last_name}`.trim()}
          />
        </div>
      ) : null}

      {/* ── MEAL + DIETARY: ONLY FOR SOMEBODY WHO IS COMING ──────────────────
          Owner, 2026-09-11, walking the Reply door: a decline must not go on to
          ask for the rest. A guest who is not coming does not eat, and a form
          that keeps asking after "no" reads as if the answer was not heard.

          ⚠ NO NEW MECHANISM. This rides the `attending-reveal` class the
          plus-one block already uses — one CSS `:has()` rule, declared once at
          the top of this form, no client state, still a server component. The
          wrapper exists because the reveal sets `display:block`, which would
          flatten the grid if the class sat on the grid itself.

          🪤 AND THE CSS IS NOT THE ONLY PATH. With `replyLocked` the reveal rule
          is not rendered AT ALL (there is no radio to watch), so the class is
          inert and the boxes show — which is right, and deliberate: the list
          finalizes about two weeks out, exactly when "nut allergy" matters most
          (see the docblock on `replyLocked`). The one case that must still be
          silenced there is a guest whose frozen answer IS "declined" — the same
          shape as the locked selfie arm directly above.

          WHAT SURVIVES A DECLINE (orchestrator's call on the owner's behalf,
          2026-09-11, reversible): the contact boxes and the note to the host.
          The host still needs a way to reach them, the email is also their
          sign-in, and a declining guest most often wants to leave a message.

          ⚙ ASK TOGGLE (owner 2026-09-25): the couple may turn either box off
          on its own — the block itself disappears only when BOTH are off,
          rather than rendering an empty grid with nothing inside it. */}
      {!askMealOrDietary || (replyLocked && guest.rsvp_status === 'declined') ? null : (
        <div className={replyLocked || revealAll ? undefined : 'attending-reveal'}>
          <div className="space-y-6">
            {askMeal ? (
              <div data-rsvp-step {...canvasAsk('meal')}>
              <Select
                id="meal_preference"
                label={bringsPlusOnes ? 'Your meal preference' : 'Meal preference'}
                question={oneAtATime}
                defaultValue={guest.meal_preference ?? profileDetails?.mealPreference ?? 'no_preference'}
                options={[
                  ['no_preference', 'No preference'],
                  ['beef', 'Beef'],
                  ['chicken', 'Chicken'],
                  ['fish', 'Fish'],
                  ['vegetarian', 'Vegetarian'],
                  ['vegan', 'Vegan'],
                  ['kids', 'Kids'],
                ]}
              />
              </div>
            ) : null}
            {askDietary ? (
              <div data-rsvp-step {...canvasAsk('dietary')}>
              <Field
                id="dietary_restrictions"
                label={bringsPlusOnes ? 'Your dietary notes' : 'Dietary notes'}
                question={oneAtATime}
                defaultValue={guest.dietary_restrictions ?? profileDetails?.dietaryRestrictions ?? ''}
                placeholder="halal · nut allergy · …"
              />
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* 🎵 THE SONG (owner 2026-09-27 — "a switch that does nothing is a
          lie"): the "Song request" switch now asks on the RSVP itself, one
          question of its own, saved into the couple's song list through the
          SAME door the day-of card uses (`guest_submit_song_request`). Optional;
          a blank box asks nothing. Only for somebody who is coming. */}
      {askSong && !replyLocked ? (
        <div data-rsvp-step {...canvasAsk('song_request')} className={revealAll ? undefined : 'attending-reveal'}>
          <div className="space-y-4">
            <Field id="song_title" label="A song to get you dancing (optional)" question={oneAtATime} placeholder="Song" />
            <Field id="song_artist" label="Who sings it?" placeholder="Artist" />
          </div>
        </div>
      ) : null}

      {/* ⚙ ASK TOGGLE (owner 2026-09-25): "Note to you" off. */}
      {askNote ? (
        <div data-rsvp-step {...canvasAsk('note')} className="space-y-1.5">
          <label htmlFor="guest_note" className={questionClass(oneAtATime)}>
            A note to {words.theOrganizer} (optional)
          </label>
          {/* ⚠ `guest_note`, NOT `notes`. Until 2026-08-06 this box was bound to
              `guests.notes` — the COUPLE'S PRIVATE note about this guest — so it
              displayed to them whatever the couple had written ("seat away from
              Tita"), and submitting the RSVP overwrote it. Never bind a
              guest-facing field to `notes`. */}
          {/* The label one line above already uses the event's own words; this
              placeholder was hardcoded to a sample couple, so EVERY event — a
              birthday, a graduation, a debut — asked its guests to write to
              "Maria & Juan". Even the seeded sample is Maria & JOSE, so the demo
              was wrong by a name. */}
          <textarea
            id="guest_note"
            name="guest_note"
            rows={3}
            defaultValue={guest.guest_note ?? ''}
            className="input-field min-h-[88px] resize-y py-2"
            placeholder={`Anything you'd like ${words.theOrganizer} to know.`}
          />
        </div>
      ) : null}

      {/* ── HOW THEY REACH YOU ──────────────────────────────────────────────
          🔴 THESE THREE BOXES DID NOT EXIST. The host's own guest page carries
          Email, Mobile and Display name, and NOTHING anywhere in the product
          let the guest supply any of them — so a host without a number had to
          leave the app and go and ask for it, for every guest.
          Owner, 2026-08-21, pointing at that page: "these are all the
          information we want to fill up."
          📵 The EMAIL box went on 2026-09-29 (owner: "No email. Either use the
          qr and link only") — nothing emails a guest, so none is collected.

          🔒 First and last name stay HOST-ONLY, deliberately. The link that
          reaches this card is printed on a poster, and a stranger who can
          rename a seat-holder is the exact harm `seedBindAllowed` was hardened
          against on 2026-08-01. What to CALL you is a label; who you ARE is not
          a label, and only the host sets it.

          ⚠ NOT FROZEN when the guest list closes. Only the ANSWER freezes
          (owner, 2026-08-20) — a phone number corrected the week of the event
          is worth more then than at any other time.

          📦 AND IT FOLDS WHEN WE ALREADY KNOW. Owner, 2026-08-21: "if they have
          an account, and all details are filled, all they need is to accept the
          invitation." A signed-in guest whose profile already carries their
          contact details is shown their answer and a ONE-LINE SUMMARY of what
          we hold — not five boxes asking what the app can already read.

          ⚠ AND THE SUMMARY NAMES WHAT IS BEHIND IT, or this repeats #4683 — the
          guest's own message sat in a drawer whose label advertised something
          else, and the host never saw it. Everything folded away is listed on
          the line, and the inputs still POST: <details> hides, it does not
          disable. */}
      {detailsAlreadyKnown ? (
        <details data-rsvp-step>
          <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm text-ink/80 hover:text-ink">
            <span className="min-w-0">
              <span className="block font-medium text-ink">Your details are filled in</span>
              <span className="mt-0.5 block truncate text-xs text-ink/70">{knownSummary}</span>
            </span>
            <span className="shrink-0 text-xs font-medium text-mulberry">Change</span>
          </summary>
          <div className="space-y-4 pt-2">{contactFields}</div>
        </details>
      ) : (
        <div data-rsvp-step className="space-y-1.5">
          <span className={questionClass(oneAtATime)}>
            How {words.theOrganizer} can reach you
          </span>
          {contactFields}
        </div>
      )}

      <div data-rsvp-step className="space-y-5">
      {termsOnSend ? (
        /* THE RSVP PAGE's last step (owner 2026-09-27): the Terms tick, then ONE
           button. Unticked and required — the browser will not send without it,
           and `submitInviteReply` refuses a POST that lacks it.
           🔑 NOT A STEP OF ITS OWN — it already sits inside the Send step that
           opens above. A step inside a step is counted twice by "one question
           at a time": the outer one is shown with the inner one hidden, and the
           guest meets a BLANK "8 of 9" (owner, 2026-09-28). Pinned by
           the-rsvp-page-follows-the-maker.test.ts § 9. */
        <div className="space-y-5">
          <TermsTick />
          <SubmitButton className="button-primary min-h-[48px] w-full" pendingLabel="Sending…">
            Send my reply
          </SubmitButton>
        </div>
      ) : (
      <SubmitButton
        className="button-primary min-h-[44px] w-full sm:w-auto"
        pendingLabel={replyLocked ? 'Saving details…' : 'Saving RSVP…'}
      >
        {replyLocked ? (
          'Save details'
        ) : (
          'Save RSVP'
        )}
      </SubmitButton>
      )}
      </div>
    </form>
  );
}

/**
 * THE TERMS TICK on the RSVP page (owner 2026-09-27) — the `/signup` clickwrap
 * (lib/terms-agreement.ts): one name (`TERMS_FIELD`), never pre-ticked, and
 * required. A guest who later taps "Not now" on Save has still agreed.
 */
function TermsTick() {
  return (
    <label htmlFor="rsvp_terms" className="flex min-h-[44px] items-start gap-3 text-sm text-ink/80">
      <input
        id="rsvp_terms"
        name={TERMS_FIELD}
        type="checkbox"
        required
        className="mt-0.5 h-5 w-5 shrink-0 accent-terracotta"
      />
      <span>
        I agree to the{' '}
        <Link href="/terms" className="font-medium text-link underline underline-offset-2">
          Terms
        </Link>{' '}
        and the{' '}
        <Link href="/privacy" className="font-medium text-link underline underline-offset-2">
          Privacy Notice
        </Link>
        <span className="mt-0.5 block text-xs font-medium uppercase tracking-[0.14em] text-ink/60">
          Required
        </span>
      </span>
    </label>
  );
}

/**
 * ONLY WHAT IS MISSING (owner 2026-09-26, "SWAP A NON-REPLIER'S SPOT" (2)):
 * *"If they also confirmed via message and not via app, we can set confirmation
 * automatically. when they enter the website, they just need to fill up their
 * details."* — and a question the couple switches on later is asked alone.
 *
 * 🔒 EVERYTHING NOT ASKED IS CARRIED THROUGH AS IT IS STORED. `submitRsvp`
 * writes every field of the card on every save (a blank box writes a blank:
 * `display_name`, `mobile`, the note), so a card that simply OMITTED the boxes
 * it did not ask would erase what the guest or the couple already gave. Each
 * unasked answer rides along as a hidden input holding its stored value.
 *
 * "Not coming after all?" is its own small form — the same save, the answer
 * `declined`, everything else carried through the same way.
 */
function RsvpFocusForm({
  action,
  guest,
  missing,
  coupleMarked,
  flash,
  oneAtATime,
  profileDetails,
  theOrganizer,
}: {
  /** "the couple" / "the family" — the event type's own words. */
  theOrganizer: string;
  action: (formData: FormData) => Promise<void>;
  guest: GuestRow;
  missing: RsvpAnswer[];
  coupleMarked: boolean;
  flash: { tone: 'ok' | 'error'; text: string } | null;
  oneAtATime: boolean;
  profileDetails: {
    mealPreference: string | null;
    dietaryRestrictions: string | null;
    email: string | null;
    phone: string | null;
    displayName: string | null;
  } | null;
}) {
  const askMeal = missing.includes('meal');
  const askMobile = missing.includes('mobile');
  const count = missing.length;
  const carried = (declining: boolean) => (
    <>
      <input type="hidden" name="rsvp_status" value={declining ? 'declined' : guest.rsvp_status} />
      {askMeal && !declining ? null : (
        <input type="hidden" name="meal_preference" value={guest.meal_preference ?? 'no_preference'} />
      )}
      <input type="hidden" name="dietary_restrictions" value={guest.dietary_restrictions ?? ''} />
      <input type="hidden" name="guest_note" value={guest.guest_note ?? ''} />
      {askMobile && !declining ? null : (
        <input type="hidden" name="contact_mobile" value={guest.mobile ?? ''} />
      )}
      <input type="hidden" name="contact_display_name" value={guest.display_name ?? ''} />
    </>
  );
  return (
    <>
      <form action={action} className="rsvp-form space-y-6" data-rsvp-focus>
        {oneAtATime ? <RsvpOneAtATime /> : null}
        {flash ? (
          <p
            role={flash.tone === 'error' ? 'alert' : 'status'}
            className={`border-l-2 px-3 py-2 text-sm ${
              flash.tone === 'error' ? 'border-terracotta text-terracotta-700' : 'border-gild text-ink/80'
            }`}
          >
            {flash.text}
          </p>
        ) : null}
        {guest.rsvp_status === 'attending' ? (
          <div
            className="flex items-center gap-4 border-y border-gild/60 py-4"
            data-rsvp-context={oneAtATime ? '' : undefined}
          >
            <span
              aria-hidden
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-terracotta-700 text-lg text-cream"
            >
              ✓
            </span>
            <p className="font-serif text-lg leading-snug text-ink">
              {coupleMarked
                ? `${theOrganizer.charAt(0).toUpperCase()}${theOrganizer.slice(1)} has you down as `
                : 'You are down as '}
              <span className="font-semibold text-gild">attending</span>
            </p>
          </div>
        ) : null}
        <p className="font-serif text-xl text-ink" data-rsvp-context={oneAtATime ? '' : undefined}>
          {count === 1 ? 'One more thing' : count === 2 ? 'Two more things' : `${formatCount(count)} more things`}
        </p>
        {carried(false)}
        {askMeal ? (
          <div data-rsvp-step>
            <Select
              id="meal_preference"
              label="Meal preference"
              question={oneAtATime}
              defaultValue={profileDetails?.mealPreference ?? 'no_preference'}
              options={[
                ['no_preference', 'No preference'],
                ['beef', 'Beef'],
                ['chicken', 'Chicken'],
                ['fish', 'Fish'],
                ['vegetarian', 'Vegetarian'],
                ['vegan', 'Vegan'],
                ['kids', 'Kids'],
              ]}
            />
          </div>
        ) : null}
        {askMobile ? (
          <div data-rsvp-step>
            <Field
              id="contact_mobile"
              label="Mobile"
              question={oneAtATime}
              type="tel"
              autoComplete="tel"
              required
              defaultValue={profileDetails?.phone ?? ''}
              placeholder="+63 …"
            />
          </div>
        ) : null}
        <div data-rsvp-step className="space-y-5">
          <TermsTick />
          <SubmitButton className="button-primary min-h-[48px] w-full" pendingLabel="Sending…">
            Send
          </SubmitButton>
        </div>
      </form>
      {guest.rsvp_status === 'attending' ? (
        <form action={action} className="mt-3 text-center" data-rsvp-decline>
          {carried(true)}
          <SubmitButton
            overlay={false}
            className="min-h-[44px] text-sm text-ink/70 underline-offset-4 hover:underline"
            pendingLabel="Saving…"
          >
            Not coming after all?
          </SubmitButton>
        </form>
      ) : null}
    </>
  );
}

/**
 * The frozen answer, where the three choices were. Shows what they said (or
 * that they never said), and why it can no longer move — a control that
 * silently stops working teaches nothing.
 */
function LockedAnswer({ status }: { status: GuestRow['rsvp_status'] }) {
  const said =
    status === 'attending'
      ? 'You said you are coming.'
      : status === 'declined'
        ? 'You said you cannot make it.'
        : status === 'maybe'
          ? 'You were undecided.'
          : 'No reply was received from you.';
  return (
    <div>
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/50">
        Replies are closed
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink/70">
        {said} The guest list is final, so this part can no longer change — but
        everything below is still yours to update.
      </p>
    </div>
  );
}

function RsvpPill({ status }: { status: GuestRow['rsvp_status'] }) {
  // Functional-color exile (§4): the app's green / amber / red status tones are
  // gone. The states now read as quiet mono stamps — the answered one is
  // gild-ruled, the rest are ink. Status labels themselves are unchanged.
  const tone: Record<GuestRow['rsvp_status'], string> = {
    attending: 'border-gild text-gild',
    pending: 'border-ink/20 text-ink/55',
    declined: 'border-ink/25 text-ink/60',
    maybe: 'border-ink/20 text-ink/60',
  };
  const label =
    status === 'attending'
      ? 'Going'
      : status === 'pending'
        // 🔑 THE WORD DESCRIBES THE ANSWER, NOT THE MEMBERSHIP. "Pending" was the
        // only status-shaped element on the page a guest lands on, and it reads
        // as "you are not finished" — when in fact they are on the list and the
        // seat is theirs. This file already owns the honest wording 28 lines up
        // ("No reply was received from you."), but that arm only renders once
        // the list is frozen. ⚠ Must stay identical to guest-hub-card.tsx's
        // default arm — the two surfaces show one guest one fact and already
        // drifted once ("Pending" vs "RSVP pending"). Pinned by
        // the-status-word-is-about-the-reply.test.ts.
        ? 'No reply yet'
        : status === 'declined'
          ? 'Declined'
          : 'Maybe';
  return (
    <span
      className={`shrink-0 border px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] ${tone[status]}`}
    >
      {label}
    </span>
  );
}

function Field({
  id,
  label,
  defaultValue,
  placeholder,
  type = 'text',
  autoComplete,
  required = false,
  question = false,
  mark = null,
}: {
  /** One question per screen: this label IS the screen's question (its heading). */
  question?: boolean;
  id: string;
  label: string;
  /** Said after the label only while "attending" is picked (`.attend-mark`) — a
   *  requirement that follows the answer, drawn by CSS, so the form stays a
   *  server component. */
  mark?: string | null;
  defaultValue?: string;
  placeholder?: string;
  /** The key gate's missing answer — the browser will not send the form without it. */
  required?: boolean;
  /** `email` puts the @ keyboard on a phone; the contact boxes are the only
   *  fields on this card that are not free text. */
  type?: 'text' | 'email' | 'tel';
  /** Lets the phone's own autofill offer what it already knows — the same
   *  "stop asking what you can read" the account prefill does one layer up. */
  autoComplete?: 'email' | 'tel' | 'name';
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={questionClass(question)}>
        {label}
        {mark ? <span className="attend-mark">{mark}</span> : null}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        name={id}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required || undefined}
        className="input-field"
      />
    </div>
  );
}

function Select({
  id,
  label,
  options,
  defaultValue,
  question = false,
}: {
  question?: boolean;
  id: string;
  label: string;
  options: [string, string][];
  defaultValue?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={questionClass(question)}>
        {label}
      </label>
      <select
        id={id}
        name={id}
        defaultValue={defaultValue}
        className="input-field appearance-none bg-cream pr-8"
      >
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}


/**
 * A question's label. With "Ask one question at a time" on, the label IS the
 * screen's heading — the house's one-question rule (vendor onboarding,
 * DECISION_LOG 2026-08-10: "with one question per screen the field label
 * already IS the title"), set like the answer screen's own "Will you be
 * there?". Off, it is the scrolling form's small label, unchanged.
 */
function questionClass(question: boolean): string {
  return question ? 'block font-serif text-xl leading-snug text-ink' : 'block text-sm font-medium text-ink';
}

/**
 * The invitation's facts on the reply card — shown on the first screen only
 * when the form asks one question at a time (`data-rsvp-context`), and exactly
 * as before (a bare fragment, no wrapper) when it does not.
 */
function InvitationFacts({ fold, children }: { fold: boolean; children: React.ReactNode }) {
  return fold ? (
    <div className="space-y-6" data-rsvp-context="">
      {children}
    </div>
  ) : (
    <>{children}</>
  );
}
