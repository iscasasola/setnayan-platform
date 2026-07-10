'use client';

/**
 * The desktop half of the 3D Plan homepage live demo (owner spec,
 * DECISION_LOG 2026-07-03). Unlike Papic/Panood's two-phone pairing, this is
 * single-phone and per-guest: the pop-up renders the sample Maria & Jose
 * room in 3D; clicking any seated guest figure mints a FRESH QR bound to
 * THAT person (owner: "clicking a seated GUEST figure pops a QR bound to
 * THAT person"). Scanning it opens `/3d_plan/demo/[token]` on the phone AS
 * that guest, one big button: "Where am I seated?"
 *
 * Fictional sample guests → zero privacy surface: no camera, no faces, no
 * consent screen — the lightest of the three demos.
 */

import { useEffect, useState } from 'react';
import { ArrowUpRight, Loader2, QrCode } from 'lucide-react';
import { OverlayShell, type OverlayId } from './HomeOverlays';
import { useIsMobile } from '@/lib/use-responsive';
import { Plan3DSceneLoader } from '@/app/_components/plan3d/plan3d-scene-loader';
import {
  loadPlan3DDemoScene,
  mintPlan3DGuestQr,
  type Plan3DScene,
  type Plan3DGuestQr,
} from '@/app/_actions/plan3d-demo-actions';

