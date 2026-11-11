'use client';

/**
 * 📎 PHOTOS & FILES (supplier) · FILE (host) — one step at a time (Supplier Build 3 · lane C; prototype v8.3 `STEPS.album`).
 *
 * ① From where? — Portfolio (your portfolio, service cards, gallery) · From your phone (a photo, a video or a PDF) → ②
 * the pick. From your phone opens the SHIPPED chat attach (`openPlusDoor({ attach: true })` — the composer's own file
 * input, its upload, its message), so a file sent from the card is the same message a paperclip sends today. Since
 * 11 Nov this card is the supplier's ONE phone picker on the (+) (the separate "Photo" row was its dupe), so the picker
 * takes photos AND videos — `CHAT_ATTACHMENT_ACCEPT` — never a narrower list.
 *
 * ⚠ NOT BUILT HERE (reported, not invented): the Portfolio album — one card of picked shop photos with a per-photo
 * heart that saves to the event's Inspiration (unheart removes). It needs an album record and an Inspiration pointer
 * per photo; the shipped hearts (`lib/chat-hearts.ts`) are per MESSAGE. The source is drawn, shut, with that reason.
 */
import { useId, useState } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { openPlusDoor } from '@/app/vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet';
import { ChatStepCard, type ChatCardStep } from '../chat-step-card';

export function FilesStepCard({ side, onClose, seed }: { side: 'vendor' | 'couple'; onClose?: () => void; seed?: { src?: 'shop' | 'phone'; step?: number } }) {
  const formId = useId();
  const [step, setStep] = useState(seed?.step ?? (side === 'couple' ? 1 : 0));
  const [src, setSrc] = useState<'shop' | 'phone' | null>(side === 'couple' ? 'phone' : seed?.src ?? null);
  const title = 'Photos & files';
  const steps: ChatCardStep[] = [
    {
      title: 'From where?',
      body: (
        <PickMenu
          label="From where?"
          value={src}
          options={[
            { key: 'shop', label: 'Portfolio · your photos and service cards' },
            { key: 'phone', label: 'From your phone · a photo, a video or a PDF' },
          ]}
          onPick={(k) => setSrc(k as 'shop' | 'phone')}
          buttonText={src ? undefined : 'Portfolio · From your phone'}
          dataAttr="data-files-src"
        />
      ),
      ok: !!src,
    },
    src === 'shop'
      ? {
          title: 'Pick from your portfolio',
          body: (
            <p className="text-[15px] text-ink/70" data-files-shut="portfolio">
              Sending portfolio photos as one album comes with the album build. For now, send a photo, a video or a PDF from your phone.
            </p>
          ),
          ok: false,
        }
      : {
          title: 'From your phone',
          sub: 'A photo (PNG, JPEG, WebP), a video or a PDF.',
          body: <p className="text-[15px] text-ink/70">Send opens your files; the one you choose goes into the chat.</p>,
          ok: true,
        },
  ];
  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        onClose?.();
        window.setTimeout(() => openPlusDoor({ attach: true }), 0);
      }}
    >
      <ChatStepCard topic="files" kicker="You · not sent yet" title={title} steps={side === 'couple' ? steps.slice(1) : steps} step={side === 'couple' ? 0 : step} onStep={setStep} sendLabel="Choose a file" onClose={onClose} submitForm={formId} />
    </form>
  );
}
