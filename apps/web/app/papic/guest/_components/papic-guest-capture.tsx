'use client';

import { EVENT_PUT_AWAY_CAPTURE_COPY } from '@/lib/event-accepts-captures-rule';
import { DEFAULT_EVENT_POOL_CONFIG } from '@/lib/papic-event-pool';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent as RMouseEvent,
  type PointerEvent as RPointerEvent,
  type ReactNode,
} from 'react';
import {
  Camera,
  Loader2,
  Check,
  CircleAlert,
  ImageIcon,
  ShieldCheck,
  Sparkles,
  X,
  ScanLine,
  Square,
  Trophy,
} from 'lucide-react';
import { DayOfFaceEnroll } from '@/app/[slug]/_components/day-of-face-enroll';
import type { FaceTaggingWish } from '@/lib/face-tagging-wish';
import { makeQrDetector } from '@/lib/qr-scan';
import { usePapicCamera } from '@/lib/use-papic-camera';
import type { PapicFaceMode } from '@/lib/papic-face-mode';
import { cssPreviewFilter, type PapicStyle } from '@/lib/papic-photo-styles';
import { GuestCameraTools, GuestFocusSquare, GuestGridLines } from './guest-camera-tools';
import { TagScannerOverlay } from './tag-scanner-overlay';
import { MyShotsSheet, MyShotsWaitingBadge, type MyShot } from './my-shots-sheet';
import { focusPointFromTap, PAPIC_GRID_STORAGE_KEY, zoomSteps } from '@/lib/papic-camera-steps';
import { InfoTip } from '@/app/_components/info-tip';
import { ChallengeFollowUp, ChallengePill, useGuestChallenges, type ArmedChallenge } from './papic-challenge-panel';
import { newClientCaptureId } from '@/lib/papic-client-capture-id';
import { papicUploader, saveShot } from '@/lib/papic-upload/browser';
import { markSavedOnPhone, markShutter, markShutterReady } from '@/lib/papic-upload/shutter-timing';
import { developCanvas } from '@/lib/papic-upload/develop';
import { papicCaptureCost } from '@/lib/papic-cameras-pure';
import { PapicUploadChip } from '@/app/papic/_components/upload-chip';
import {
  getPapicQualityTier,
  photoJpegQuality,
  clipVideoBitsPerSecond,
} from '@/lib/papic-adaptive-quality';
import { formatCount } from '@/lib/format-number';
import { formatPapicDayInWords } from '@/lib/papic-window';
import { cameraExitHref, type HubTabKey } from '@/app/[slug]/_lib/hub-tabs';
import { CAMERA_PLAIN_TINT } from '@/lib/camera-dress';
import { SETNAYAN_PHOTO_MARK, type PapicMark } from '@/lib/papic-photo-mark';
import { FocusCorners } from './camera-focus-corners';

// NO PER-PHOTO TAG LIMIT (owner 2026-08-06: "no tag limit. we can tag as many").
// This file used to hardcode TAG_CAP = 10 and show a counter — while the DATABASE
// had allowed 20 since 2026-07-23, so guests were cut off at half the real limit
// and told "that's the max". Both numbers are gone: the server no longer refuses
// on count, so the camera never has a tally to display or a ceiling to announce.
const MAX_CLIP_MS = 10000; // 10-SECOND CLIP CAP (owner 2026-07-22 · §0) — mirrored route + RPC.
const HOLD_MS = 260; // tap-vs-hold boundary: a press held this long starts a clip
/** Frames a burst may hold in memory before the shutter waits for the oldest to save. */
const MAX_DEVELOPING = 6;

/** A ~320-px JPEG of a frame — what "My shots" and the thumbnail draw, so a
 *  long session never holds its full-size photos in memory for the sheet. */
async function smallThumb(source: CanvasImageSource, w: number, h: number): Promise<Blob | null> {
  if (!w || !h) return null;
  const scale = Math.min(1, 320 / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/jpeg', 0.7));
}

async function smallThumbOfBlob(blob: Blob): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(blob);
    try {
      return await smallThumb(bmp, bmp.width, bmp.height);
    } finally {
      bmp.close();
    }
  } catch {
    return null;
  }
}

/** Friendly, guest-facing copy for a tag failure. The camera never breaks on a
 *  tag miss — these just steer the next scan. */
function tagErrorMessage(error: string): string {
  switch (error) {
    case 'unrecognized':
      return 'That’s not a guest or table QR — point at a place card or table sign.';
    case 'guest_not_found':
      return 'That guest QR isn’t from this event.';
    case 'table_not_found':
      return 'That table sign isn’t from this event.';
    // 'cap_reached' is retired — the server no longer refuses a tag on count.
    // Kept as a case so an older server payload still gets friendly copy rather
    // than falling through to the generic failure.
    case 'cap_reached':
      return 'That tag didn’t go through. Try scanning again.';
    case 'not_your_photo':
      return 'You can only tag your own photos.';
    case 'unavailable':
      return 'Tagging isn’t available right now — your photo still saved.';
    default:
      return 'Couldn’t tag that — try again.';
  }
}

/**
 * Copy for a refusal that is about WHEN, not about the bytes (owner 2026-08-07:
 * guests shoot on the event day unless the host opens the cameras early).
 *
 * 🔑 ONE HELPER, BOTH PATHS. The photo and clip branches each format their own
 * reject message, and a window refusal falling through to the generic "please
 * try again" would tell a guest to keep retrying something that cannot succeed
 * until a date. Returns null when the code is not a window refusal, so the
 * existing generic handling is unchanged.
 */
function guestWindowRejectMessage(
  error: unknown,
  eventDay: unknown,
): string | null {
  // 📸 In words, on the venue's clock (owner 2026-10-13) — "Saturday, 12 December".
  const day = typeof eventDay === 'string' && eventDay ? formatPapicDayInWords(eventDay) : null;
  if (error === 'guest_capture_not_open_yet') {
    return day
      ? `Guest cameras switch on ${day}. Your host can open them earlier.`
      : 'Guest cameras open on the day of the event. Your host can open them earlier.';
  }
  if (error === 'guest_capture_closed') {
    return 'Guest cameras for this event have closed.';
  }
  return null;
}

// Papic · guest capture (client)
//
// Mirrors the seat-capture surface (apps/web/app/papic/seat/[token]/_components/
// papic-seat-capture.tsx) but for the PAPIC_GUEST per-guest camera. Rear camera
// (getUserMedia facingMode: environment) → freeze to a canvas → JPEG → POST the
// bytes as multipart to /api/papic/guest-capture, which validates the guest-
// session cookie, PUTs to R2 server-side, and records the capture through the
// quota-enforcing papic_record_guest_capture RPC. The response carries the
// authoritative `remaining` credit count, so the client never owns the cap —
// it just reflects what the server returns.
//
// PHOTO + CLIP: the gesture shutter (tap = photo, press-and-hold = record) — no
// mode toggle. The stream always grabs audio and a MediaRecorder records with a
// HARD 10000ms client stop (the 10s clip cap, re-clamped server-side) plus a
// poster frame (first frame to a canvas, JPEG — the NSFW-screen proxy). The
// clip + poster + duration POST to the SAME route with media_type=clip. Guest
// clips the guest opts to share publicly (sharePublicly) AND the couple later
// approves feed the public Alaala memory orb — the cleanest consent chain (the
// guest records AND consents to their own clip).

