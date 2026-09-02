'use client';

/**
 * The room, on the page that sells the room.
 *
 * ─── WHY IT EXISTS ────────────────────────────────────────────────────────
 * `/pa3d` had a "Walk around a sample reception" button that opened the demo
 * in an OVERLAY — the same shape Papic and Live Studio use. That is right for
 * Papic, whose premise is a photograph and whose interactive moment (two QR
 * codes) is genuinely a separate act. It is wrong here: **3D Plan's entire
 * premise IS the interaction.** A page that argues "you should see the room"
 * and then makes you press a button to see the room is arguing against itself.
 *
 * So this component puts the actual room ON the page, where Papic puts its
 * photograph. Same demo, same server action, same sample event — not a copy.
 * The overlay still exists and still works; this is the in-page door.
 *
 * ─── THE ONE REASON IT IS NOT AUTO-LOADED ─────────────────────────────────
 * three.js is ~193 KB over the wire and is `ssr:false`-dynamic, so it costs
 * NOTHING until this component mounts the scene. Auto-mounting would put that
 * on every visitor to a marketing page, including the ones who bounce at the
 * fold — on Philippine mobile data, for a page they may not have chosen yet.
 * So the room is one tap away, not zero: the poster is real product copy, the
 * tap is the consent, and the weight arrives only for someone who asked.
 * ⚠ If you ever make this eager, re-measure the page's transfer size first.
 */

import { useCallback, useState } from 'react';
import { Loader2, QrCode, RotateCcw } from 'lucide-react';
import { Plan3DSceneLoader } from '@/app/_components/plan3d/plan3d-scene-loader';
import { useIsMobile } from '@/lib/use-responsive';
import {
  loadPlan3DDemoScene,
  mintPlan3DGuestQr,
  type Plan3DScene,
  type Plan3DGuestQr,
} from '@/app/_actions/plan3d-demo-actions';

type Phase = 'poster' | 'loading' | 'ready' | 'failed';

