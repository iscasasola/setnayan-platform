'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { FileUpload } from '@/app/_components/file-upload';
import { sceneBackgroundPathPrefix } from '@/lib/scene-media-choices';
import { SCENE_TEMPLATES } from '@/lib/scene-templates';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import type { SlotPatch } from '@/lib/scene-writes';
import { slotCanvasNext, slotName, slotTakesClips } from '@/lib/scene-slot-pick';
import { canvasFingerprint, canvasWriteKey, draftedCanvasOr, forgetCanvasSent, noteDraftedCanvas, sendCanvasBase } from '@/lib/maker-draft-store';
import { HUB_DRAFT_BAR_FIELD, SUPERSEDED, makerLatestWrite, makerRedrawSave, requestMakerRefresh } from '@/lib/maker-refresh';
import type { HubDraftActionResult } from '@/lib/hub-draft';
import { makerProMark, makerProUsable, paidMarkLabel } from '@/lib/paid-mark';
import { PaidMark } from '@/app/_components/paid-mark';
import { SP_BG_STRIP, SP_BG_TILE, SP_BG_TILE_ADD, SP_BG_TILE_FACE, SP_BG_TILE_FADE, SP_BG_TILE_NAME, SP_BG_TILE_TONE, SP_LOOK_ROW_LABEL, SP_ROWS_ROW } from '@/lib/maker-stage-room';
import { MakerSheet } from '../stages-studio-parts';
import type { MakerPartOps } from '../maker-part-ops';

/**
 * 🖼 A SCENE OF THEIR OWN'S PICTURES, ON THE PHONE (owner 2026-10-18, on a "Your own section" made from template 20,
 * Photo strip: *"is this the one where you add scenes? we already have the templates, just make them work"*).
 *
 * #6616 made the scene's Heading and Words editable in Edit; its PICTURES could only be put in on a desktop (the scene's
 * Content › `SceneSlotsPanel`). Now, in the phone Maker:
 *
 *   · the canvas draws every slot the template has IN ITS PLACE (`renderScene` `makerSlots` — an empty one as the
 *     template's own box, "＋ Photo"), and a tap on one opens that slot here (the bridge names it, `data-scene-slot`);
 *   · Edit's row 3 is "Photos ◆": one tile per slot, in the template's order — the picture, or ＋;
 *   · a tile opens ONE sheet for that slot: Upload (the app's `FileUpload`, compressed in the browser, into this event's
 *     `scene-background` folder — the scene upload a background and an RSVP picture line already use), then the
 *     couple's own media (the SAME set the scene's Background › Upload row offers: their photos, every scene's upload,
 *     and — where the template takes moving pictures — their video and clips), and "Take it off" when one is in.
 *
 * 💾 THE WRITE: the slot rule the desktop uses (`applySceneSlot`), on the scene's canvas as the Maker has it
 * (`draftedCanvasOr`), sent WHOLE through the one draft door (`hubDraftAction` intent=save) — with the canvas this
 * screen last sent (`sendCanvasBase`, two hosts never overwrite). The bridge cannot draw a picture into a slot, so the
 * save is HELD and the page redraws itself in place once it lands (`makerRedrawSave`) — never a whole-Maker render.
 * A refused save puts the Maker's copy back and says why on the line under the tools.
 *
 * 💎 Putting a picture in a scene is Event Hub Pro (owner: media is Pro): tried free in the draft — the row wears ◆ —
 * and named at ✓ Apply ("Photo in the scene"). Apply holds a slot to the couple's own pictures and THIS event's scene
 * folder (`hub-draft-actions.ts`). The app-store shell shows a couple without Pro none of it (`makerProUsable`).
 */

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

type Choice = { ref: string; url: string | null; kind: 'photo' | 'snippet'; name: string };

function choicesOf(ops: MakerPartOps | null, clips: boolean, local: Readonly<Record<string, string>>): Choice[] {
  const m = ops?.sceneMedia;
  if (!m) return [];
  const out = new Map<string, Choice>();
  for (const ref of Object.keys(local)) out.set(ref, { ref, url: local[ref]!, kind: 'photo', name: 'Your photo' });
  for (const p of m.photoChoices) if (!out.has(p.ref)) out.set(p.ref, { ref: p.ref, url: p.url, kind: 'photo', name: 'Your photo' });
  for (const u of m.sceneUploads) {
    if (out.has(u.ref)) continue;
    if (u.kind === 'photo') out.set(u.ref, { ref: u.ref, url: u.url, kind: 'photo', name: 'Your photo' });
    else if (clips) out.set(u.ref, { ref: u.ref, url: u.posterUrl ?? null, kind: 'snippet', name: 'Your clip' });
  }
  if (clips && m.videoChoice && !out.has(m.videoChoice.ref)) {
    const still = m.videoChoice.poster ? (m.photoChoices.find((p) => p.ref === m.videoChoice!.poster)?.url ?? null) : null;
    out.set(m.videoChoice.ref, { ref: m.videoChoice.ref, url: still, kind: 'snippet', name: 'Your video' });
  }
  return [...out.values()];
}