export function Plan3DDemoOverlay({ current, onClose }: { current: OverlayId; onClose: () => void }) {
  const [scene, setScene] = useState<Plan3DScene | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [qr, setQr] = useState<Plan3DGuestQr | null>(null);
  const [qrPending, setQrPending] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);
  // Owner 2026-07-03: "apply mood board toggle so the place is themed." Default
  // ON — the couple's palette is the whole point; off shows the neutral shell.
  const [themed, setThemed] = useState(true);
  // "Walk around" — opt-in roam, mirroring the phone guest-view. OFF (default) =
  // the whole-room orbit + click-a-guest-QR pitch. ON = a chase cam follows a
  // guest; tap the floor to walk, tap the DANCE FLOOR to dance. Lets a desktop
  // visitor try tap-to-dance without scanning the QR to their phone first.
  const [roaming, setRoaming] = useState(false);
  // The homepage CTA has no device gate, so this overlay opens on phones too —
  // pass the scene's 'low' budget there (SYS-1 lg switch) or the cold-spark
  // tunnel (and shadow/env budget) renders its full desktop tier in a 360px
  // canvas on mid-range mobile GPUs.
  const isMobile = useIsMobile();
  // `room_dressing` is a non-array value on RolePalette (taxonomy v2), so gate on
  // array palettes only — a mood board "has color" when any color key is filled.
  const hasMood = scene
    ? Object.values(scene.rolePalette).some((a) => Array.isArray(a) && a.length > 0)
    : false;

  useEffect(() => {
    if (current !== 'plan3d-demo') return;
    let cancelled = false;
    setPending(true);
    setFailed(false);
    setQr(null);
    loadPlan3DDemoScene()
      .then((s) => {
        if (!cancelled) setScene(s);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [current]);

  function handleGuestClick(guestId: string) {
    setQrPending(true);
    setQr(null);
    setQrFailed(false);
    mintPlan3DGuestQr(guestId, window.location.origin)
      .then((res) => {
        if (res) setQr(res);
        else setQrFailed(true);
      })
      .catch(() => setQrFailed(true))
      .finally(() => setQrPending(false));
  }

  return (
    <OverlayShell id="plan3d-demo" current={current} onClose={onClose} label="3D Plan live demo" cardStyle={{ maxWidth: 640 }}>
      <div className="hr-ov-eyebrow">3D Plan · live demo</div>
      <h2 className="hr-ov-title">Click a guest. See their seat, in their pocket.</h2>
      <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55, color: '#6c675e' }}>
        This is Maria &amp; Jose&rsquo;s sample room. Tap anyone seated and we&rsquo;ll hand you a QR that opens
        the room, in 3D, from that guest&rsquo;s phone. Walk straight to their seat, or wander the whole
        room.
      </p>

      {failed ? (
        <p style={{ marginTop: 24, fontSize: 13, color: '#8c8884' }}>
          Couldn&rsquo;t load the room right now. Close this and try again in a moment.
        </p>
      ) : pending || !scene ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, color: '#8c8884', fontSize: 13 }}>
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
          Building the room…
        </div>
      ) : (
        <div style={{ marginTop: 18, display: 'grid', gap: 14 }}>
          {hasMood ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 12.5, color: '#6c675e' }}>
                {themed ? 'Themed to Maria & Jose’s mood board' : 'Neutral room'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={themed}
                aria-label="Apply mood board"
                onClick={() => setThemed((v) => !v)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  border: '1px solid rgba(42,43,46,.2)',
                  borderRadius: 'var(--m-r-full)',
                  padding: '5px 6px 5px 12px',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 12.5,
                  color: '#2a2925',
                }}
              >
                Apply mood board
                <span
                  aria-hidden
                  style={{
                    width: 34,
                    height: 20,
                    borderRadius: 'var(--m-r-full)',
                    background: themed ? '#8C6932' : 'rgba(42,43,46,.22)',
                    position: 'relative',
                    transition: 'background .2s',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: themed ? 16 : 2,
                      width: 16,
                      height: 16,
                      borderRadius: 'var(--m-r-full)',
                      background: '#fff',
                      transition: 'left .2s',
                    }}
                  />
                </span>
              </button>
            </div>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              role="switch"
              aria-checked={roaming}
              aria-label="Walk around"
              onClick={() => setRoaming((v) => !v)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                border: '1px solid rgba(42,43,46,.2)',
                borderRadius: 'var(--m-r-full)',
                padding: '6px 14px',
                background: roaming ? '#2a2925' : 'transparent',
                color: roaming ? '#fff' : '#2a2925',
                cursor: 'pointer',
                fontSize: 12.5,
                fontWeight: 500,
              }}
            >
              {roaming ? '● Walking the room' : 'Walk around'}
            </button>
            {roaming ? (
              <span style={{ fontSize: 12, color: '#6c675e' }}>
                Tap the floor to walk · tap the dance floor to dance
              </span>
            ) : null}
          </div>
          <div
            style={{
              width: '100%',
              height: 360,
              borderRadius: 'var(--m-r-16, 16px)',
              overflow: 'hidden',
              border: '1px solid rgba(42,43,46,.12)',
              background: '#e7e1d8',
            }}
          >
            <Plan3DSceneLoader
              tables={scene.tables}
              floor={scene.floor}
              guests={scene.guests}
              sceneObjects={scene.sceneObjects}
              booths={scene.booths}
              signs={scene.signs}
              cocktail={scene.cocktail}
              rolePalette={themed ? scene.rolePalette : undefined}
              receptionDesign={themed ? scene.receptionDesign : undefined}
              venueSetting={scene.venueSetting}
              onGuestClick={handleGuestClick}
              interactive
              // Opt-in "Walk around": roam a guest (chase cam) so a floor tap
              // walks them and a dance-floor tap makes them dance. Guest-click
              // (find-my-seat QR) still works inside roam. Off → whole-room orbit.
              roam={roaming && scene.guests[0] ? { guestId: scene.guests[0].id } : null}
              quality={isMobile ? 'low' : 'high'}
              // Golden-hour grade + string lights (Tier A — dep-free, no
              // postprocessing). Phone-safe: rides the same quality knob (halved
              // strands on mobile 'low'), and the heavy bloom/DoF pass lives only
              // in the lab, never in this homepage chunk.
              cinematic
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              minHeight: 56,
              borderRadius: 'var(--m-r-16, 16px)',
              border: '1px dashed rgba(42,43,46,.2)',
              padding: '10px 16px',
              textAlign: 'center',
            }}
          >
            {qrPending ? (
              <>
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
                <span style={{ fontSize: 13, color: '#8c8884' }}>Minting a fresh QR…</span>
              </>
            ) : qr ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  className="hr-qr-fit"
                  style={{
                    width: 128,
                    height: 128,
                    flexShrink: 0,
                    borderRadius: 'var(--m-r-12, 12px)',
                    border: '1px solid rgba(42,43,46,.12)',
                    overflow: 'hidden',
                  }}
                  dangerouslySetInnerHTML={{ __html: qr.qrSvg }}
                />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#2a2925' }}>
                    Scan as {qr.guestName}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#a8a4a0', marginTop: 2 }}>
                    Fresh code. Expires in 20 minutes.
                  </div>
                  {/* No phone handy? Open the exact same guest view right here —
                      the QR just encodes this URL, so a desktop visitor is no
                      longer stuck at a scan-only dead-end. */}
                  <a
                    href={qr.joinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      marginTop: 9,
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: '#8a5a3c',
                      textDecoration: 'underline',
                      textUnderlineOffset: 3,
                    }}
                  >
                    No phone? Open the demo here
                    <ArrowUpRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  </a>
                </div>
              </div>
            ) : qrFailed ? (
              <span style={{ fontSize: 13, color: '#8c8884' }}>
                Couldn&rsquo;t mint that QR. Click the guest again.
              </span>
            ) : (
              <>
                <QrCode aria-hidden className="h-4 w-4" strokeWidth={1.75} style={{ color: '#a8a4a0' }} />
                <span style={{ fontSize: 13, color: '#a8a4a0' }}>
                  Click any seated guest above to get their QR.
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </OverlayShell>
  );
}