export function Pa3dRoom() {
  const [phase, setPhase] = useState<Phase>('poster');
  const [scene, setScene] = useState<Plan3DScene | null>(null);
  /** Owner 2026-07-03: the couple's palette is the whole point — default ON. */
  const [themed, setThemed] = useState(true);
  const [roaming, setRoaming] = useState(false);
  const [returnSignal, setReturnSignal] = useState(0);
  const [qr, setQr] = useState<Plan3DGuestQr | null>(null);
  const [qrPending, setQrPending] = useState(false);
  const isMobile = useIsMobile();

  const enter = useCallback(() => {
    if (phase !== 'poster') return;
    setPhase('loading');
    loadPlan3DDemoScene()
      .then((s) => {
        setScene(s);
        setPhase('ready');
      })
      .catch(() => setPhase('failed'));
  }, [phase]);

  const handleGuestClick = useCallback((guestId: string) => {
    setQrPending(true);
    mintPlan3DGuestQr(guestId, window.location.origin)
      .then((r) => setQr(r))
      .catch(() => setQr(null))
      .finally(() => setQrPending(false));
  }, []);

  // ── The poster. Not a screenshot: a plain statement of what one tap costs
  // and what it opens. Deliberately says the room is REAL data, because the
  // thing a visitor doubts about any 3D marketing claim is exactly that.
  if (phase !== 'ready') {
    const busy = phase === 'loading';
    return (
      <div className="overflow-hidden rounded-2xl border border-[var(--m-line)] bg-[var(--m-paper)]">
        <div className="relative flex aspect-[4/5] flex-col items-center justify-center gap-4 px-6 text-center sm:aspect-[16/10]">
          {/* A hint of the room behind the invitation — floor, then the warm
              wash the mood board puts over it. Pure CSS: no image to ship.
              ⚠ TOKENS ONLY. `doorway-palette.test.ts` bans a raw colour literal
              anywhere under a doorway route, and it is right to: the last time
              a hex was hand-typed on these pages the struck-through column
              shipped at 3.06:1, below AA, because nothing was looking. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 90% at 50% 115%, var(--m-orange-4) 0%, var(--m-paper-2) 42%, var(--m-paper) 100%)',
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                'radial-gradient(60% 40% at 50% 8%, var(--m-orange-3) 0%, transparent 70%)',
            }}
          />
          {phase === 'failed' ? (
            <div className="relative">
              <p className="font-serif text-lg text-[var(--m-ink)]">The room didn’t load.</p>
              <button
                type="button"
                onClick={() => {
                  setPhase('poster');
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--m-line)] bg-[var(--m-paper)] px-4 py-2 text-sm font-medium text-[var(--m-ink)]"
              >
                <RotateCcw aria-hidden className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          ) : (
            <>
              <p className="relative font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--m-orange-2)]">
                A real reception, not a mock-up
              </p>
              <p className="relative max-w-sm font-serif text-xl leading-snug text-[var(--m-ink)] sm:text-2xl">
                Maria &amp; Jose’s room — their tables, their seats, their colours.
              </p>
              <button
                type="button"
                onClick={enter}
                disabled={busy}
                aria-label="Open the sample reception in 3D"
                className="relative inline-flex items-center gap-2 rounded-full bg-[var(--m-mulberry)] px-6 py-3 text-sm font-semibold text-[var(--m-paper)] transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                    Standing up the room…
                  </>
                ) : (
                  'Step inside'
                )}
              </button>
              <p className="relative text-xs text-[var(--m-slate-2)]">
                Loads on tap · no sign-up
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  const s = scene!;
  return (
    <div>
      <div
        className="relative overflow-hidden rounded-2xl border border-[var(--m-line)]"
        style={{ aspectRatio: isMobile ? '4 / 5' : '16 / 10', background: 'var(--m-paper-2)' }}
      >
        <Plan3DSceneLoader
          tables={s.tables}
          floor={s.floor}
          guests={s.guests}
          sceneObjects={s.sceneObjects}
          booths={s.booths}
          signs={s.signs}
          cocktail={s.cocktail}
          rolePalette={themed ? s.rolePalette : undefined}
          receptionDesign={themed ? s.receptionDesign : undefined}
          venueSetting={s.venueSetting}
          onGuestClick={handleGuestClick}
          interactive
          roam={roaming && s.guests[0] ? { guestId: s.guests[0].id } : null}
          returnToSeatSignal={returnSignal}
          quality={isMobile ? 'low' : 'high'}
          cinematic
        />
      </div>

      {/* The controls are the argument, so they are labelled as claims rather
          than as settings: each one is a thing the product can do. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setRoaming((v) => !v)}
          aria-pressed={roaming}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            roaming
              ? 'border-transparent bg-[var(--m-mulberry)] text-[var(--m-paper)]'
              : 'border-[var(--m-line)] bg-[var(--m-paper)] text-[var(--m-ink)]'
          }`}
        >
          {roaming ? 'Walking' : 'Walk around'}
        </button>
        {roaming ? (
          <button
            type="button"
            onClick={() => setReturnSignal((n) => n + 1)}
            className="rounded-full border border-[var(--m-line)] bg-[var(--m-paper)] px-4 py-2 text-sm font-medium text-[var(--m-ink)]"
          >
            Back to my seat
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setThemed((v) => !v)}
          aria-pressed={themed}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            themed
              ? 'border-transparent bg-[var(--m-mulberry)] text-[var(--m-paper)]'
              : 'border-[var(--m-line)] bg-[var(--m-paper)] text-[var(--m-ink)]'
          }`}
        >
          {themed ? 'Their colours: on' : 'Their colours: off'}
        </button>
      </div>

      <p className="mt-3 text-sm text-[var(--m-slate-2)]">
        {roaming
          ? 'Tap the floor to walk there. Tap the dance floor to dance.'
          : 'Drag to look around. Tap any seated guest to open the room from their seat.'}
      </p>

      {/* The QR is the pitch's second half: the room is not just yours to look
          at, it is every guest's to find their seat in. */}
      {qrPending || qr ? (
        <div className="mt-4 flex items-center gap-4 rounded-2xl border border-dashed border-[var(--m-line)] p-4">
          {qrPending ? (
            <>
              <Loader2 aria-hidden className="h-4 w-4 animate-spin text-[var(--m-slate-2)]" />
              <p className="text-sm text-[var(--m-slate-2)]">Making their code…</p>
            </>
          ) : qr ? (
            <>
              {/* Same inline-SVG render the homepage overlay uses — one QR
                  implementation, not a second one that could drift. */}
              <div
                aria-label={`QR code that opens the room as ${qr.guestName}`}
                role="img"
                className="h-24 w-24 shrink-0 rounded-lg border border-[var(--m-line)] bg-[var(--m-paper)] p-1.5 [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: qr.qrSvg }}
              />
              <div>
                <p className="font-serif text-lg text-[var(--m-ink)]">{qr.guestName}</p>
                <p className="mt-1 text-sm text-[var(--m-slate-2)]">
                  Point your phone at this and the room opens from their seat — one button,
                  “Where am I seated?”. This is exactly what a guest gets.
                </p>
                <a
                  href={qr.joinUrl}
                  className="mt-1 inline-block text-sm font-medium text-[var(--m-mulberry)] hover:opacity-80"
                >
                  Or open it here
                </a>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