const pictureFace = (url: string | null) => (url ? { backgroundImage: `url("${url.replace(/"/g, '%22')}")` } : {});

/**
 * Edit's row 3 on a template scene of their own that takes pictures: "Photos ◆" and one tile per slot. `open` asks for
 * one slot's sheet (a tap on that picture on the page) — each new `n` opens it once.
 */
export function ScenePhotoRow({
  ask,
  type,
  stamp,
  open = null,
  onRefused,
}: {
  /** The work area's canvases, media and draft door, now (`askPartOps` — handed in by the toolbar, so this lazy piece
   *  never loads the Stages panel's own module). */
  ask: () => MakerPartOps | null;
  /** The scene's widget type (`custom_N`). */
  type: string;
  /** The Maker's render stamp — the work area's canvases and media are asked for again after each render. */
  stamp?: number | string | null;
  open?: { slot: number; n: number } | null;
  /** A refused save, said on the line under the tools. */
  onRefused: (words: string) => void;
}) {
  const [ops, setOps] = useState<MakerPartOps | null>(null);
  useEffect(() => setOps(ask()), [ask, stamp]);
  /* What was uploaded HERE this visit, shown from the file itself until the save's refresh signs it. */
  const [local, setLocal] = useState<Record<string, string>>({});
  /* A write moved the Maker's copy: the row reads it again. */
  const [, setTick] = useState(0);
  const [sheet, setSheet] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const seen = useRef<number | null>(null);
  useEffect(() => {
    if (open && open.n !== seen.current) {
      seen.current = open.n;
      setSheet(open.slot);
    }
  }, [open]);

  const server = (ops?.canvases?.[type] ?? null) as HubSectionCanvas | null;
  const canvas = draftedCanvasOr(type, server);
  const template = canvas.template;
  const t = template ? SCENE_TEMPLATES[template] : null;
  const media = ops?.sceneMedia ?? null;
  if (!ops || !t || t.media === 0 || !media || !makerProUsable({ owns: media.ownsPro, storeShell: media.storeShell })) return null;
  /* 💎 The shipped Pro mark beside the row's name — ◆ while tried, the diamond once owned (`makerProMark`). */
  const mark = makerProMark({ owns: media.ownsPro, storeShell: media.storeShell });
  const clips = slotTakesClips(t.id);
  const choices = choicesOf(ops, clips, local);
  const urlOf = (ref: string | undefined) => (ref ? (choices.find((c) => c.ref === ref)?.url ?? local[ref] ?? null) : null);
  const slots = canvas.slots ?? [];

  const write = async (index: number, patch: SlotPatch): Promise<boolean> => {
    const o = ask();
    if (!o?.draftAction) {
      onRefused('That could not be saved just now. Please try again.');
      return false;
    }
    const srv = (o.canvases?.[type] ?? null) as HubSectionCanvas | null;
    const before = draftedCanvasOr(type, srv);
    const next = slotCanvasNext(before, index, patch);
    if (!next) return true;
    noteDraftedCanvas(type, next, srv);
    setTick((n) => n + 1);
    setBusy(true);
    let res: HubDraftActionResult | typeof SUPERSEDED;
    try {
      res = await makerRedrawSave(
        () =>
          makerLatestWrite(canvasWriteKey(type), () => {
            const fd = new FormData();
            fd.set('intent', 'save');
            fd.set('patch', JSON.stringify({ widgets: { [type]: { canvas: next } } }));
            /* 👥 …with the canvas this screen last sent: what another host changed on the scene meanwhile is kept. */
            sendCanvasBase(fd, type, srv, next);
            fd.set(HUB_DRAFT_BAR_FIELD, '1');
            return o.draftAction!(o.eventId, fd);
          }),
        requestMakerRefresh,
        { ok: (r) => r !== SUPERSEDED && r.ok === true },
      );
    } catch {
      res = { ok: false, intent: 'save', error: '' };
    } finally {
      setBusy(false);
    }
    if (res === SUPERSEDED || res.ok) return true;
    forgetCanvasSent(type);
    /* ↩ Refused, and nothing newer is on the Maker's copy: the copy goes back. */
    if (canvasFingerprint(draftedCanvasOr(type, srv)) === canvasFingerprint(next)) noteDraftedCanvas(type, before, srv);
    setTick((n) => n + 1);
    onRefused(res.error || 'That picture could not be saved. Please try again.');
    return false;
  };

  const label = t.clip ? 'Clip' : t.media > 1 ? 'Photos' : 'Photo';
  return (
    <>
      <div className={`${SP_ROWS_ROW} row-start-3`} data-stage-edit-row="photos" data-scene-photos={type} aria-busy={busy || undefined}>
        <span className={`${SP_LOOK_ROW_LABEL} inline-flex items-center gap-1`}>
          {label}
          {mark ? <PaidMark state={mark} label={paidMarkLabel(mark, 'Event Hub Pro')} size="xs" bare /> : null}
        </span>
        <div role="group" aria-label={`${label} of this scene`} className={SP_BG_STRIP}>
          {Array.from({ length: t.media }, (_, i) => {
            const slot = slots[i] ?? {};
            const name = slotName(t.id, i);
            const url = urlOf(slot.media);
            return (
              <button
                key={i}
                type="button"
                aria-haspopup="dialog"
                aria-label={slot.media ? `${name} — change it` : `${name} — add one`}
                data-scene-photo-tile={i}
                data-scene-photo-filled={slot.media ? '' : undefined}
                onClick={() => setSheet(i)}
                className={SP_BG_TILE}
              >
                {slot.media ? (
                  <span className={SP_BG_TILE_FACE} style={pictureFace(url)} data-tile-face="picture">
                    <span aria-hidden data-tile-fade="" className={SP_BG_TILE_FADE.white} />
                    <span className={`${SP_BG_TILE_NAME} ${SP_BG_TILE_TONE.white}`}>
                      {slot.kind === 'snippet' ? '▶ ' : ''}
                      {t.media > 1 ? String(i + 1) : name}
                    </span>
                  </span>
                ) : (
                  <span className={`${SP_BG_TILE_FACE} ${SP_BG_TILE_ADD}`}>＋ {t.media > 1 ? String(i + 1) : name}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {sheet !== null
        ? createPortal(
            <ScenePhotoSheet
              eventId={ops.eventId}
              name={slotName(t.id, sheet)}
              current={slots[sheet]?.media ?? null}
              choices={choices}
              clips={clips}
              onClose={() => setSheet(null)}
              onUploaded={(ref, url) => {
                if (url) setLocal((l) => ({ ...l, [ref]: url }));
                const at = sheet;
                setSheet(null);
                void write(at, { media: ref });
              }}
              onPick={(c) => {
                const at = sheet;
                setSheet(null);
                void write(at, c.kind === 'snippet' ? { media: c.ref, kind: 'snippet' } : { media: c.ref });
              }}
              onRemove={() => {
                const at = sheet;
                setSheet(null);
                void write(at, { media: '' });
              }}
            />,
            document.body,
          )
        : null}
    </>
  );
}

/** ONE slot's picture: Upload, the couple's own media, and Take it off — in the Maker's one bottom sheet. */
function ScenePhotoSheet({
  eventId,
  name,
  current,
  choices,
  clips,
  onClose,
  onUploaded,
  onPick,
  onRemove,
}: {
  eventId: string;
  name: string;
  current: string | null;
  choices: readonly Choice[];
  clips: boolean;
  onClose: () => void;
  onUploaded: (ref: string, localUrl: string | null) => void;
  onPick: (c: Choice) => void;
  onRemove: () => void;
}) {
  const picked = useRef<string | null>(null);
  /* ONE ref, ONE write: the uploader's change is consumed once (the RSVP picture sheet's belt). */
  const handed = useRef<string | null>(null);
  return (
    <MakerSheet label={name} onClose={onClose}>
      <div className="space-y-3 px-3 pb-3" data-scene-photo-sheet={name}>
        <FileUpload
          bucket="media"
          pathPrefix={sceneBackgroundPathPrefix(eventId)}
          multiple={false}
          maxSizeMB={25}
          acceptedTypes={IMAGE_TYPES}
          compressImage
          onFilePicked={(file) => {
            try {
              picked.current = URL.createObjectURL(file);
            } catch {
              /* a preview is a nicety */
            }
          }}
          onChange={(value) => {
            const ref = typeof value === 'string' ? value : null;
            if (!ref || handed.current === ref) return;
            handed.current = ref;
            onUploaded(ref, picked.current);
          }}
          label="Upload a photo"
        />
        {choices.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium text-[var(--sp-ink)]">{clips ? 'Your photos and videos' : 'Your photos'}</p>
            <div role="group" aria-label="Your media" className={`${SP_BG_STRIP} h-14`} data-scene-photo-choices="">
              {choices.map((c) => (
                <button
                  key={c.ref}
                  type="button"
                  aria-pressed={c.ref === current}
                  aria-label={c.ref === current ? `${c.name} — in this ${name.toLowerCase()} now` : `Use this ${c.kind === 'snippet' ? 'clip' : 'photo'}`}
                  data-scene-photo-choice={c.kind}
                  onClick={() => (c.ref === current ? onClose() : onPick(c))}
                  className={SP_BG_TILE}
                >
                  <span className={SP_BG_TILE_FACE} style={pictureFace(c.url)} data-tile-face="picture">
                    <span aria-hidden data-tile-fade="" className={SP_BG_TILE_FADE.white} />
                    <span className={`${SP_BG_TILE_NAME} ${SP_BG_TILE_TONE.white}`}>
                      {c.kind === 'snippet' ? '▶ ' : ''}
                      {c.name}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {current ? (
          <div data-scene-photo-remove="">
            <ActionButton tone="neutral" icon={Trash2} label="Take it off" onClick={onRemove} />
          </div>
        ) : null}
      </div>
    </MakerSheet>
  );
}
