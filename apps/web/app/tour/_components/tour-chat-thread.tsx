'use client';

/**
 * TourChatThread — a SCRIPTED, client-only chat for the public Maria & Jose tour.
 *
 * Read-only by construction: there is NO server. The bubble + typing-indicator
 * markup is copied VERBATIM from app/_components/chat-message-stream.tsx and the
 * textarea/Send markup from app/_components/chat-send-form.tsx, but the server
 * action (`sendChatMessage`) is swapped for a local onSubmit that:
 *   1. appends the visitor's message to local state,
 *   2. shows a ~1.2s "{vendor} is typing…" indicator,
 *   3. appends the next canned line from VENDOR_SCRIPT.
 *
 * It imports NO chat-actions / sendChatMessage and reads NO chat_messages row —
 * reloading the page resets the whole conversation. The only "real" data is the
 * counterparty label (a demo vendor's business_name), passed in as a prop by the
 * parent RSC.
 */

import { useRef, useState } from 'react';
import { Send } from 'lucide-react';

type ScriptMsg = { role: 'couple' | 'vendor'; body: string };

/**
 * The scripted reply chain. Each visitor message advances the cursor by one and
 * surfaces the next 'vendor' line. When the script runs out the vendor sends a
 * gentle closing line and stops. Wording mirrors a warm PH wedding-vendor DM —
 * no prices committed, no real identity beyond the (demo) business name.
 */
const VENDOR_SCRIPT: string[] = [
  "Hi! Thanks so much for reaching out about Maria & Jose's wedding — congratulations to the couple! 🤍 We'd love to be part of the day.",
  "Yes, December 12, 2026 is still open on our calendar. We pencil dates in lightly until there's a signed agreement, so it's a good idea to lock it in soon.",
  "Our coverage usually runs the full event day — prep, ceremony, and reception. I can send our package details and sample galleries so you can see if our style fits your moodboard.",
  "Perfect. I'll put together a quote based on your guest count and venue, and we can hop on a quick call this week to walk through everything. Talk soon! ✨",
];

const VISITOR_PROMPTS: string[] = [
  'Hi! Are you available for our wedding on December 12, 2026?',
  'That’s wonderful — what does your coverage include?',
  'Sounds great. Could you send over a quote?',
];

/** Local, dependency-free timestamp formatter (mirrors lib/chat formatChatTimestamp's
 *  same-day shape) — kept inline so this client component imports no chat module. */
function formatTs(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function TourChatThread({ counterpartyLabel }: { counterpartyLabel: string }) {
  const [messages, setMessages] = useState<Array<ScriptMsg & { id: number; at: Date }>>([
    { id: 0, role: 'vendor', body: VENDOR_SCRIPT[0]!, at: new Date() },
  ]);
  const [typing, setTyping] = useState(false);
  // How many vendor lines (and visitor prompts) we've already played.
  const [step, setStep] = useState(1);
  const idRef = useRef(1);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const exhausted = step >= VENDOR_SCRIPT.length;

  function send(body: string) {
    const trimmed = body.trim();
    if (trimmed.length === 0 || typing) return;

    const mine = { id: idRef.current++, role: 'couple' as const, body: trimmed, at: new Date() };
    setMessages((prev) => [...prev, mine]);
    if (textareaRef.current) textareaRef.current.value = '';

    // The vendor's scripted reply — next unplayed line, or a graceful close.
    const reply = VENDOR_SCRIPT[step] ?? null;
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      if (reply) {
        setMessages((prev) => [
          ...prev,
          { id: idRef.current++, role: 'vendor', body: reply, at: new Date() },
        ]);
        setStep((s) => s + 1);
      }
    }, 1200);
  }

  const suggestion = VISITOR_PROMPTS[step - 1] ?? null;

  return (
    <div className="flex h-full flex-col gap-3">
      {/* ── message list (markup copied verbatim from ChatMessageStream) ── */}
      <ol
        className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-ink/10 bg-cream p-4"
        aria-live="polite"
        aria-relevant="additions"
        style={{ minHeight: 280, maxHeight: 360 }}
      >
        {messages.map((m) => {
          const owns = m.role === 'couple';
          return (
            <li key={m.id} className={`flex ${owns ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  owns ? 'bg-terracotta text-cream' : 'bg-ink/[0.06] text-ink'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p
                  className={`mt-1 font-mono text-[10px] uppercase tracking-[0.15em] ${
                    owns ? 'text-cream/70' : 'text-ink/50'
                  }`}
                >
                  {owns ? 'You' : counterpartyLabel}
                  {' · '}
                  {formatTs(m.at)}
                </p>
              </div>
            </li>
          );
        })}
        {typing ? (
          <li className="flex justify-start" data-testid="typing-indicator">
            <div className="inline-flex items-center gap-1 rounded-full bg-ink/[0.06] px-3 py-1 text-xs text-ink/60">
              <span className="sr-only">{counterpartyLabel} is typing</span>
              <span aria-hidden>{counterpartyLabel} is typing</span>
              <span aria-hidden className="ml-1 inline-flex gap-0.5">
                <span className="h-1 w-1 animate-pulse rounded-full bg-ink/40" />
                <span className="h-1 w-1 animate-pulse rounded-full bg-ink/40 [animation-delay:120ms]" />
                <span className="h-1 w-1 animate-pulse rounded-full bg-ink/40 [animation-delay:240ms]" />
              </span>
            </div>
          </li>
        ) : null}
      </ol>

      {/* one-tap suggested visitor line so the demo flows without typing */}
      {suggestion && !exhausted ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => send(suggestion)}
            disabled={typing}
            className="rounded-full border border-mulberry/30 bg-mulberry/[0.06] px-3 py-1.5 text-xs font-medium text-mulberry transition-colors hover:bg-mulberry/10 disabled:opacity-50"
          >
            {suggestion}
          </button>
        </div>
      ) : null}

      {/* ── send form (markup copied verbatim from ChatSendForm; server action
            swapped for the local `send`) ── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (textareaRef.current) send(textareaRef.current.value);
        }}
        className="flex items-end gap-2"
      >
        <textarea
          ref={textareaRef}
          name="body"
          rows={2}
          maxLength={4000}
          placeholder={exhausted ? 'This is a sample conversation — start your own to keep going.' : 'Type a message…'}
          disabled={exhausted}
          className="input-field min-h-[60px] flex-1 py-2 disabled:opacity-60"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (textareaRef.current) send(textareaRef.current.value);
            }
          }}
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={typing || exhausted}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-mulberry text-cream hover:bg-mulberry-600 disabled:opacity-70"
        >
          <Send className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </form>
    </div>
  );
}
