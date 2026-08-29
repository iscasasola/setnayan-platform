'use client';

/**
 * THE SCAN BLOCK — the codes on the page, not behind a button.
 *
 * Owner, 2026-08-29: *"we do not want the buttons on this page"* and *"QR codes
 * should be ready for scan. these QR Codes should be face taggable."* With no
 * call-to-action anywhere on the page, the code IS the door.
 *
 * ── RULE 0: NOTHING HERE IS NEW ───────────────────────────────────────────
 * This does not build a demo. The two-phone, no-sign-in, face-tagging demo has
 * shipped since 2026-07-03 — scan a code, agree, your own phone reads your own
 * face, then shoot, and the frames land here tagged. It was mounted behind a
 * *Try the demo* button in an overlay. This renders the SAME session, the SAME
 * QR renderer and the SAME realtime channel inline on the page instead.
 * Do not write a second capture path.
 *
 * ── WHY IT MINTS ON THE CLIENT ────────────────────────────────────────────
 * The page is statically rendered and shared by every visitor; a demo session
 * is per-visitor and expires. So the page ships without codes and this
 * component mints a fresh pair on mount. Tokens are never reused across mounts.
 *
 * ⚠ TWO CODES, NOT THREE. The owner asked for more of them. A session is a
 * two-token, two-role row (`demo_sessions.token_a/token_b`, `DemoRole = 'a'|'b'`)
 * all the way through the table, the join route and the realtime protocol — so
 * a third code is a schema-and-protocol change, not a prop. It is deliberately
 * NOT faked here: a third code that cannot be joined is a fake door.
 *
 * ⚠ NOTHING IS PERSISTED. Frames relay peer-to-peer over an ephemeral channel
 * and never reach a table. The shared worldwide wall the owner asked about is a
 * different thing — it needs a public upload endpoint, screening before display,
 * a per-visitor cap and a face-key expiry — and it is not this.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { startDemoSession, type DemoQrPair } from '@/app/_actions/demo-session-actions';
import {
  useDemoChannel,
  untaggedReason,
  type DemoDiag,
  type DemoMessage,
  type DemoRole,
} from '@/app/_components/demo-session/use-demo-channel';
import { PAPIC_STYLES, DEFAULT_PAPIC_STYLE } from '@/lib/papic-photo-styles';

type MirrorPhoto = { id: string; from: DemoRole; dataUrl: string; tags: DemoRole[]; diag?: DemoDiag };

/** The two seats, in the words a visitor uses about them. */
const SEAT: Record<DemoRole, string> = { a: 'You', b: 'A friend' };

