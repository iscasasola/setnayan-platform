'use client';

/**
 * "Add received screenshots" — the admin drops many pictures of money that
 * ARRIVED in our BDO app at once (owner 2026-11-17, specs
 * prototypes/admin_payment_verify_2026-11-17/).
 *
 * 🔒 THE PICTURES NEVER LEAVE THIS PHONE (owner 2026-11-17, "Yes, swap it in").
 * Each one is read here by Tesseract (open source, runs in the browser), and
 * only the TEXT is sent to the server, where plain code keeps the reference,
 * amount and time. The reader's own files (worker, wasm, English data) come
 * from cdn.jsdelivr.net, already allowed in next.config.ts for MediaPipe, and
 * are cached after the first use. Versions are pinned so a CDN update can
 * never change what we run.
 *
 * A picture the reader cannot read is sent as empty text, which the server
 * keeps as an "unreadable" row: counted on the desk, never silently dropped.
 */
import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { approvePayment } from '../actions';
import { formatCount } from '@/lib/format-number';
import { Sheet } from '@/app/_components/sheet';
import { FormRows, TypedRow } from '@/app/_components/form-row';

const PER_DROP = 25; // = RECEIVED_PER_DROP in ../received.ts
const READER_PATHS = {
  workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js',
  corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0',
  langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int',
};

async function readOnThisPhone(
  files: File[],
  onProgress: (done: number) => void,
): Promise<string[]> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, READER_PATHS);
  const texts: string[] = [];
  try {
    for (const file of files) {
      onProgress(texts.length + 1);
      try {
        const { data } = await worker.recognize(file);
        texts.push(data.text ?? '');
      } catch {
        texts.push(''); // → an "unreadable" row, so it is counted
      }
    }
  } finally {
    await worker.terminate();
  }
  return texts;
}

export function ReceivedDropTile() {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The v5 drawing: the gallery opens, then a sheet says "6 picked." with
  // Read 6 · Cancel · Paste a text instead.
  const [picked, setPicked] = useState<File[] | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');

  async function save(texts: string[]) {
    setBusy('Saving…');
    for (let i = 0; i < texts.length; i += PER_DROP) {
      const fd = new FormData();
      fd.set('intent', 'received-drop');
      for (const t of texts.slice(i, i + PER_DROP)) fd.append('texts', t);
      // The action revalidates the page, so its answer carries the new pile.
      await approvePayment(fd);
    }
  }

  async function readPicked(pictures: File[]) {
    setError(null);
    const total = formatCount(pictures.length);
    try {
      setBusy('Getting the reader ready…');
      const texts = await readOnThisPhone(pictures, (n) => setBusy(`Reading ${formatCount(n)} of ${total}…`));
      await save(texts);
    } catch {
      setError('The pictures could not be read on this phone. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  async function savePasted() {
    const text = pasted.trim();
    if (!text) return;
    setError(null);
    try {
      await save([text]);
      setPasted('');
    } catch {
      setError('That text could not be saved. Try again.');
    } finally {
      setBusy(null);
    }
  }

  function close() {
    setPicked(null);
    setPasting(false);
    if (input.current) input.current.value = '';
  }

  const count = picked?.length ?? 0;
  return (
    <div data-payments-received-drop="">
      <button
        type="button"
        className="ab ab-main flex min-h-14 w-full items-center gap-3 text-left"
        disabled={busy !== null}
        aria-busy={busy !== null}
        onClick={() => input.current?.click()}
      >
        <ImagePlus aria-hidden className="h-5 w-5 flex-none" strokeWidth={2} />
        <span className="min-w-0">
          <span className="block font-semibold">{busy ?? 'Add received screenshots'}</span>
          <span className="block text-[13px] opacity-80">From your BDO app · many at once</span>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? []).filter((f) => f.type.startsWith('image/'));
          if (files.length > 0) setPicked(files);
        }}
      />
      <Sheet open={picked !== null} onClose={close} labelledById="received-picked-title" title="Add received screenshots">
        <div className="flex flex-col gap-3 p-4">
          <h2 id="received-picked-title" className="text-[16px] font-semibold text-ink">
            {pasting ? 'Paste a text instead' : count === 1 ? '1 picked.' : `${formatCount(count)} picked.`}
          </h2>
          {pasting ? (
            <FormRows width="wide">
              <TypedRow
                name="The alert from your BDO app"
                value={pasted}
                empty="Paste it here"
                placeholder="Paste the alert from your BDO app"
                long
                boxed
                maxLength={4000} // = MAX_TEXT in ../received.ts
                onType={setPasted}
                onKeep={(t) => setPasted(t)}
                data="received-paste"
              />
            </FormRows>
          ) : (
            <p className="text-[14px] text-[color:var(--sn-ink-500)]">Read on this phone. Nothing is uploaded.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="ab ab-ok min-h-11"
              disabled={pasting ? pasted.trim() === '' : count === 0}
              onClick={() => {
                const files = picked ?? [];
                const paste = pasting;
                close();
                void (paste ? savePasted() : readPicked(files));
              }}
            >
              {pasting ? 'Read it' : `Read ${formatCount(count)}`}
            </button>
            <button type="button" className="ab min-h-11" onClick={close}>
              Cancel
            </button>
            {!pasting ? (
              <button type="button" className="ab min-h-11" onClick={() => setPasting(true)}>
                Paste a text instead
              </button>
            ) : null}
          </div>
        </div>
      </Sheet>
      {error ? (
        <p role="alert" className="mt-2 text-[14px]" style={{ color: 'rgb(var(--color-warn))' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
