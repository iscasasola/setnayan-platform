'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CAMERA_LOOKS, CAMERA_LOOK_LABEL, CAMERA_LOOK_PREF_KEY, type CameraLook } from '@/lib/camera-look';
import { makerSave } from '@/lib/maker-refresh';
import { hubDraftAction } from '../../../website/hub-draft-actions';
import type { ElementDraftAction } from '../../../website/editor/_components/element-sheet';
import { useMaker } from '../maker-context';
import { MAKER_PART_OPS_EVENT, type MakerPartRaw } from '../maker-part-ops';
import { CameraLookFace, setPickedLook, useCameraLookShown, useCanvasBrand } from './camera-face';
import { StageStyle } from './stage-style';
import { StyleCards } from './style-carousel';

/**
 * 🎛 THE CAMERA PART'S STYLE — Classic · Your brand · Challenges (owner
 * 2026-10-06, DECISION_LOG "THE CAMERA HAS ITS OWN THREE LAYOUTS"; 2026-10-07 "THREE
 * FOLLOW-UPS AS ONE STEP": *"the Camera part's three looks … saved through the hub
 * draft"*; 2026-10-09, on the toolbar: *"Camera is a full screen design"* · *"edit is
 * greyed out too. only have style"* — `TOOLBAR-SPEC-2026-10-09.md` "The Day › Camera").
 *
 * The pick is `events.style_preferences.camera_look` (`lib/camera-look.ts`), which the
 * guest camera already reads (`app/papic/guest/page.tsx`). Here it goes into the DRAFT
 * (`hubDraftAction` intent=save, `{ events: { style_preferences: { camera_look } } }` —
 * the draft keeps it beside a drafted QR look, never over it, `lib/hub-draft.ts`),
 * is counted on ✓ and written by Apply. Free — a style pick.
 *
 * 🃏 THE CARDS ARE THE TOOLBAR'S STYLE CARDS (`StyleCards`, the approved prototype's `.lc`): the phone-shaped
 * frame as tall as the four rows, the picked one in the middle, its name in the card's foot. Only what fills the
 * picture is the Camera's own (`picture`) — the three looks THAT EXIST (`CAMERA_LOOKS`); the prototype's Minimal
 * and Film are a proposal the app does not have, and are not drawn.
 *
 * 🖼 EACH CARD IS THE CAMERA'S OWN PIECES (`camera-face.tsx` `CameraLookFace`) — and the SAME face, at the screen's
 * size, is the Camera's page in the Maker (`camera-page.tsx`: the sample IS the camera). The look on screen is one
 * value for both (`useCameraLookShown`): a pick shows on the card and on the page at once.
 */

/**
 * THE ONE DRAFT DOOR, AS THE WORK AREA LENDS IT (`maker-part-ops.ts` — the door every other write of the toolbar goes
 * through): on a real event it IS `hubDraftAction` (`website/editor/page.tsx`), so what a pick posts is unchanged; on
 * the Maker lab it is the lab's stand-in, so a pick can be tried there too (it could not: the Camera's own import of
 * the server action answered 401 on the lab — seen 2026-10-10). No work area to ask: the action itself.
 */
function draftDoor(): ElementDraftAction {
  let got: MakerPartRaw | null = null;
  window.dispatchEvent(new CustomEvent(MAKER_PART_OPS_EVENT, { detail: (raw: MakerPartRaw) => (got = raw) }));
  return (got as MakerPartRaw | null)?.elementEditing?.draftAction ?? hubDraftAction;
}

const CAMERA_LOOK_OPTIONS = CAMERA_LOOKS.map((look) => ({ id: look as string, name: CAMERA_LOOK_LABEL[look] }));

export function CameraPartTools() {
  const maker = useMaker();
  const router = useRouter();
  const saved = maker?.lookPages?.camera?.look ?? 'classic';
  const eventId = maker?.eventId ?? null;
  const shown = useCameraLookShown();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  /* The render that follows a save says the same as the pick — the pick steps back for it. */
  useEffect(() => setPickedLook(null), [saved]);
  const brand = useCanvasBrand();

  const pick = (look: CameraLook) => {
    if (!eventId || pending || look === shown) return;
    setPickedLook(look);
    setError(null);
    start(async () => {
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ events: { style_preferences: { [CAMERA_LOOK_PREF_KEY]: look } } }));
        const door = draftDoor();
        const r = await makerSave(() => door(eventId, fd), () => router.refresh());
        if (!r.ok) {
          setPickedLook(null);
          setError(r.error);
        }
      } catch {
        setPickedLook(null);
        setError('That change could not be saved. Please try again — nothing was lost.');
      }
    });
  };

  return (
    <div className="-mx-[10px] flex min-h-0 flex-1 flex-col" data-camera-part-tools="">
      <StageStyle
        rows
        look={
          <>
            <StyleCards
              options={CAMERA_LOOK_OPTIONS}
              value={shown}
              onPick={(id) => pick(id as CameraLook)}
              pending={pending}
              canvasKey={null}
              sceneType=""
              label="Camera look"
              data="camera"
              picture={(id) => <CameraLookFace look={id as CameraLook} logo={brand.logo} accent={brand.accent} />}
            />
            {error ? (
              <p role="alert" className="shrink-0 py-1 text-[12.5px] font-semibold text-terracotta-700">
                {error}
              </p>
            ) : null}
          </>
        }
        background={null}
        arrange={null}
      />
    </div>
  );
}
