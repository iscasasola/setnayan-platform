'use client';

/**
 * 👗 SHARE A GOWN DESIGN — Customers › QR codes › Gown design (owner, 26 Nov 2026: *"sharing the design will generate a
 * QR code to place them inside the type of event where the gown is going to be used. this is same as the import QR, as
 * to either just add them to short list, or they are booked already."*).
 *
 *   1. Choose the `.gown.json` file the Gown Maker saved (Share → Save .gown.json). It is read HERE, in the browser,
 *      and checked with the same `parseGownExport` the server re-runs — the preview is what the client will see.
 *   2. Event — the event type the gown is for (the creatable roster, as on the Booked QR).
 *   3. Shortlist · free (reusable, like the Shortlist QR) or Booked · one-use (the Booked QR form opens next, with this
 *      design attached — the same deal, the same refusals, the same bookings-closed check).
 *
 * The form posts to `issueLockedQr` (a mode of it — the action budget is full): it stores the design, then shows the
 * Shortlist code, or opens the Booked QR form.
 */
import { useState } from 'react';
import { FileUp, QrCode } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { actionButtonClass } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { PillSelector } from '@/app/_components/pill-selector';
import { formatCentavosPhp } from '@/lib/php';
import { GOWN_FILE_MAX_CHARS, gownWhichWords, parseGownExport, type GownDesignInput, type GownShareAs } from '@/lib/gown-maker';
import { issueLockedQr } from '../actions';

type Opt = { value: string; label: string };

export function GownShareForm({ eventTypes }: { eventTypes: Opt[] }) {
  const [text, setText] = useState('');
  const [design, setDesign] = useState<GownDesignInput | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [eventType, setEventType] = useState('');
  const [shareAs, setShareAs] = useState<GownShareAs>('shortlist');

  const onFile = async (file: File | undefined) => {
    setDesign(null);
    setText('');
    setProblem(null);
    if (!file) return;
    if (file.size > GOWN_FILE_MAX_CHARS * 2) {
      setProblem('That file is too big for a Gown Maker design. Export it again from the Gown Maker.');
      return;
    }
    let raw = '';
    try {
      raw = await file.text();
    } catch {
      setProblem('That file couldn’t be read. Choose it again.');
      return;
    }
    const parsed = parseGownExport(raw);
    if (!parsed.ok) {
      setProblem(parsed.problem);
      return;
    }
    setText(raw);
    setDesign(parsed.design);
  };

  return (
    <form action={issueLockedQr} className="mt-3 space-y-4" data-gown-share-form="">
      <input type="hidden" name="gown_share" value="1" />
      <input type="hidden" name="gown_json" value={text} />
      <input type="hidden" name="event_type" value={eventType} />
      <input type="hidden" name="gown_share_as" value={shareAs} />

      <div className="space-y-1.5">
        <p className="block text-sm font-medium text-ink">Design</p>
        <label className={`${actionButtonClass('neutral')} w-full cursor-pointer`} data-gown-file="">
          <FileUp aria-hidden strokeWidth={1.9} />
          <span>{design ? 'Choose another .gown.json' : 'Choose the .gown.json file'}</span>
          <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
        <p className="text-sn-md text-[color:var(--m-slate-2)]">In the Gown Maker: Share → Save .gown.json.</p>
        {problem ? (
          <p role="alert" className="text-sn-md text-[rgb(var(--color-danger))]" data-gown-file-problem="">
            {problem}
          </p>
        ) : null}
      </div>

      {design ? (
        <div className="sn-frame flex gap-3 p-3" data-gown-preview="">
          {/* eslint-disable-next-line @next/next/no-img-element -- the tool's own small PNG still (a data URL) */}
          <img src={design.thumbDataUrl} alt="The gown design" width={72} height={96} className="h-24 w-[72px] flex-none rounded-lg object-cover" />
          <div className="min-w-0 text-sn-md">
            <b className="block text-sn-lg font-semibold text-ink">Gown design · {gownWhichWords(design.which)}</b>
            <ul className="mt-1 space-y-0.5 text-[color:var(--m-slate-2)]">
              {design.summary.slice(0, 4).map((l, i) => (
                <li key={i} className="truncate">
                  {l}
                </li>
              ))}
            </ul>
            <p className="mt-1 font-semibold text-ink">
              {design.priceShownCentavos != null ? `Price shown: ${formatCentavosPhp(design.priceShownCentavos)}` : 'No price shown — you quote it in the chat'}
            </p>
            <p className="text-sn-sm text-[color:var(--m-slate-2)]">This is what your client sees. Your costs stay in the Gown Maker.</p>
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <p className="block text-sm font-medium text-ink">Event</p>
        <PickMenu
          label="Event"
          value={eventType}
          options={[{ key: '', label: 'Any event type' }, ...eventTypes.map((t) => ({ key: t.value, label: t.label }))]}
          onPick={setEventType}
          dataAttr="data-gown-event-type"
          className="w-full"
        />
        <p className="text-sn-md text-[color:var(--m-slate-2)]">The event the gown is for. Your client adds you to an event of this type.</p>
      </div>

      <div className="space-y-1.5">
        <p className="block text-sm font-medium text-ink">When they scan</p>
        <PillSelector<GownShareAs>
          label="When they scan"
          value={shareAs}
          options={[
            { key: 'shortlist', label: 'Shortlist' },
            { key: 'booked', label: 'Booked' },
          ]}
          onPick={setShareAs}
          data="gown-share-as"
        />
        <p className="text-sn-md text-[color:var(--m-slate-2)]">
          {shareAs === 'shortlist'
            ? 'Free. They add your shop to that event’s shortlist. The code works for anyone you give it to.'
            : 'One use. Next you fill in the Booked QR — date, total, first payment and proof. A scan books you.'}
        </p>
      </div>

      <SubmitButton pendingLabel="Saving the design…" disabled={!design} className={`${actionButtonClass('brand', { main: true })} w-full`}>
        <QrCode aria-hidden strokeWidth={1.9} />
        <span>{shareAs === 'shortlist' ? 'Make the Shortlist code' : 'Next: the Booked QR'}</span>
      </SubmitButton>
    </form>
  );
}