export function PapicScan() {
  const [pair, setPair] = useState<DemoQrPair | null>(null);
  const [failed, setFailed] = useState(false);
  const [photos, setPhotos] = useState<MirrorPhoto[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [style, setStyle] = useState<string>(DEFAULT_PAPIC_STYLE);

  useEffect(() => {
    let cancelled = false;
    startDemoSession('papic', window.location.origin)
      .then((p) => {
        if (!cancelled) setPair(p);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The current style answers a phone's style-request. Held in refs so a
  // setState updater never gains a side effect (house rule).
  const styleRef = useRef(style);
  styleRef.current = style;
  const sendRef = useRef<((msg: DemoMessage) => void) | null>(null);

  const onMessage = useCallback((msg: DemoMessage) => {
    if (msg.type === 'photo') {
      setPhotos((prev) =>
        prev.some((p) => p.id === msg.id)
          ? prev
          : [{ id: msg.id, from: msg.from, dataUrl: msg.dataUrl, tags: msg.tags, diag: msg.diag }, ...prev],
      );
      setRemaining(msg.remaining);
    } else if (msg.type === 'style-request') {
      sendRef.current?.({ type: 'style', style: styleRef.current });
    }
  }, []);

  const { presence, send } = useDemoChannel(pair?.sessionId ?? '', undefined, onMessage);
  sendRef.current = send;

  const pickStyle = useCallback(
    (id: string) => {
      setStyle(id);
      send({ type: 'style', style: id });
    },
    [send],
  );

  const styleCss = PAPIC_STYLES.find((s) => s.id === style)?.cssPreview ?? '';
  const blurb = PAPIC_STYLES.find((s) => s.id === style)?.blurb ?? '';

  // A code that could not be minted must not render as a dead square. Say what
  // happened and leave the rest of the page intact.
  if (failed) {
    return (
      <p className="rounded-2xl border border-[var(--m-line)] px-5 py-6 text-sm text-[var(--m-slate-2)]">
        The live codes could not be created just now. Nothing is wrong with your celebration —
        this is only the demo on this page.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--m-line)] bg-[rgb(44_42_41/0.025)] px-4 py-5 sm:px-5">
      <div className="grid grid-cols-2 gap-4 sm:gap-5">
        {(['a', 'b'] as const).map((role) => (
          <Code
            key={role}
            label={SEAT[role]}
            svg={pair ? (role === 'a' ? pair.qrSvgA : pair.qrSvgB) : null}
            joined={presence[role].joined}
            registered={presence[role].registered}
          />
        ))}
      </div>

      {/* The five looks that actually ship. Picked here, on the page the couple
          would be holding — and baked into whatever the phones save. */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PAPIC_STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === style}
            onClick={() => pickStyle(s.id)}
            className={`flex-none rounded-full border px-3 py-1.5 font-mono text-[0.66rem] uppercase tracking-[0.06em] transition ${
              s.id === style
                ? 'border-[var(--m-mulberry)] text-[var(--m-mulberry)]'
                : 'border-[var(--m-line)] text-[var(--m-slate-2)] hover:text-[var(--m-ink)]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 min-h-[1.2em] text-xs text-[var(--m-slate-2)]">{blurb}</p>

      {photos.length > 0 ? (
        <>
          <div className="mt-3.5 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {photos.map((p) => (
              <figure key={p.id} className="relative m-0 overflow-hidden rounded-lg">
                {/* Transient peer-to-peer data URLs — never a stored object,
                    so next/image has nothing to optimise. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.dataUrl}
                  alt={
                    p.tags.length
                      ? `Photo of ${p.tags.map((t) => SEAT[t]).join(' and ')}`
                      : 'A photo from the live demo'
                  }
                  className="aspect-square w-full object-cover transition-[filter] duration-200"
                  style={{ filter: styleCss }}
                />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-1 pt-4 font-mono text-[0.55rem] text-[var(--m-paper)]">
                  {p.tags.length ? p.tags.map((t) => SEAT[t]).join(' · ') : untaggedReason(p.diag)}
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-2.5 text-xs text-[var(--m-slate-2)]">
            {remaining !== null && remaining > 0
              ? `${remaining} demo shot${remaining === 1 ? '' : 's'} left — the demo caps this, not Papic.`
              : 'That is the demo roll. A real celebration puts no limit on how many phones shoot.'}
          </p>
        </>
      ) : (
        <p className="mt-3.5 text-xs text-[var(--m-slate-2)]">
          {presence.a.joined && presence.b.joined
            ? 'You are both in. Shots from your phones appear here, live.'
            : 'These codes are new every time this page loads, and they expire in twenty minutes.'}
        </p>
      )}

      <p className="mt-4 text-sm text-[var(--m-slate-2)]">
        <b className="font-semibold text-[var(--m-ink)]">Nothing here is kept.</b> The photos exist
        only while this page is open, and your face is read on your own phone — the screen that
        asks for it is the same screen that deletes it.
      </p>
    </div>
  );
}

function Code({
  label,
  svg,
  joined,
  registered,
}: {
  label: string;
  svg: string | null;
  joined: boolean;
  registered: boolean;
}) {
  // ⚠ A JOINED CODE IS NEVER DIMMED OR COVERED. The owner's rule for this page
  // is that the codes are ready to scan; the state is reported underneath so
  // the code itself stays at full contrast for the next phone.
  return (
    <div className="text-center">
      <div
        className={`aspect-square rounded-xl border bg-[var(--m-paper)] p-2 transition-colors ${
          joined ? 'border-[var(--m-mulberry)]' : 'border-[var(--m-line)]'
        }`}
      >
        {svg ? (
          <div
            className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
            // Inline SVG rendered SERVER-side by the same QR renderer and
            // palette every other Setnayan QR uses — no client QR library.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="h-full w-full animate-pulse rounded-lg bg-[rgb(44_42_41/0.06)]" />
        )}
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--m-ink)]">{label}</div>
      <div
        className={`mt-0.5 font-mono text-[0.58rem] uppercase tracking-[0.06em] ${
          joined ? 'text-[var(--m-mulberry)]' : 'text-[var(--m-slate-2)]'
        }`}
      >
        {registered ? 'Face added' : joined ? 'Joined' : svg ? 'Ready to scan' : 'Making a code'}
      </div>
    </div>
  );
}
