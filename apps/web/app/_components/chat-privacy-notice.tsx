'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, X } from 'lucide-react';

/**
 * Pinned, non-dismissible system notice at the top of every chat thread
 * (couple-side AND vendor-side mirror). Iteration 0019 § Gate, locked
 * 2026-05-14. The notice is not stored in chat_messages, doesn't count
 * toward unread, and has no sender attribution.
 *
 * Copy is locale-resolved per iteration 0015. EN-PH is the canonical
 * string; TL and CEB land in the next locale pass.
 *
 * ── ONE LINE, SINCE 2026-09-18 (One Chat Box) ───────────────────────────────
 * It used to be a bordered paragraph — one of the seven cards stacked above the
 * conversation that left the message list 32px tall on a phone. It is now ONE
 * line: the lead, and a "More" toggle that opens the full locked copy in
 * place. Nothing was cut and nothing became dismissible: the 0019 lock says
 * pinned and non-dismissible, and this keeps both.
 */
/**
 * ── TWO READERS, ONE NOTICE (owner, 2026-09-18) ─────────────────────────────
 * The 0019 lock says the notice is pinned on BOTH sides. Its canonical string
 * is written to the couple — "your vendor sees what they need from your
 * profile" — and for four months that exact sentence was pinned above the
 * SUPPLIER's conversation too, telling a shop about "your vendor". The owner
 * read it on the client page and named it. The supplier's line says the same
 * thing from the supplier's side: what they need is already here, and asking
 * for the listed items in chat is what the couple is told to report.
 *
 * `viewer` picks the reader. The couple's string is unchanged, byte for byte.
 */
const COPY = {
  'en-PH': {
    couple: {
      lead: 'All your event info is already in Setnayan',
      body: '— your vendor sees what they need from your profile. Please don’t share private info in chat.',
      examples: 'government IDs · card numbers · full addresses · OTPs · passwords',
      report: 'If a vendor asks for these, report it via Help.',
    },
    vendor: {
      lead: 'Everything you need for this event is already in Setnayan',
      body: '— their profile and this conversation carry it. Never ask for private info in chat.',
      examples: 'government IDs · card numbers · full addresses · OTPs · passwords',
      report: 'Couples are told to report a vendor who asks for these.',
    },
  },
  // TL / CEB placeholders — wire the locale key now, copy lands in the next
  // locale pass (per spec § Gate "EN required; TL + CEB strings TBD").
} as const;

type Locale = keyof typeof COPY;
export type ChatPrivacyViewer = 'couple' | 'vendor';

/**
 * `inBox` — rendered as a flush line inside the chat box's frame (border-b,
 * no radius). Off, it keeps the rounded standalone look for the mounts that
 * still stack it above a stream (the client brief's Chat tab).
 */
const NOTE_LINE =
  'flex items-start gap-2 text-[11px] leading-snug text-ink/70';
const NOTE_IN_BOX = `${NOTE_LINE} border-b border-ink/10 bg-ink/[0.02] px-3 py-1 sm:px-4`;
const NOTE_STANDALONE = `${NOTE_LINE} rounded-xl border border-ink/10 bg-ink/[0.03] px-3 py-1.5`;

const TOGGLE =
  'shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-mulberry underline underline-offset-2 hover:text-mulberry-600';