type Props = {
  /** Carried, never printed: no casual greetings on a guest's screen (owner, DECISION_LOG 2026-09-30). */
  guestName: string;
  eventName: string;
  /** The event this guest camera belongs to — every saved shot is filed under it
   *  and sent only while a camera for it is open. */
  eventId: string;
  /** The server-stamped tag of THIS guest at THIS event (lib/papic-upload/
   *  owner-tag.server.ts). REQUIRED, like `capApplies`: two mounts, and an
   *  optional prop is how one of them quietly forgets it — a queued shot must
   *  never record as another pass on a shared phone. */
  uploadOwner: string | null;
  initialRemaining: number;
  total: number;
  /** Has this guest already accepted the one-time UGC terms of use? */
  termsAccepted: boolean;
  /** True when the guest has no active face enrollment — shows the in-camera
   *  "add your face" fallback prompt so their candid shots auto-find them. */
  needsFaceEnroll?: boolean;
  /** The guest's stored "Want to be tagged in the photos?" answer
   *  (`guests.face_tagging_wanted`, owner 2026-09-29). `null` = never answered:
   *  the face step asks that one question before any selfie. A stored `false`
   *  never reaches here — the parents already turned `needsFaceEnroll` off. */
  faceTaggingWish?: FaceTaggingWish;
  /** True when Kwento is on for the event. It is FREE for every event since
   *  2026-08-21 (owner: "kwento is free"), so this is true everywhere Papic is
   *  set up — the prop stays because the RULE lives in FREE_FOR_ALL_SKUS and
   *  flipping that set is how it reverses. When false the Kwento
   *  "tell the story" prompt is suppressed entirely — POST /api/papic/kwento
   *  403s feature_not_owned for unowned events, so showing the prompt would
   *  only let the guest type a message that silently fails. */
  canKwento?: boolean;
  /**
   * Does SOME per-guest number actually bind on this celebration — either the
   * couple's own ceiling (S2, migration 20271184624871), or (absent one) the
   * platform's flat 150?
   *
   * 🔴 REQUIRED, and it replaces the old `guestUnlimited`. The database lifts
   * the platform ceiling for an active "Unlock all of Papic" **or** for any
   * celebration with a shared pot — the FIRST celebration on an account arms the free 50-shot
   * pot on render, so THAT half is false almost everywhere — but the couple's
   * own ceiling, when set, overrides both: a bought Unlock pass is not
   * permission to walk through a limit the couple put on one guest. `total`
   * and `remaining` below are already whichever number is actually binding.
   *
   * A personal countdown is drawn, and the shutter may be hidden, ONLY when
   * this is true. Resolved server-side by `fetchGuestQuota`.
   */
  capApplies: boolean;
  /** True once the pot crosses its own soft-stop line.
   *
   *  🔒 THE ONLY THING THIS CAMERA IS TOLD ABOUT THE POT (owner-locked, PRIV-1).
   *  A `poolRemaining` prop used to ride alongside and the header printed it as
   *  "N left for everyone". This component has two mounts — /papic/guest and the
   *  inline camera on the public /[slug] page — and the reader of both is a
   *  GUEST, identified by an invite cookie, not an event member. The pot's
   *  balance is the couple's money and is no longer sent to either. The warning
   *  stays: a guest does need to know to wind down. */
  poolLow?: boolean;
  /** True when the shared pot is ALREADY at zero as the camera opens.
   *
   *  📸 Owner 2026-10-13 ("Add all", tester item 2): the guest used to learn
   *  the pot was empty only from a REFUSED shot — that photo was lost. Told at
   *  open, the shutter rests and nothing is thrown away. A boolean, like
   *  `poolLow`: the guest learns the pot's STATE, never its figure (PRIV-1). */
  poolEmpty?: boolean;
  /** Her number is a sponsor's bigger share (two or three of the equal shares),
   *  so the counter says so — otherwise a ninang reading "33 left" beside a
   *  cousin's "11 left" has no idea why. Resolved by `fetchGuestQuota`.
   *  REQUIRED, like `capApplies`: the camera has two mounts, and an optional
   *  prop is how one of them quietly forgets it. */
  sponsorShare: boolean;
  /** The event-wide look (set once by the couple at Papic setup). LOCKED — the
   *  guest can't change it; it's baked into every photo they capture. */
  eventStyle: PapicStyle;
  /** Resolved per-event face-tag mode (One-Pool spec §3.4). mode_b (default) →
   *  the on-device embedder is NEVER called: no face descriptor is computed or
   *  transmitted for this guest's captures. Only mode_a (a consented custom-QR
   *  roster) runs `embedFaces`. Resolved server-side, forced to mode_b for
   *  christening/debut. */
  faceMode: PapicFaceMode;
  /** The guest's own personal QR token (server-resolved from the session —
   *  never client-supplied), so the challenge-completion reward can link into
   *  their Story maker at /papic/me/[token]. Null → no reward CTA. */
  storyToken?: string | null;
  /** True when this camera is mounted INSIDE the guest's Event Hub (`/[slug]`
   *  site-body), false on the standalone `/papic/guest` page.
   *
   *  Owner 2026-09-30, on the hub's terms card: "space is too big also should
   *  only be the small frame". The small-card states (terms · blocked · no
   *  camera) used to wrap themselves in a full-page `<main min-h-screen …>`
   *  on BOTH mounts, so inside the hub the card floated in a screen of empty
   *  cream — and nested a `<main>` inside the hub's own `<main>`, which is
   *  invalid HTML. Embedded, the card renders bare (see `CardFrame`).
   *  REQUIRED, like `capApplies`: two mounts, and an optional prop is how one
   *  of them quietly forgets it. Pinned by
   *  `app/[slug]/_components/the-hub-camera-terms-is-only-the-card.test.ts`. */
  embedded: boolean;
  /**
   * 📸 THE WAY BACK (owner 2026-10-01, DECISION_LOG "THE EVENT HUB IS FULL
   * SCREEN WITH ONE EXIT…"): the Event Hub this camera was opened from, and
   * the tab — the × goes back there (Live when opened directly) carrying how
   * many shots landed, and the hub says "N photos added · See them". Null (no
   * event to return to, or the hub's own inline camera) → no ×, no thumbnail.
   */
  exitTo?: { slug: string; tab: HubTabKey | null } | null;
  /** The guest's OWN latest shot, for the thumbnail beside the shutter (server-read). */
  lastShotUrl?: string | null;
  /** 🖼 The guest's own earlier shots in this event's Memories (server-read,
   *  newest first) — the rest of "My shots" after this visit's (owner
   *  2026-10-24: this phone's shots, as a sheet over the camera). */
  myShots?: ReadonlyArray<{ id: string; url: string }> | null;
  /**
   * 📷 ONE CAMERA, AND ITS PRO DRESS (owner 2026-10-24, final: *"Free: plain
   * camera with a small Setnayan mark on saved photos. Pro: their logo on the
   * shutter, theme colours, and their monogram on saved photos. No frames."*;
   * lib/camera-dress.ts). The three looks of 06 Oct are gone — nothing to pick.
   *   · free (or absent): the plain shutter, white corners, neutral pills;
   *   · `pro`: the event's logo (`logo`) on a white shutter, the corners and
   *     the chosen pills in `tint`, the theme's colour.
   * Pro = the event's Logo & QR part or Full Pro, server-read. Standalone (not
   * `embedded`) the camera fills the phone's screen exactly (`100dvh`).
   */
  dress?: { pro: boolean; tint: string; logo: ReactNode | null } | null;
  /** 🏷 The small mark burned into the COPIES of every shot (never the original;
   *  lib/papic-photo-mark.ts). Absent → the Setnayan mark, the free event's. */
  photoMark?: PapicMark | null;
};

/**
 * The page around a small-card state. Standalone (`/papic/guest`) the card IS
 * the page, so it is centred on a full-height cream ground. Embedded in the
 * Event Hub the hub already owns the page — the card renders alone, with no
 * `<main>`, no `min-h-screen` and no page-level centring or background.
 */
function CardFrame({
  embedded,
  pad,
  children,
}: {
  embedded: boolean;
  pad: 'py-10' | 'py-12';
  children: ReactNode;
}) {
  if (embedded) return <>{children}</>;
  return (
    <main className={`flex min-h-screen items-center justify-center bg-cream px-4 ${pad} text-ink`}>
      {children}
    </main>
  );
}

/**
 * Announce that the guest camera just refused a shot for want of points.
 *
 * A window CustomEvent rather than a callback prop, so this ~1,400-line
 * component does not grow page-level state to move one boolean to a sibling.
 * The guest "Add credits" panel listens when NEXT_PUBLIC_PAPIC_GUEST_BUY is on;
 * when it is off nothing is mounted and this dispatch is a no-op, so the camera
 * renders byte-identically either way. Fire-and-forget: it must never be able
 * to break a capture.
 */
function announceOutOfShots(): void {
  try {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('papic:out-of-shots'));
  } catch {
    /* a missing CustomEvent constructor must not break the camera */
  }
}