export function ChatPrivacyNotice({
  locale = 'en-PH',
  inBox = false,
  viewer = 'couple',
}: {
  locale?: Locale | string;
  inBox?: boolean;
  /** Who is reading — the string is addressed to them. Defaults to the couple,
   *  the 0019 canonical reader; every supplier mount must say `vendor`. */
  viewer?: ChatPrivacyViewer;
}) {
  const strings = COPY[(locale as Locale) in COPY ? (locale as Locale) : 'en-PH'][viewer];
  const [more, setMore] = useState(false);
  return (
    <div
      role="note"
      aria-label="Chat privacy notice"
      className={inBox ? NOTE_IN_BOX : NOTE_STANDALONE}
    >
      <ShieldAlert
        aria-hidden
        className="mt-[3px] h-3.5 w-3.5 shrink-0 text-terracotta"
        strokeWidth={1.75}
      />
      <p className={`min-w-0 flex-1 self-center ${more ? '' : 'truncate'}`}>
        <span className="font-medium text-ink">{strings.lead}</span>{' '}
        {strings.body}
        {more ? (
          <>
            {' '}
            <span className="underline decoration-terracotta/40 underline-offset-2">
              {strings.examples}
            </span>{' '}
            {strings.report}
          </>
        ) : null}
      </p>
      <button
        type="button"
        onClick={() => setMore((v) => !v)}
        aria-expanded={more}
        className={TOGGLE}
      >
        {more ? 'Less' : 'More'}
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Couple-facing safety banner (build 2026-07-23)                            */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Warm, couple-facing safety guidance pinned at the top of a couple↔vendor
 * thread. Supersedes the plain <ChatPrivacyNotice> on COUPLE surfaces only —
 * it folds in the same "don't share private info" line plus payment-safety
 * guidance, framed for the couple. Vendor surfaces keep <ChatPrivacyNotice>
 * (the safety copy — "a vendor pushing you off-app is a red flag" — is
 * couple-directed and would read oddly on the vendor's own screen).
 *
 * Default visible; dismissible-but-remembered in localStorage so a couple who
 * has internalised it isn't nagged on every thread. Dismiss is per-device and
 * reversible only by clearing storage — the guidance is advisory, not a gate,
 * so a lost dismissal costs nothing. Not stored in chat_messages; no unread
 * impact; no sender attribution.
 *
 * ── ONE LINE, SINCE 2026-09-18 (One Chat Box) ───────────────────────────────
 * The bulleted panel was the second-tallest of seven cards above the
 * conversation. It is now ONE line — the first point, which is the whole
 * message ("Keep your chats and payments inside Setnayan.") — with a "Tips"
 * toggle that opens all four points in place, and the same × that remembers
 * the dismissal. The four points are unchanged; they are one tap further away.
 * Dismissal still PERSISTS (localStorage, as before): this was checked before
 * the redraw, and nothing here made it ephemeral.
 */
const SAFETY_DISMISS_KEY = 'setnayan_chat_safety_banner_dismissed';

const SAFETY_POINTS = [
  'Keep your chats and payments inside Setnayan.',
  'Approve only what you asked for — and pay only the amount you agreed on.',
  'Never share IDs, card numbers, or OTPs in chat.',
  'A vendor rushing you to pay off Setnayan is a red flag — tell us via Help.',
] as const;

const SAFETY_IN_BOX = `${NOTE_LINE} border-b border-ink/10 bg-terracotta/[0.04] px-3 py-1 sm:px-4`;
const SAFETY_STANDALONE = `${NOTE_LINE} rounded-xl border border-terracotta/25 bg-terracotta/[0.05] px-3 py-1.5`;

export function ChatSafetyBanner({ inBox = false }: { inBox?: boolean }) {
  // Default to visible so SSR + first paint never flash the banner in-then-out;
  // the remembered dismissal is applied after hydration if it was set.
  const [dismissed, setDismissed] = useState(false);
  const [tips, setTips] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SAFETY_DISMISS_KEY) === '1') setDismissed(true);
    } catch {
      // Private mode / storage disabled — treat as not dismissed.
    }
  }, []);

  function onDismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(SAFETY_DISMISS_KEY, '1');
    } catch {
      // No-op; banner stays hidden in-memory regardless.
    }
  }

  if (dismissed) return null;

  return (
    <div
      role="note"
      aria-label="Staying safe while you plan"
      className={inBox ? SAFETY_IN_BOX : SAFETY_STANDALONE}
    >
      <ShieldCheck
        aria-hidden
        className="mt-[3px] h-3.5 w-3.5 shrink-0 text-terracotta"
        strokeWidth={1.75}
      />
      <div className="min-w-0 flex-1 self-center">
        {tips ? (
          <>
            <p className="font-medium text-ink">Plan with peace of mind</p>
            <ul className="mt-0.5 space-y-0.5">
              {SAFETY_POINTS.map((point) => (
                <li key={point} className="flex gap-1.5">
                  <span aria-hidden className="text-terracotta/60">
                    ·
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="truncate">
            <span className="font-medium text-ink">{SAFETY_POINTS[0]}</span>
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => setTips((v) => !v)}
        aria-expanded={tips}
        className={TOGGLE}
      >
        {tips ? 'Less' : 'Tips'}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss safety tips"
        className="-mr-1 shrink-0 rounded-full p-1 text-ink/40 hover:bg-ink/5 hover:text-ink/70"
      >
        <X aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