export function PapicGuestCapture({
  eventName,
  eventId,
  uploadOwner,
  initialRemaining,
  total,
  termsAccepted,
  needsFaceEnroll = false,
  faceTaggingWish = null,
  canKwento = false,
  capApplies,
  poolLow = false,
  poolEmpty: poolEmptyAtOpen = false,
  sponsorShare,
  eventStyle,
  faceMode,
  storyToken = null,
  embedded,
  exitTo = null,
  lastShotUrl = null,
  myShots = null,
  dress = null,
  photoMark = null,
}: Props) {
  const fullScreen = !embedded;
  const pro = dress?.pro === true;
  const tint = pro && dress ? dress.tint : CAMERA_PLAIN_TINT;
  const mark = photoMark ?? SETNAYAN_PHOTO_MARK;
  // 📸 Shots that landed this visit, and the thumbnail of the latest one of
  // THEIRS — the server's on arrival, then each new shot as it saves.
  const [added, setAdded] = useState(0);
  const [thumb, setThumb] = useState<string | null>(lastShotUrl);
  // The event-wide look is LOCKED (couple-set at setup) — baked into every photo.
  const styleRef = useRef<PapicStyle>(eventStyle);
  useEffect(() => {
    styleRef.current = eventStyle;
  }, [eventStyle]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Clip recorder (Option A).
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The id of the newest shot this visit — Kwento + scan-to-tag anchor on it
  // once the uploader records it.
  const latestShotRef = useRef<string | null>(null);
  // Gesture shutter: a hold-timer tells a TAP (photo) from a HOLD (record).
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didHoldRef = useRef(false);
  // Synchronous mirror of the recorder lifecycle (React `recording` only clears
  // in the async onstop) so a rapid re-press isn't blocked by a stale flag.
  const recordingRef = useRef(false);

  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(initialRemaining);
  // Clip recording phase + elapsed (for the 5s countdown ring).
  const [recording, setRecording] = useState(false);
  const [recElapsed, setRecElapsed] = useState(0);
  // Public-sharing opt-in (Alaala orb gate · RA 10173). OFF by default and never
  // pre-checked: when ON, each shot this guest captures is sent with
  // share_publicly so the server sets consent_to_public on their own row — one
  // of the two gates the public showcase needs (the couple's approval is the
  // other). A persistent per-session preference, so the guest sets it once.
  const [sharePublicly, setSharePublicly] = useState(false);
  // The share line's <label> also holds the ⓘ button, so it names its checkbox (a tap on the row ticks the box).
  const shareId = useId();
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  // Kwento (0012): after a shot, the guest can tell the couple the story behind
  // it — the warmest moment to ask. Anchored on the capture just made.
  //
  // Two-step voice-depth flow:
  //   flash  — bottom one-liner (≤50 chars), 5-second auto-dismiss, no consent
  //             checkbox (covered by the Papic session consent).
  //   story  — the existing full textarea (≤280 chars) with consent checkbox,
  //             offered after Flash sends OR after it times out/is dismissed.
  const [kwentoCaptureId, setKwentoCaptureId] = useState<string | null>(null);
  const [kwentoFlashText, setKwentoFlashText] = useState('');
  const [kwentoStoryText, setKwentoStoryText] = useState('');
  const [kwentoConsent, setKwentoConsent] = useState(false);
  const [kwentoPhase, setKwentoPhase] = useState<
    'idle' | 'flash' | 'flash_sending' | 'story' | 'story_sending' | 'sent' | 'held'
  >('idle');
  const [kwentoError, setKwentoError] = useState<string | null>(null);
  const [flashCountdown, setFlashCountdown] = useState(5);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The just-sent message, so the guest can change their mind and delete it.
  // The 24h window + ownership are enforced server-side by the delete RPC.
  const [sentMessageId, setSentMessageId] = useState<string | null>(null);
  const [deletePhase, setDeletePhase] = useState<'idle' | 'deleting' | 'deleted'>('idle');

  // UGC terms gate (Apple 1.2 / Google Play UGC). The guest must accept the
  // objectionable-content terms once before their first capture. If they've
  // already accepted (server-resolved), this is true and the camera shows
  // immediately.
  const [accepted, setAccepted] = useState(termsAccepted);
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // In-camera "add your face" fallback (the straight-to-shooting guest who
  // skipped the RSVP selfie). enrolling swaps the rear capture stream for the
  // front-camera enroll panel; enrolled hides the prompt afterward.
  const [enrolling, setEnrolling] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);

  // Scan-to-tag (QR fallback) — after a shot, the guest can scan a place-card or
  // table QR to mark who's in it, so it lands in that guest's "Photos of you".
  // Mirrors the seat camera, on the same rear stream.
  const [lastCaptureId, setLastCaptureId] = useState<string | null>(null);
  // The media kind of the last shot (photo tap vs held clip) — so the Papic
  // Challenges panel can name it. A challenge completes with EITHER;
  // papic_guest_captures holds both.
  const [lastCaptureKind, setLastCaptureKind] = useState<'photo' | 'clip' | null>(null);
  // The ARMED Papic Challenge (SELECT → COMMENCE → RETAKE, owner 2026-07-23):
  // lifted from the panel so the capture stage can show what the next shot
  // counts for. The panel owns the mechanic; this is display-only state.
  const [armedChallenge, setArmedChallenge] = useState<ArmedChallenge | null>(null);
  // 🏆 The challenges (one hook): the pill left of Photo ⇄ Snippet, the follow-up line under the shutter.
  const challenges = useGuestChallenges({ lastCaptureId, lastCaptureKind, onArmedChange: setArmedChallenge });
  const [tagging, setTagging] = useState(false);
  const [tagCount, setTagCount] = useState(0);
  // Each scan that tagged somebody, in order: the hint line lists them, and the
  // latest is the confirmation chip on the viewfinder ("✓ Ana Reyes tagged").
  const [tagLog, setTagLog] = useState<Array<{ hint: string; chip: string }>>([]);
  const [tagNotice, setTagNotice] = useState<string | null>(null);

  // 📷 THE CAMERA, COMPLETE (owner 2026-10-24, "Okay build it",
  // prototypes/papic_camera_complete_2026-10-24_fable.html):
  //   · Photo ⇄ Snippet — a guest can choose Snippet on purpose; in Snippet a
  //     tap starts and a tap stops (or hold, and let go). Hold-to-record stays
  //     in Photo.
  //   · the rule-of-thirds grid, remembered on the device;
  //   · tap-to-focus, only where the camera reports it can;
  //   · "My shots", a sheet over the camera.
  const [mode, setMode] = useState<'photo' | 'snippet'>('photo');
  const [grid, setGrid] = useState(false);
  const [focusMark, setFocusMark] = useState<{ x: number; y: number; key: number } | null>(null);
  const [shotsOpen, setShotsOpen] = useState(false);
  // This visit's shots, newest first — small copies, kept for the sheet.
  const [sessionShots, setSessionShots] = useState<MyShot[]>([]);
  const snippetDownAtRef = useRef(0);
  const stopOnUpRef = useRef(false);
  const viewfinderRef = useRef<HTMLDivElement>(null);
  const tagBusyRef = useRef(false);
  const lastScanRef = useRef<string>('');

  // The live camera + its flip / lens controls (shared hook owns the stream).
  // Hold the camera only behind the UGC gate AND while the front-camera enroll
  // panel isn't using it — the hook re-acquires the rear stream when enroll ends.
  const {
    videoRef,
    streamRef,
    ready,
    camError,
    facing,
    canFlip,
    flip,
    lensOptions,
    lens,
    selectLens,
    crop,
    canFocus,
    focusAt,
    mirrored,
    switching,
  } = usePapicCamera({
    enabled: accepted && !blocked && !enrolling,
    // A camera that comes back never cuts a clip mid-take (a reopen is not a shot).
    holdRestart: () => recordingRef.current,
  });

  /*
    TWO REFUSALS, TWO SENTENCES.

    `capReached` is the guest's own ceiling — the RPC's `quota_exhausted`, or a
    countdown that has run out on a celebration where the ceiling genuinely
    binds. `poolEmpty` is the CELEBRATION running out, which arrives as a bare
    409 and used to be read as the first one: a guest three photos in was
    congratulated with "That's all 150 photos" for a shot that was thrown away,
    while the buy panel opened to sell shots that also could not be taken.

    🔑 A REFUSAL THAT REUSES ANOTHER REFUSAL'S STATUS CODE INHERITS ITS COPY.

    `exhausted` keeps its name and its job — every shutter/panel guard below
    reads it — but it is now the OR of two named causes rather than a countdown
    from a number nobody chose.
  */
  const [capReached, setCapReached] = useState(false);
  // Which per-guest limit actually bound (S4): the couple's own ceiling, or
  // the platform's flat 150. Server-authoritative (json.reason), never
  // guessed — only capReason === 'guest_spend_ceiling' gets the one extra
  // sentence naming a remedy the flat 150 does not have.
  const [capReason, setCapReason] = useState<string | null>(null);
  // Starts TRUE when the pot was already empty at open (server-read), so the
  // shutter rests before a shot is taken and lost — not after.
  const [poolEmpty, setPoolEmpty] = useState(poolEmptyAtOpen);
  const capExhausted = capReached || (capApplies && remaining <= 0);
  const exhausted = capExhausted || poolEmpty;

  // ── THE LOW STATE (S4, spec § 6b) ───────────────────────────────────────
  // The guest camera had none: it went straight from a number to exhausted.
  // Same soft-stop line the shared pool already warns at
  // (DEFAULT_EVENT_POOL_CONFIG.softStopPct) — there is no separate per-guest
  // threshold to invent, and `total` here is already whichever number binds
  // (the couple's own ceiling, or the platform's flat 150; see fetchGuestQuota).
  const low =
    capApplies &&
    !exhausted &&
    total > 0 &&
    remaining <= Math.floor((total * (100 - DEFAULT_EVENT_POOL_CONFIG.softStopPct)) / 100);

  // ⚠ EVERY SHOT SPENDS LATER. A shot is saved on this phone at the shutter
  // and recorded by the uploader (lib/papic-upload/) when there is signal —
  // seconds later online, hours later after a dead link — and it spends against
  // whichever ceiling binds AT RECORD TIME. This pill is advisory;
  // papic_record_guest_capture is the truth.

  const acceptTerms = useCallback(async () => {
    if (acceptBusy || !agreeChecked) return;
    setAcceptBusy(true);
    setAcceptError(null);
    try {
      const res = await fetch('/api/papic/accept-terms', { method: 'POST' });
      if (!res.ok) throw new Error('accept');
      setAccepted(true);
      // Shots kept for the terms send now (re-review 2026-10-24: terms keep, not drop).
      papicUploader().wake();
      // ── THE FACE STEP POPS ON THE FIRST CLICK (owner 2026-09-21). This is the
      // moment a guest first opens the camera, so it is where "add your face so
      // your photos find you" is asked — ONCE, and never on the page itself.
      // SEPARATE from the terms above and SKIPPABLE (onSkip): biometric consent
      // under RA 10173 must be freely given, so declining it never costs the
      // guest the camera. The small in-camera prompt remains for later.
      if (needsFaceEnroll && !enrolled) setEnrolling(true);
    } catch {
      setAcceptError('Could not save that — check your signal and try again.');
    } finally {
      setAcceptBusy(false);
    }
  }, [acceptBusy, agreeChecked]);

  // Stop any in-flight recording + clear its timers when the component unmounts.
  useEffect(() => {
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      const rec = recorderRef.current;
      if (rec && rec.state !== 'inactive') {
        try {
          rec.stop();
        } catch {
          /* already stopped */
        }
      }
    };
  }, []);

  // The grid is remembered on this device. Storage can be refused (a private
  // window) — the grid then simply starts off.
  useEffect(() => {
    try {
      setGrid(window.localStorage.getItem(PAPIC_GRID_STORAGE_KEY) === '1');
    } catch {
      /* no storage — off */
    }
  }, []);
  const toggleGrid = useCallback(() => {
    setGrid((g) => {
      const next = !g;
      try {
        window.localStorage.setItem(PAPIC_GRID_STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* no storage — this visit only */
      }
      return next;
    });
  }, []);

  // The sheet's small copies live as long as the camera does.
  const sessionUrlsRef = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const u of sessionUrlsRef.current) URL.revokeObjectURL(u);
    },
    [],
  );
  const keepSessionShot = useCallback((shot: MyShot) => {
    sessionUrlsRef.current.push(shot.url);
    setSessionShots((was) => [shot, ...was]);
    setThumb(shot.url);
  }, []);

  // 🎯 Tap-to-focus — only where the track reports a focus mode; elsewhere a
  // tap on the picture does nothing at all (no square that promises focus).
  const onViewfinderTap = useCallback(
    (e: RMouseEvent<HTMLDivElement>) => {
      if (!canFocus || !ready || switching || tagging || exhausted) return;
      if ((e.target as HTMLElement).closest('button, a, input, label')) return;
      const box = viewfinderRef.current?.getBoundingClientRect();
      const video = videoRef.current;
      if (!box || !video) return;
      const tapX = e.clientX - box.left;
      const tapY = e.clientY - box.top;
      const point = focusPointFromTap({
        tapX,
        tapY,
        boxW: box.width,
        boxH: box.height,
        videoW: video.videoWidth,
        videoH: video.videoHeight,
        crop: recordingRef.current ? 1 : crop,
        mirrored,
      });
      if (!point) return;
      focusAt(point);
      const key = Date.now();
      setFocusMark({ x: tapX, y: tapY, key });
      setTimeout(() => setFocusMark((m) => (m?.key === key ? null : m)), 1200);
    },
    [canFocus, ready, switching, tagging, exhausted, crop, mirrored, focusAt, videoRef],
  );

  const closeShots = useCallback(() => setShotsOpen(false), []);

  // ---- clip recording (Option A) --------------------------------------------

  // After a capture saves (photo OR clip), wire up the Kwento + scan-to-tag
  // affordances anchored on the new capture id. Shared so both paths behave the
  // same. Photos open the Flash prompt; clips skip it (the moment is recorded).
  const onSavedCapture = useCallback((captureId: string, openFlash: boolean) => {
    setKwentoCaptureId(captureId);
    setKwentoFlashText('');
    setKwentoStoryText('');
    setKwentoConsent(false);
    // Only open the Flash prompt when Kwento is on for the event (free for
    // every event since 2026-08-21; resolved server-side, never assumed here).
    setKwentoPhase(canKwento && openFlash ? 'flash' : 'idle');
    setFlashCountdown(5);
    setKwentoError(null);
    setSentMessageId(null);
    setDeletePhase('idle');
    setLastCaptureId(captureId);
    // openFlash is true for a photo, false for a held clip (see the call site).
    setLastCaptureKind(openFlash ? 'photo' : 'clip');
    setTagging(false);
    setTagCount(0);
    setTagLog([]);
    setTagNotice(null);
    lastScanRef.current = '';
  }, [canKwento]);

  // 🧪 DEVELOP, OFF THE SHUTTER. The look, the JPEG encode and the write to this
  // phone take 100–400 ms on a phone (the look is a pixel pass over 3.7 MP), so
  // they run here, one shot at a time, AFTER the shutter is already free for the
  // next press. A burst never holds more than MAX_DEVELOPING frames in memory:
  // past that, the shutter waits for the oldest to finish (iOS caps canvas memory).
  const developChainRef = useRef<Promise<void>>(Promise.resolve());
  const developingRef = useRef(0);
  const developPhoto = useCallback(
    async (
      canvas: HTMLCanvasElement,
      meta: { clientCaptureId: string; capturedAtMs: number; sharePublicly: boolean; style: PapicStyle; faceMode: PapicFaceMode },
    ) => {
      // FACE-MODE GATE (One-Pool spec §3.4): in mode_b `embedFaces` is NEVER
      // called — no 128-d descriptor is computed and none is transmitted. Only
      // mode_a (a consented custom-QR roster) keeps a CLEAN copy of the frame
      // (before the look, which would wreck face-api's descriptors) for the
      // on-device face pass — which runs in the upload queue, OFF the shutter.
      // ON-DEVICE: only the tiny vectors ever leave the phone, never the face.
      let faceSource: Blob | null = null;
      if (meta.faceMode === 'mode_a') {
        try {
          const { resizeTo } = await import('@/lib/papic-upload/prepare');
          faceSource = await resizeTo(canvas, 1280, 0.85);
        } catch {
          faceSource = null; // best-effort — a face-tag miss never affects the photo
        }
      }
      // Bake the LOCKED event look into the delivered photo (after the clean
      // copy) — in a worker, so the shutter stays pressable while it runs.
      await developCanvas(canvas, meta.style);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', photoJpegQuality('full')),
      );
      // The small copy for the thumbnail and "My shots" — the look is already on it.
      const small = blob ? await smallThumb(canvas, canvas.width, canvas.height).catch(() => null) : null;
      canvas.width = 0;
      canvas.height = 0;
      if (!blob) {
        setSaveError('Could not grab that frame — try again.');
        return;
      }
      try {
        await saveShot({
          id: meta.clientCaptureId,
          lane: 'guest',
          eventId,
          media: 'photo',
          capturedAtMs: meta.capturedAtMs,
          // Public-sharing consent for THIS shot (Alaala orb gate) — only true
          // when the guest opted in; the server sets consent_to_public from it.
          sharePublicly: meta.sharePublicly,
          primary: blob,
          faceSource,
          ownerTag: uploadOwner,
          mark,
        });
      } catch {
        // The phone could not keep it (storage full / private mode). Say so —
        // never a "saved" over a shot that exists nowhere.
        setSaveError("Couldn't save that shot on this phone — free up some space and try again.");
        return;
      }
      markSavedOnPhone(meta.capturedAtMs);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 900);
      keepSessionShot({ id: meta.clientCaptureId, url: URL.createObjectURL(small ?? blob), media: 'photo' });
    },
    [eventId, uploadOwner, keepSessionShot, mark],
  );

  const capture = useCallback(async () => {
    if (busy || !ready || switching || exhausted || !accepted || blocked) return;
    const video = videoRef.current;
    if (!video) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    markShutter();
    setSaveError(null);
    if (developingRef.current >= MAX_DEVELOPING) {
      // Backpressure — a long burst waits for the oldest frame to be saved.
      setBusy(true);
      await developChainRef.current;
      setBusy(false);
    }

    // 📸 SAVE FIRST, SEND LATER (owner 2026-10-23: "each phone can shoot
    // continuously while uploading online works on the background"). A FRESH
    // canvas per shot: the frame is grabbed here and the shutter is free; the
    // look, the encode and the write to this phone follow in `developPhoto`,
    // and lib/papic-upload/ sends it, in pieces, when there is signal.
    // 2× on a phone with no 2× of its own is a DIGITAL crop (owner 2026-10-24:
    // "2× shows on every phone") — the centre half of the frame, at its own
    // pixels, exactly what the preview showed.
    const sw = Math.round(w / crop);
    const sh = Math.round(h / crop);
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, Math.round((w - sw) / 2), Math.round((h - sh) / 2), sw, sh, 0, 0, sw, sh);

    // 🕐 THE SHUTTER — stamped on the frame itself, before the look and the
    // encode, and long before any of the network. Everything after this line
    // can take seconds or, in the queue, hours; none of it is allowed to be the
    // minute this photograph is filed under. Never shown to the guest and never
    // asked of them (owner ruling, 2026-09-07) — the camera simply knows.
    const capturedAtMs = Date.now();
    // 🔁 …and the shutter's own id, minted HERE and carried unchanged by every
    // piece, every retry and every record — so a shot whose "saved" answer was
    // lost on bad signal lands ONCE and is paid for once
    // (lib/papic-client-capture-id.ts).
    const clientCaptureId = newClientCaptureId();
    latestShotRef.current = clientCaptureId;

    developingRef.current += 1;
    const meta = { clientCaptureId, capturedAtMs, sharePublicly, style: styleRef.current, faceMode };
    developChainRef.current = developChainRef.current
      .then(() => developPhoto(canvas, meta))
      .catch(() => {})
      .finally(() => {
        developingRef.current -= 1;
      });
    // The countdown moves at the shutter (advisory); the server's figure
    // replaces it as each shot is recorded.
    if (capApplies) setRemaining((r) => Math.max(0, r - papicCaptureCost('photo')));
    markShutterReady();
  }, [
    busy,
    ready,
    switching,
    exhausted,
    accepted,
    blocked,
    sharePublicly,
    capApplies,
    videoRef,
    faceMode,
    developPhoto,
    crop,
  ]);

  // 📮 WHAT THE UPLOADER HEARS BACK. A shot is recorded minutes — or, after a
  // dead hour, hours — after it was taken, so the camera reacts to the
  // uploader's events rather than to a request it made. Two copies of each rule
  // used to live in the photo and clip handlers; there is one now.
  // This camera is open: its event's shots (this guest's) may send from here.
  useEffect(
    () => papicUploader().register({ lane: 'guest', eventId, ownerTag: uploadOwner }),
    [eventId, uploadOwner],
  );

  useEffect(() => {
    const uploader = papicUploader();
    return uploader.on((e) => {
      if (e.shot.lane !== 'guest' || e.shot.eventId !== eventId) return;
      if (e.type === 'recorded') {
        const b = e.body as { remaining?: number; captureId?: string | null };
        setAdded((n) => n + 1);
        if (typeof b.remaining === 'number') {
          // The server's figure, less what this phone has shot but not yet sent.
          const unsent = uploader
            .snapshot()
            .shots.filter((s) => s.lane === 'guest' && s.eventId === eventId && !s.settled.record && s.id !== e.shot.id)
            .reduce((n, s) => n + papicCaptureCost(s.media, s.durationMs ?? null), 0);
          setRemaining(Math.max(0, b.remaining - unsent));
        }
        // Kwento + scan-to-tag anchor on the LATEST shot only.
        if (b.captureId && e.shot.id === latestShotRef.current) {
          onSavedCapture(b.captureId, e.shot.media === 'photo');
        }
        return;
      }
      if (e.type === 'credits') {
        /*
          TWO REFUSALS, TWO SENTENCES — `quota_exhausted` is THIS guest's own
          ceiling; every other credit refusal is the shared pot. A refusal that
          reuses another refusal's status code inherits its copy. The shot is
          KEPT on the phone either way, and the chip says how many wait.
        */
        if (e.code === 'quota_exhausted') {
          setRemaining(0);
          setCapReached(true);
          setCapReason(typeof e.body?.reason === 'string' ? e.body.reason : null);
        } else {
          setPoolEmpty(true);
        }
        setSaveError(null);
        announceOutOfShots();
        return;
      }
      if (e.type === 'kept') {
        // 🔒 The shot is KEPT on this phone (never erased for the window or
        // put-away — review 2026-10-23). 🚨 PUT-AWAY FIRST — it is not "out of shots".
        if (e.code === 'event_put_away') setSaveError(EVENT_PUT_AWAY_CAPTURE_COPY);
        // The terms gate comes back; accepting them sends these same shots.
        else if (e.code === 'terms_required') setAccepted(false);
        else {
          setSaveError(
            guestWindowRejectMessage(e.code, e.body?.eventDay) ??
              'Not sent yet — this shot stays on your phone.',
          );
        }
        return;
      }
      if (e.type === 'refused') {
        // Only the one refusal that ends a shot reaches here.
        if (e.code === 'blocked') setBlocked(true);
        else setSaveError("Couldn't save a shot — the event didn't accept it.");
      }
    });
  }, [eventId, onSavedCapture]);

  // Draw the current frame to the hidden canvas → JPEG poster (the NSFW proxy).
  const grabPoster = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  }, [videoRef]);

  // A finished clip goes to the phone's queue with its poster — the web copy
  // (~0.5 MB, ffmpeg.wasm) is made in the queue's background step, never here,
  // and never blocks the next shot (lib/papic-upload/prepare.ts).
  const saveClip = useCallback(
    async (clip: Blob, durationMs: number, capturedAtMs: number, poster: Blob | null) => {
      setSaveError(null);
      // 🔁 One id for this clip, every piece and every record — see the photo path.
      const clientCaptureId = newClientCaptureId();
      const clamped = Math.min(durationMs, MAX_CLIP_MS);
      try {
        await saveShot({
          id: clientCaptureId,
          lane: 'guest',
          eventId,
          media: 'clip',
          capturedAtMs,
          durationMs: clamped,
          // Same public-sharing opt-in as photos (Alaala orb gate).
          sharePublicly,
          primary: clip,
          poster,
          ownerTag: uploadOwner,
          mark,
        });
      } catch {
        setSaveError("Couldn't save that clip on this phone — free up some space and try again.");
        return;
      }
      latestShotRef.current = clientCaptureId;
      if (capApplies) setRemaining((r) => Math.max(0, r - papicCaptureCost('clip', clamped)));
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 900);
      if (poster) {
        const small = await smallThumbOfBlob(poster);
        keepSessionShot({ id: clientCaptureId, url: URL.createObjectURL(small ?? poster), media: 'clip', durationMs: clamped });
      }
    },
    [sharePublicly, eventId, capApplies, uploadOwner, keepSessionShot, mark],
  );

  const stopRecording = useCallback(() => {
    // Flip the synchronous flag the instant we ask to stop, so a re-press in the
    // window before onstop fires isn't blocked by a stale flag.
    recordingRef.current = false;
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!ready || switching || exhausted || busy || recordingRef.current || !accepted || blocked) return;
    const stream = streamRef.current;
    if (!stream) return;

    // Create + START the recorder SYNCHRONOUSLY (no await before start) so the
    // moment a hold fires there is a live recorder the matching release can
    // stop. (A prior `await grabPoster()` here stranded a recording when a quick
    // hold-release landed in that async window.) The poster is grabbed in onstop
    // from the last live frame instead.
    chunksRef.current = [];
    let mimeType = '';
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
      if (MediaRecorder.isTypeSupported('video/mp4')) mimeType = 'video/mp4';
      else if (MediaRecorder.isTypeSupported('video/webm')) mimeType = 'video/webm';
    }
    let rec: MediaRecorder;
    try {
      // Adaptive: cap the clip bitrate on a weak link (undefined = browser default).
      const bitrate = clipVideoBitsPerSecond(getPapicQualityTier());
      const opts: MediaRecorderOptions = {};
      if (mimeType) opts.mimeType = mimeType;
      if (bitrate) opts.videoBitsPerSecond = bitrate;
      rec = new MediaRecorder(stream, opts);
    } catch {
      setSaveError('Recording isn’t supported on this browser — try another phone.');
      return;
    }
    recorderRef.current = rec;

    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = async () => {
      recordingRef.current = false;
      setRecording(false);
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      const durationMs = Math.min(Date.now() - startedAtRef.current, MAX_CLIP_MS);
      const type = rec.mimeType || mimeType || 'video/mp4';
      const clip = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      if (clip.size === 0) {
        setSaveError('That recording came back empty — try again.');
        return;
      }
      const poster = await grabPoster(); // last live frame ≈ NSFW proxy
      // 🕐 The clip's minute is when it OPENED, not when it closed — the same
      // instant `durationMs` is measured from, so the two can never disagree.
      void saveClip(clip, durationMs, startedAtRef.current || Date.now() - durationMs, poster);
    };

    startedAtRef.current = Date.now();
    setRecElapsed(0);
    setSaveError(null);
    try {
      rec.start();
    } catch {
      setSaveError('Couldn’t start recording — try again.');
      return;
    }
    recordingRef.current = true;
    setRecording(true);

    // HARD 10-second stop — the clip cap (route + RPC clamp too).
    stopTimerRef.current = setTimeout(stopRecording, MAX_CLIP_MS);
    tickRef.current = setInterval(() => {
      setRecElapsed(Math.min(MAX_CLIP_MS, Date.now() - startedAtRef.current));
    }, 100);
  }, [ready, switching, exhausted, busy, accepted, blocked, grabPoster, saveClip, stopRecording, streamRef]);

  // ---- gesture shutter -----------------------------------------------------
  // TAP = photo, HOLD = record (release / 5s cap stops it). One button, no mode
  // toggle. pointerdown arms a hold timer; a release before HOLD_MS is a tap.
  const onShutterDown = useCallback(
    (e: RPointerEvent<HTMLButtonElement>) => {
      if (busy || !ready || switching || exhausted || tagging || !accepted || blocked) return;
      // In Snippet, a press on a running clip is the tap that stops it.
      if (recordingRef.current && mode !== 'snippet') return;
      // Capture the pointer so up/cancel land on this button even if the finger
      // drifts off — robust taps + no stranded recording.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* unsupported — degrade to plain pointerup */
      }
      if (mode === 'snippet') {
        // SNIPPET: the press starts the clip at once; a tap leaves it running
        // until the next tap, a hold stops it on letting go (onShutterUp).
        if (recordingRef.current) {
          stopOnUpRef.current = true;
          return;
        }
        snippetDownAtRef.current = Date.now();
        if (typeof navigator !== 'undefined') navigator.vibrate?.(40);
        void startRecording();
        return;
      }
      didHoldRef.current = false;
      holdTimerRef.current = setTimeout(() => {
        holdTimerRef.current = null;
        didHoldRef.current = true;
        if (typeof navigator !== 'undefined') navigator.vibrate?.(40);
        void startRecording();
      }, HOLD_MS);
    },
    [busy, ready, switching, exhausted, tagging, accepted, blocked, startRecording, mode],
  );

  const onShutterUp = useCallback(
    (e: RPointerEvent<HTMLButtonElement>) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* wasn't captured */
      }
      if (mode === 'snippet') {
        if (stopOnUpRef.current) {
          stopOnUpRef.current = false;
          stopRecording();
        } else if (snippetDownAtRef.current && Date.now() - snippetDownAtRef.current >= HOLD_MS) {
          stopRecording(); // a hold — letting go stops it
        }
        snippetDownAtRef.current = 0;
        return;
      }
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (didHoldRef.current) {
        didHoldRef.current = false;
        stopRecording();
        return;
      }
      void capture();
    },
    [capture, stopRecording, mode],
  );

  // System interruption mid-press — stop a running clip, never fire a photo.
  const onShutterCancel = useCallback(() => {
    if (mode === 'snippet') {
      stopOnUpRef.current = false;
      snippetDownAtRef.current = 0;
      if (recordingRef.current) stopRecording();
      return;
    }
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (didHoldRef.current) {
      didHoldRef.current = false;
      stopRecording();
    }
  }, [stopRecording, mode]);

  // ---- scan-to-tag ---------------------------------------------------------

  const startTagging = useCallback(() => {
    if (!lastCaptureId) return;
    lastScanRef.current = '';
    tagBusyRef.current = false;
    setTagNotice(null);
    setTagLog([]);
    setTagging(true);
  }, [lastCaptureId]);

  const stopTagging = useCallback(() => setTagging(false), []);

  // Act on one decoded QR: POST it to the guest-tag route (which classifies it
  // as a guest or table code, confirms the capture is ours, and writes the tag
  // within this event). The camera keeps running regardless — a miss only
  // steers the next scan.
  const handleScan = useCallback(
    async (raw: string) => {
      if (!lastCaptureId) return;
      let r: Record<string, unknown>;
      try {
        const res = await fetch('/api/papic/guest-tag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ captureId: lastCaptureId, scanned: raw }),
        });
        r = (await res.json().catch(() => ({ ok: false, error: 'tag_failed' }))) as Record<
          string,
          unknown
        >;
      } catch {
        r = { ok: false, error: 'tag_failed' };
      }

      if (!r.ok) {
        setTagNotice(tagErrorMessage(String(r.error ?? 'tag_failed')));
        // Retry a transient error by clearing the debounce so a held code
        // self-heals; deterministic outcomes stay debounced.
        if (r.error === 'tag_failed') lastScanRef.current = '';
        return;
      }

      if (typeof navigator !== 'undefined') navigator.vibrate?.(60);
      setTagCount(Number(r.tag_count ?? 0));
      const names = Array.isArray(r.names) ? (r.names as string[]) : [];
      const added = Number(r.added ?? 0);
      if (added > 0) {
        // The confirmation: "✓ Ana Reyes tagged" · "✓ Table 4 · 8 added".
        const entry =
          r.kind === 'table'
            ? `${typeof r.table_label === 'string' ? r.table_label : 'Table'} · ${formatCount(added)} added`
            : null;
        const name = names[0] ?? 'Guest';
        setTagLog((prev) => [...prev, entry ? { hint: entry, chip: entry } : { hint: name, chip: `${name} tagged` }]);
      }
      if (r.kind === 'table') {
        const label = typeof r.table_label === 'string' ? r.table_label : 'that table';
        if (added === 0 && Number(r.total_at_table ?? 0) === 0) {
          setTagNotice(`No one’s seated at ${label} yet.`);
        } else if (r.truncated) {
          // `truncated` can no longer be set — the server stopped capping. Kept
          // so an older server payload still reads sensibly.
          setTagNotice(`${label}: added ${added}.`);
        } else if (added === 0) {
          setTagNotice(`Everyone at ${label} is already tagged.`);
        } else {
          setTagNotice(null);
        }
      } else {
        setTagNotice(r.already ? `${names[0] ?? 'They’re'} already tagged.` : null);
      }
    },
    [lastCaptureId],
  );

  // Decode loop — runs only while the tag sheet is open, on the EXISTING rear
  // stream. Serial + debounced on the raw payload so a held code fires once.
  useEffect(() => {
    if (!tagging) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    void (async () => {
      const detect = await makeQrDetector();
      if (!active) return;
      const loop = async () => {
        if (!active) return;
        const video = videoRef.current;
        if (video && !tagBusyRef.current) {
          const raw = await detect(video).catch(() => null);
          if (active && raw && raw !== lastScanRef.current) {
            lastScanRef.current = raw;
            tagBusyRef.current = true;
            try {
              await handleScan(raw);
            } finally {
              tagBusyRef.current = false;
            }
          }
        }
        if (active) timer = setTimeout(loop, 200);
      };
      void loop();
    })();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [tagging, handleScan, videoRef]);

  // ---- Kwento Flash countdown timer ----------------------------------------

  // Starts when Flash phase opens; clears on send, dismiss, or unmount.
  useEffect(() => {
    if (kwentoPhase !== 'flash') {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (flashIntervalRef.current) clearInterval(flashIntervalRef.current);
      return;
    }
    setFlashCountdown(5);
    flashIntervalRef.current = setInterval(
      () => setFlashCountdown((c) => Math.max(0, c - 1)),
      1000,
    );
    // Auto-dismiss to Story after 5 seconds.
    flashTimerRef.current = setTimeout(() => {
      setKwentoPhase((p) => (p === 'flash' ? 'story' : p));
    }, 5000);
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (flashIntervalRef.current) clearInterval(flashIntervalRef.current);
    };
  }, [kwentoPhase]);

  // ---- send helpers ---------------------------------------------------------

  const dismissFlash = useCallback(() => {
    if (kwentoPhase !== 'flash') return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    if (flashIntervalRef.current) clearInterval(flashIntervalRef.current);
    setKwentoPhase('story');
  }, [kwentoPhase]);

  const sendFlash = async () => {
    if (!kwentoCaptureId || kwentoPhase === 'flash_sending') return;
    const text = kwentoFlashText.trim();
    if (text.length < 1) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    if (flashIntervalRef.current) clearInterval(flashIntervalRef.current);
    setKwentoPhase('flash_sending');
    setKwentoError(null);
    try {
      const res = await fetch('/api/papic/kwento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captureId: kwentoCaptureId,
          body: text,
          voiceDepth: 'flash',
          // Flash consent is covered by the Papic session claim.
          consent: true,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        state?: string;
        error?: string;
        messageId?: string;
      };
      if (res.ok && json.ok) {
        setSentMessageId(json.messageId ?? null);
        setDeletePhase('idle');
        // Flash sent → immediately offer Story ("Tell them more?").
        setKwentoPhase('story');
        return;
      }
      setKwentoPhase('flash');
      setKwentoError(
        json.error === 'keep_it_sweet'
          ? "Let's keep it sweet 💛 — try rephrasing."
          : json.error === 'limit_reached'
            ? "You've shared all the photo notes this event allows — salamat!"
            : json.error === 'too_fast'
              ? 'One photo note at a time — give it a few seconds.'
              : "That didn't send — try again.",
      );
    } catch {
      setKwentoPhase('flash');
      setKwentoError('No signal — try again in a moment.');
    }
  };

  const sendStory = async () => {
    if (!kwentoCaptureId || kwentoPhase === 'story_sending') return;
    const text = kwentoStoryText.trim();
    if (text.length < 1 || !kwentoConsent) return;
    setKwentoPhase('story_sending');
    setKwentoError(null);
    try {
      const res = await fetch('/api/papic/kwento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captureId: kwentoCaptureId,
          body: text,
          voiceDepth: 'story',
          consent: true,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        state?: string;
        error?: string;
        messageId?: string;
      };
      if (res.ok && json.ok) {
        setKwentoPhase(json.state === 'flagged' ? 'held' : 'sent');
        setSentMessageId(json.messageId ?? null);
        setDeletePhase('idle');
        return;
      }
      setKwentoPhase('story');
      setKwentoError(
        json.error === 'keep_it_sweet'
          ? "Let's keep it sweet 💛 — try rephrasing that one."
          : json.error === 'limit_reached'
            ? "You've shared all the photo notes this event allows — salamat!"
            : json.error === 'too_fast'
              ? 'One photo note at a time — give it a few seconds.'
              : "That didn't send — try again.",
      );
    } catch {
      setKwentoPhase('story');
      setKwentoError('No signal — try again in a moment.');
    }
  };

  const deleteKwento = async () => {
    if (!sentMessageId || deletePhase === 'deleting') return;
    setDeletePhase('deleting');
    try {
      const res = await fetch('/api/papic/kwento/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: sentMessageId }),
      });
      setDeletePhase(res.ok ? 'deleted' : 'idle');
    } catch {
      setDeletePhase('idle');
    }
  };

  if (blocked) {
    return (
      <CardFrame embedded={embedded} pad="py-12">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-7 text-center text-ink shadow-sm">
          <CircleAlert aria-hidden className="mx-auto h-7 w-7 text-terracotta" strokeWidth={1.75} />
          <h1 className="mt-3 text-xl font-semibold tracking-tight">Camera unavailable</h1>
          <p className="mt-2 text-sm text-ink/65">
            The host has turned off your guest camera for this event. If you
            think this is a mistake, reach out to the host directly.
          </p>
        </div>
      </CardFrame>
    );
  }

  // UGC terms-of-use gate — shown once, before the first capture. Defines what
  // counts as objectionable content and requires explicit acceptance (Apple
  // 1.2 / Google Play UGC EULA requirement).
  if (!accepted) {
    return (
      <CardFrame embedded={embedded} pad="py-10">
        <div className="sn-rise mx-auto w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-7 text-ink shadow-sm">
          <ShieldCheck aria-hidden className="h-7 w-7 text-mulberry" strokeWidth={1.75} />
          <h1 className="mt-3 text-xl font-semibold tracking-tight">
            Before you start shooting
          </h1>
          <p className="mt-2 text-sm text-ink/70">
            Your photos go straight into {eventName}&rsquo;s Memories and may be
            seen by other guests and the host. By using this camera you agree
            to our{' '}
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-mulberry underline underline-offset-2"
            >
              Terms of Use
            </a>{' '}
            and to keep your shots free of objectionable content.
          </p>
          <ul className="mt-4 space-y-1.5 text-sm text-ink/65">
            <li>· No nudity, sexual, or explicit content.</li>
            <li>· No violence, hate, or harassment of any guest.</li>
            <li>· Only candid moments from this event.</li>
          </ul>
          <p className="mt-3 text-xs text-ink/55">
            The host can hide any photo, report it to Setnayan, and block your
            camera. Reported content is reviewed by our team.
          </p>

          <label className="mt-5 flex items-start gap-3 rounded-xl border border-ink/10 bg-cream px-4 py-3 text-sm text-ink/80">
            <input
              type="checkbox"
              checked={agreeChecked}
              onChange={(e) => setAgreeChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-mulberry"
            />
            <span>I agree to the Terms of Use and will only share appropriate photos.</span>
          </label>

          {acceptError && (
            <p role="alert" className="mt-3 text-center text-xs text-terracotta">
              {acceptError}
            </p>
          )}

          <button
            type="button"
            onClick={acceptTerms}
            disabled={!agreeChecked || acceptBusy}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:opacity-40"
          >
            {acceptBusy ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
            ) : (
              <Camera aria-hidden className="h-4 w-4" strokeWidth={2} />
            )}
            Agree &amp; open my camera
          </button>
        </div>
      </CardFrame>
    );
  }

  if (camError) {
    return (
      <CardFrame embedded={embedded} pad="py-12">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-7 text-center text-ink shadow-sm">
          <CircleAlert aria-hidden className="mx-auto h-7 w-7 text-terracotta" strokeWidth={1.75} />
          <h1 className="mt-3 text-xl font-semibold tracking-tight">We need your camera</h1>
          <p className="mt-2 text-sm text-ink/65">
            Allow camera access for Setnayan in your browser, then reload this
            page to start shooting.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex items-center justify-center rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600"
          >
            Reload &amp; try again
          </button>
        </div>
      </CardFrame>
    );
  }

  // Face enroll panel — the front-camera selfie owns the camera while this is
  // up (the rear capture stream was released by the effect above).
  if (enrolling) {
    return (
      <main className="flex min-h-screen flex-col bg-ink px-4 py-8 text-cream">
        <div className="sn-rise mx-auto mt-6 w-full max-w-md">
          <DayOfFaceEnroll
            context="guest_camera"
            faceMode={faceMode}
            wish={faceTaggingWish}
            onDone={() => {
              setEnrolled(true);
              setEnrolling(false);
            }}
            onSkip={() => setEnrolling(false)}
            /* "No thanks" — back to the camera, and no face prompt again. */
            onDecline={() => {
              setPromptDismissed(true);
              setEnrolling(false);
            }}
          />
        </div>
      </main>
    );
  }

  // Hoist before JSX to avoid TS2367: kwentoPhase === 'flash' narrows the type
  // inside the flash JSX block, making === 'flash_sending' always-false there.
  const isFlashSending = kwentoPhase === 'flash_sending';
  const isStorySending = kwentoPhase === 'story_sending';

  /* 🖼 My shots: this visit's (a shot still on the phone marked "waiting"), then
     the earlier ones already in this event's Memories (the sheet marks waiting). */
  const myShotsList: MyShot[] = [
    ...sessionShots,
    ...(myShots ?? []).map((sh) => ({ id: sh.id, url: sh.url, media: 'photo' as const })),
  ];

  /* 📷 The Pro dress puts the event's logo on a white shutter; free is the plain shutter. */
  const shutterLogo = pro && dress?.logo ? dress.logo : null;

  return (
    <main
      data-camera-dress={pro ? 'pro' : 'free'}
      className={
        fullScreen
          ? 'flex h-[100dvh] flex-col overflow-hidden bg-ink text-cream'
          : 'flex min-h-screen flex-col bg-ink text-cream'
      }
    >
      <header className={`flex items-center px-4 py-3 ${exitTo ? 'justify-between' : 'justify-end'}`}>
        {/* ✕ ONE EXIT, TOP-LEFT — back to the Event Hub tab this was opened
            from, with the count of shots that landed. */}
        {exitTo ? (
          <a
            data-camera-exit=""
            href={cameraExitHref(exitTo.slug, exitTo.tab, added)}
            aria-label="Close the camera"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-cream/10 text-cream hover:bg-cream/20"
          >
            <X aria-hidden className="h-5 w-5" strokeWidth={2} />
          </a>
        ) : null}
        {/* A PERSONAL COUNTDOWN ONLY WHERE ONE IS REAL.
            It used to be unconditional, so every guest on every celebration was
            shown a number counting down to a ceiling the database does not
            apply. Where the pot is the ceiling there is no personal allowance to
            print — so we print nothing, until the POT itself is running low, and
            then we name the celebration's own number rather than invent a
            per-guest one. "Unlimited" is gone with the same reasoning: a pot is
            finite, and saying otherwise would be a promise we cannot keep.

            🔒 AND IT NO LONGER NAMES THE CELEBRATION'S NUMBER (owner-locked,
            PRIV-1). The pot branch below used to read "N left for everyone" —
            the couple's remaining credits, printed for a guest who is not an
            event member on either of this component's two mounts. The warning
            survives because the guest genuinely needs it; the figure does not,
            because it is the couple's money.

            ⚠ THE PERSONAL COUNTER ABOVE IT IS A DIFFERENT THING AND STAYS. That
            number is the READER'S OWN allowance — her 150, or the ceiling the
            couple set on her — and hiding a guest's own number from that guest
            would be a second bug wearing this one's clothes. */}
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        {/* 📡 Save first, send later — the uploader's one line (details in ⓘ). */}
        <PapicUploadChip readyWhenIdle />
        {/* The event's credits ran out: the camera says so over the picture and the
            status chip counts what waits — a personal count beside it would read as
            shots still to take (owner prototype 2026-10-24 hides it). */}
        {capApplies && !poolEmpty ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1 text-xs font-medium text-cream" data-tour="camera-credits">
            <ImageIcon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            {low ? `Running low — ${formatCount(remaining)} ${remaining === 1 ? 'credit' : 'credits'} left` : `${formatCount(remaining)} ${remaining === 1 ? 'credit' : 'credits'} left`}
            {sponsorShare ? <span className="text-cream/60">· a sponsor’s share</span> : null}
          </span>
        ) : poolEmpty ? null /* run out: the camera says so itself — "running low" would be false */ : poolLow ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1 text-xs font-medium text-cream" data-tour="camera-credits">
            <ImageIcon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Running low for everyone
          </span>
        ) : null}
        </div>
      </header>

      {/* In-camera "add your face" fallback — catches the guest who jumped
          straight to shooting without enrolling on their landing page. Opens the
          front-camera selfie panel; dismissible. QR scan is the fallback either way. */}
      {needsFaceEnroll && !enrolled && !promptDismissed ? (
        <div className="mx-3 mb-1 flex items-center gap-2 rounded-xl bg-cream/10 px-3 py-2 text-xs text-cream/90">
          <Sparkles aria-hidden className="h-4 w-4 shrink-0 text-cream" strokeWidth={1.75} />
          <button
            type="button"
            onClick={() => setEnrolling(true)}
            className="flex-1 text-left font-medium underline-offset-2 hover:underline"
          >
            Add your face so your photos find you
          </button>
          <button
            type="button"
            onClick={() => setPromptDismissed(true)}
            aria-label="Dismiss"
            className="shrink-0 rounded-full p-1 text-cream/60 hover:text-cream"
          >
            <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      ) : null}

      <div ref={viewfinderRef} onClick={onViewfinderTap} className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full object-cover"
          /* Live preview of the locked event look — presentation-only, so the
             captured pixels (and the clean face embed) are unaffected.
             A digital 2× scales the preview about its centre — except while a
             clip records: a clip is the whole frame, so the preview says so. */
          style={{
            transform: [mirrored ? 'scaleX(-1)' : '', crop > 1 && !recording ? `scale(${crop})` : '']
              .filter(Boolean)
              .join(' ') || undefined,
            filter: cssPreviewFilter(eventStyle),
          }}
        />
        {grid && !tagging && !exhausted ? <GuestGridLines /> : null}
        {/* 🎯 THE FOCUS CORNERS — white, or the theme's colour on a Pro event. */}
        {/* Inset as the prototype draws them — clear of the grid button and the Selfie · Main pill above. */}
        {!tagging && !exhausted ? <FocusCorners tint={tint} inset="inset-x-8 top-[60px] bottom-16" /> : null}
        {focusMark ? <GuestFocusSquare key={focusMark.key} x={focusMark.x} y={focusMark.y} /> : null}
        {((!ready && !exhausted) || switching) && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/80">
            <Loader2 aria-hidden className="h-6 w-6 animate-spin text-cream/70" strokeWidth={2} />
          </div>
        )}
        {/* Flip + lens controls (each gated to what the device exposes; hidden
            while recording / tagging so the stage stays clean). */}
        {ready && !exhausted && !tagging && !recording && (
          <GuestCameraTools
            grid={grid}
            onGrid={toggleGrid}
            canFlip={canFlip}
            selfie={facing === 'user'}
            onFlip={flip}
            steps={zoomSteps(lensOptions, facing)}
            lens={lens}
            onSelectLens={selectLens}
            disabled={switching}
            tint={pro ? tint : null}
          />
        )}
        {/* 🏷 Tag who's in it — the scanner is a framed window over the picture. */}
        {tagging ? <TagScannerOverlay tagCount={tagCount} confirmation={tagLog.at(-1)?.chip ?? null} /> : null}
        {recording && (
          <>
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-terracotta/90 px-2.5 py-1 text-xs font-semibold text-cream">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cream" />
              REC
            </span>
            {/* 10-second countdown as a bottom progress bar. */}
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-cream/20">
              <div
                className="h-full bg-terracotta transition-[width] duration-100 ease-linear"
                style={{ width: `${Math.round((recElapsed / MAX_CLIP_MS) * 100)}%` }}
              />
            </div>
          </>
        )}
        {/* ARMED-CHALLENGE indicator (SELECT → COMMENCE) — shows on the stage
            what the next shot counts for, until the capture completes it. */}
        {armedChallenge && !exhausted ? (
          <span className="absolute inset-x-3 bottom-16 mx-auto inline-flex w-fit max-w-full items-center gap-1.5 rounded-full bg-ink/70 px-3 py-1.5 text-xs font-medium text-cream">
            <Trophy aria-hidden className="h-3.5 w-3.5 shrink-0 text-cream" strokeWidth={2} />
            <span className="truncate">
              Next shot: {armedChallenge.prompt}
            </span>
          </span>
        ) : null}
        {justSaved && (
          <div className="absolute inset-0 flex items-center justify-center bg-cream/15">
            <span className="inline-flex items-center gap-2 rounded-full bg-ink/70 px-4 py-2 text-sm font-medium text-cream">
              <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} /> Saved
            </span>
          </div>
        )}
        {exhausted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/85 px-6 text-center">
            {poolEmpty ? (
              /* THE CELEBRATION ran out, not this guest. No tick and no thank-you
                 — nothing was finished here, and congratulating somebody for a
                 shot that was thrown away is the exact defect this splits. */
              <>
                <ImageIcon aria-hidden className="h-8 w-8 text-cream" strokeWidth={2} />
                <p className="text-base font-semibold" data-papic-pool-empty="">
                  This event&rsquo;s credits have run out — the hosts can add more.
                </p>
                <p className="text-sm text-cream/70">
                  Everybody here shares one set of credits. Your camera starts again
                  the moment they do.
                </p>
              </>
            ) : (
              <>
                <Check aria-hidden className="h-8 w-8 text-cream" strokeWidth={2} />
                <p className="text-base font-semibold">That&rsquo;s all {formatCount(total)} photos!</p>
                <p className="text-sm text-cream/70">
                  Thank you for helping capture {eventName}. They’ll treasure these.
                </p>
                {/* THE ONE SENTENCE OF DIFFERENCE (S4, per owner ruling relayed
                    2026-08-30): a ceiling the COUPLE set has a remedy the
                    platform's flat 150 does not. Scoped tight — names that a
                    remedy exists without promising it happens, without
                    implying anything just taken was lost, and without sending
                    her to go ask them mid-celebration. Server-authoritative:
                    only fires when the RPC itself says `guest_spend_ceiling`. */}
                {capReason === 'guest_spend_ceiling' ? (
                  <p className="text-sm text-cream/70">
                    This is the limit the host set for you — they can raise it at
                    any time.
                  </p>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>

      <div className={fullScreen ? 'max-h-[45dvh] space-y-3 overflow-y-auto px-4 pb-6 pt-3' : 'space-y-3 px-4 pb-8 pt-4'}>
        {saveError && <p className="text-center text-xs text-cream/80">{saveError}</p>}

        {/* 📷 PHOTO ⇄ SNIPPET (owner 2026-10-24) — one pill, so a guest can
            choose Snippet on purpose. Hold-to-record still works in Photo. */}
        <div className="flex items-center justify-between gap-2">
          {/* 🏆 "Challenge · … ▾" — the event's running challenges as one dropdown (owner prototype 2026-10-24). */}
          {!exhausted ? <span className="inline-flex" data-tour="camera-challenge"><ChallengePill c={challenges} /></span> : null}
          <div role="group" aria-label="Photo or snippet" data-tour="camera-mode" className="ml-auto flex shrink-0 gap-0.5 rounded-full bg-cream/10 p-[3px]">
            {(['photo', 'snippet'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                disabled={recording}
                onClick={() => setMode(m)}
                data-camera-mode={m}
                className={`relative h-8 min-h-0 rounded-full px-3 text-[12.5px] font-semibold transition after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] ${
                  mode === m ? 'bg-cream text-ink' : 'text-cream/75'
                }`}
              >
                {m === 'photo' ? 'Photo' : 'Snippet'}
              </button>
            ))}
          </div>
        </div>

        {/* THE gesture shutter: tap = photo, press-and-hold = record. Pointer
            events (not onClick) drive the hold detection; the guards kill iOS
            long-press selection / the context menu so a hold reliably records.
            Run out, it stays drawn and rests (disabled) — owner prototype 2026-10-24. */}
        <div className="relative flex h-[84px] items-center justify-center">
            {/* 🖼 MY SHOTS, one tap away — a sheet OVER the camera, never a new
                page (owner 2026-10-24, pick 3). The badge counts shots still on
                this phone while they cannot send. */}
            <button
              type="button"
              data-camera-thumb=""
              onClick={() => setShotsOpen(true)}
              data-tour="camera-shots"
              aria-label="My shots"
              aria-haspopup="dialog"
              aria-expanded={shotsOpen}
              className="absolute left-0 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-lg border-2 border-cream/70 bg-cream/10"
            >
              <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-md">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon aria-hidden className="h-5 w-5 text-cream/70" strokeWidth={1.75} />
                )}
              </span>
              <MyShotsWaitingBadge eventId={eventId} />
            </button>
            <div className="relative h-[4.5rem] w-[4.5rem]">
              {recording && (
                <svg
                  aria-hidden
                  viewBox="0 0 72 72"
                  className="pointer-events-none absolute inset-0 -rotate-90"
                >
                  <circle cx="36" cy="36" r="32" fill="none" stroke="rgba(245,240,232,0.18)" strokeWidth="4" />
                  <circle
                    cx="36"
                    cy="36"
                    r="32"
                    fill="none"
                    stroke="var(--m-terracotta, #c4674f)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 32}
                    strokeDashoffset={2 * Math.PI * 32 * Math.min(recElapsed / MAX_CLIP_MS, 1)}
                    style={{ transition: 'stroke-dashoffset 100ms linear' }}
                  />
                </svg>
              )}
              <button
                type="button"
                onPointerDown={onShutterDown}
                onPointerUp={onShutterUp}
                onPointerCancel={onShutterCancel}
                onContextMenu={(e) => e.preventDefault()}
                disabled={busy || !ready || switching || tagging || exhausted}
                aria-label={
                  recording
                    ? mode === 'snippet'
                      ? 'Recording — tap to stop'
                      : 'Recording — release to stop'
                    : mode === 'snippet'
                      ? 'Tap to start a snippet, tap again to stop'
                      : 'Tap to take a photo, or press and hold to record a snippet'
                }
                data-shutter={shutterLogo ? 'pro' : 'free'}
                data-tour="camera-shutter"
                className={
                  shutterLogo
                    ? 'flex h-full w-full items-center justify-center rounded-full border-4 border-white p-1 transition active:scale-95 disabled:opacity-40'
                    : `flex h-full w-full items-center justify-center rounded-full border-4 border-cream/80 transition active:scale-95 disabled:opacity-40 ${
                        recording ? 'bg-terracotta/30' : 'bg-cream/10'
                      }`
                }
                style={{
                  touchAction: 'manipulation',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                }}
              >
                {shutterLogo ? (
                  <span
                    className={`flex h-full w-full items-center justify-center overflow-hidden rounded-full ${
                      recording ? 'bg-terracotta' : 'bg-white'
                    }`}
                  >
                    {busy ? (
                      <Loader2 aria-hidden className="h-7 w-7 animate-spin text-ink" strokeWidth={2} />
                    ) : recording ? (
                      <Square aria-hidden className="h-6 w-6 text-cream" strokeWidth={2.5} />
                    ) : (
                      <span data-shutter-logo="" className="flex items-center justify-center">
                        {shutterLogo}
                      </span>
                    )}
                  </span>
                ) : busy ? (
                  <Loader2 aria-hidden className="h-7 w-7 animate-spin text-cream" strokeWidth={2} />
                ) : recording ? (
                  <Square aria-hidden className="h-6 w-6 text-cream" strokeWidth={2.5} />
                ) : (
                  <Camera aria-hidden className="h-7 w-7 text-cream" strokeWidth={1.75} />
                )}
              </button>
            </div>

            {/* Keyboard / assistive-tech path — the press gesture is pointer-only. */}
            <div className="sr-only">
              <button type="button" onClick={() => void capture()} disabled={busy || !ready || tagging}>
                Take a photo
              </button>
              <button
                type="button"
                onClick={() => (recording ? stopRecording() : void startRecording())}
                disabled={busy || !ready || tagging}
              >
                {recording ? 'Stop recording' : 'Record a 10-second snippet'}
              </button>
            </div>

            {/* 🏷 TAG WHO'S IN IT — beside the shutter (owner 2026-10-24, pick 2).
                Offered after a shot; opens the scanner over the live picture.
                Tagging is optional — the photo already landed. The slot stays
                reserved so the shutter never moves. */}
            <button
              type="button"
              onClick={tagging ? stopTagging : startTagging}
              aria-label={tagging ? 'Done tagging' : 'Tag who’s in it'}
              aria-pressed={tagging}
              data-camera-tag={tagging ? 'on' : 'off'}
              className={`absolute right-0 top-1/2 flex w-16 -translate-y-1/2 flex-col items-center gap-1 ${
                lastCaptureId && !exhausted ? '' : 'invisible'
              }`}
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full ${
                  tagging ? 'bg-cream text-ink' : 'bg-cream/10 text-cream'
                }`}
              >
                <ScanLine aria-hidden className="h-5 w-5" strokeWidth={2} />
              </span>
              <small className="text-center text-[10px] font-medium leading-tight text-cream/85">
                {tagging ? 'Done tagging' : 'Tag who’s in it'}
              </small>
            </button>
        </div>
        {/* ONE run-out sentence (walk-b6 guest, fault 2, 2026-10-14): at zero it is said
            over the viewfinder, where the shutter would be — the caption no longer repeats it. */}
        {exhausted && poolEmpty ? null : (
          <p className="text-center text-xs text-cream/60" data-camera-hint="">
            {exhausted
              ? 'Your camera is all used up — enjoy the event.'
              : recording
                ? `Recording… ${Math.ceil((MAX_CLIP_MS - recElapsed) / 1000)}s left`
                : tagging
                  ? tagNotice ??
                    (tagLog.length > 0
                      ? tagLog.map((t) => t.hint).join(' · ')
                      : 'Hold a guest’s QR or a table sign in the frame — no tap needed.')
                  : mode === 'snippet'
                    ? 'Tap to start · tap again or let go to stop (up to 10s).'
                    : 'Tap for a photo · press and hold to record (up to 10s).'}
          </p>
        )}

        {/* Papic Challenges (Papic Games §5#3) — self-gated: renders nothing
            until NEXT_PUBLIC_PAPIC_GAMES_V1 is on / the event has live missions.
            SELECT → COMMENCE → RETAKE: the guest arms a challenge, the next
            capture completes it (the panel watches lastCaptureId). */}
        {/* 🏆 What a challenge adds under the shutter: the pause, a completion, its share ask, the reward. */}
        <ChallengeFollowUp c={challenges} storyHref={storyToken ? `/papic/me/${encodeURIComponent(storyToken)}#story` : null} />

        {/* Public-sharing opt-in (Alaala orb gate · RA 10173). Explicit, never
            pre-checked, default OFF. When ON, the shots this guest captures are
            sent with share_publicly so the couple MAY feature them publicly
            (the couple still has to approve each one — both gates required). */}
        {!exhausted ? (
          /* ONE LINE, THE DETAIL IN THE ⓘ (owner 2026-10-24 prototype): the
             shipped two-line card, compacted. The ⓘ is a button, so pressing it
             never ticks the box; pressing the line does. */
          <label
            data-camera-share=""
            htmlFor={shareId}
            className="flex min-h-11 items-center gap-2.5 rounded-xl border border-cream/15 px-2.5 text-[12.5px] text-cream/90 [&_button]:border-cream/50 [&_button]:text-cream/80"
          >
            <input
              id={shareId}
              type="checkbox"
              checked={sharePublicly}
              onChange={(e) => setSharePublicly(e.target.checked)}
              className="h-[18px] w-[18px] shrink-0 accent-mulberry"
            />
            <InfoTip
              label="Let the host feature my clips on their event page"
              labelClassName="min-w-0 truncate"
              className="min-w-0 flex-1 justify-between"
              align="end"
            >
              Optional. Your photos always reach the host either way — this just lets them share the ones you
              take publicly on their event page. You can leave it off.
            </InfoTip>
          </label>
        ) : null}

        {/* ── Flash prompt — bottom one-liner, auto-dismisses in 5 s ──────── */}
        {/* canKwento gates the whole Kwento UI: the event must own the paid SKU. */}
        {canKwento && kwentoCaptureId && kwentoPhase === 'flash' ? (
          <div className="rounded-xl border border-cream/20 bg-cream/8 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-cream/90">
                <span className="mr-1">⚡</span> One line. What just happened?
              </p>
              <span className="shrink-0 rounded-full bg-cream/15 px-2 py-0.5 font-mono text-[11px] text-cream/60">
                {flashCountdown}s
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={kwentoFlashText}
                onChange={(e) => setKwentoFlashText(e.target.value.slice(0, 50))}
                placeholder="Hindi mapigil ang tawa…"
                className="flex-1 rounded-md border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-cream/40 focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={() => void sendFlash()}
                disabled={isFlashSending || kwentoFlashText.trim().length === 0}
                aria-label="Send"
                className="shrink-0 rounded-md bg-mulberry px-3 py-2 text-sm font-medium text-cream disabled:opacity-40"
              >
                {isFlashSending ? (
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
                ) : (
                  '↑'
                )}
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[10px] text-cream/35">{kwentoFlashText.length}/50</span>
              <button
                type="button"
                onClick={dismissFlash}
                className="text-[11px] text-cream/40 underline underline-offset-2 hover:text-cream/70"
              >
                Skip
              </button>
            </div>
            {kwentoError ? (
              <p className="mt-1 text-xs text-terracotta">{kwentoError}</p>
            ) : null}
          </div>
        ) : null}

        {/* ── Story offer — appears after Flash sends or is dismissed ──────── */}
        {canKwento && kwentoCaptureId && kwentoPhase === 'story' ? (
          <div className="rounded-xl border border-cream/15 bg-cream/5 p-3">
            <p className="text-sm font-medium text-cream/90">
              ✍️ Tell them more? {sentMessageId ? '(Optional — Flash already sent 💛)' : 'Ano\'ng nangyari dito?'}
            </p>
            <textarea
              value={kwentoStoryText}
              onChange={(e) => setKwentoStoryText(e.target.value.slice(0, 280))}
              rows={2}
              placeholder="Right after the first dance — hindi mapigil ang tawa…"
              className="mt-2 w-full resize-none rounded-md border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-cream/40 focus:outline-none"
            />
            <div className="mt-1 text-right text-[11px] text-cream/40">{kwentoStoryText.length}/280</div>
            <label className="mt-1 flex items-start gap-2 text-xs text-cream/70">
              <input
                type="checkbox"
                checked={kwentoConsent}
                onChange={(e) => setKwentoConsent(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-mulberry"
              />
              <span>
                I&rsquo;m okay for the host &amp; guests to see my name + message, and to
                use it in their event video. 💛
              </span>
            </label>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void sendStory()}
                disabled={isStorySending || kwentoStoryText.trim().length === 0 || !kwentoConsent}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:opacity-50"
              >
                {isStorySending ? (
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
                ) : null}
                Send to the host 💌
              </button>
              {sentMessageId ? (
                <button
                  type="button"
                  onClick={() => setKwentoPhase('sent')}
                  className="rounded-md border border-cream/15 px-3 py-2 text-sm text-cream/60 hover:text-cream"
                >
                  Done
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setKwentoPhase('idle')}
                  className="rounded-md border border-cream/15 px-3 py-2 text-sm text-cream/60 hover:text-cream"
                >
                  Skip
                </button>
              )}
            </div>
            {kwentoError ? (
              <p className="mt-2 text-xs text-terracotta">{kwentoError}</p>
            ) : null}
          </div>
        ) : null}

        {/* ── Confirmation / delete ─────────────────────────────────────────── */}
        {canKwento && (kwentoPhase === 'sent' || kwentoPhase === 'held') ? (
          <div className="space-y-1 text-center">
            <p className="text-xs text-cream/80">
              {kwentoPhase === 'sent'
                ? 'Naipadala na! 💛 Salamat — your story is on its way to the host.'
                : 'Sent — held for the host to review first. 💛'}
            </p>
            {sentMessageId && deletePhase !== 'deleted' ? (
              <button
                type="button"
                onClick={() => void deleteKwento()}
                disabled={deletePhase === 'deleting'}
                className="text-[11px] text-cream/50 underline underline-offset-2 hover:text-cream/80 disabled:opacity-50"
              >
                {deletePhase === 'deleting' ? 'Removing…' : 'Changed your mind? Delete this story'}
              </button>
            ) : null}
            {deletePhase === 'deleted' ? (
              <p className="text-[11px] text-cream/50">Deleted — it won&rsquo;t be shared.</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <MyShotsSheet open={shotsOpen} onClose={closeShots} shots={myShotsList} eventId={eventId} />

      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
