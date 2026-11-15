/**
 * Renderer for `the-chat-box-is-in-the-window.spec.ts` — prints, as JSON on stdout, the REAL open thread (the one thread
 * page `ChatThreadFrame` holding one `ChatBox`, its bubbles in the shipped `SwipeToDelete`) in the two frames it opens in:
 *   · `panes` — beside the list from 701: the real `ChatPanes` (→ `SupplierColumns`), `open`, as both thread routes draw it;
 *   · `phone` — the thread alone, the full-screen takeover below 701.
 * The thread is the BUSY case W1 measured (RW-330): a head, a notice, a tall payment-plan band and a long stream — taller
 * than the window, so the box scrolls as one and the composer must still sit in the window, on top of every bubble.
 * Run by the spec in a `tsx` child process (Playwright's transform cannot server-render imported JSX).
 */
export {};

async function main() {
  const React = await import('react');
  /* tsx compiles the app's JSX to React.createElement, so React must be a global here (as the unit tests set it). */
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { ChatPanes } = await import('../../app/dashboard/[eventId]/messages/_components/chat-panes');
  const { ChatThreadFrame } = await import('../../app/_components/chat/chat-thread-frame');
  const { ChatBox } = await import('../../app/_components/chat/chat-box');
  const { ChatThreadHead } = await import('../../app/_components/chat/chat-thread-head');
  const { SwipeToDelete } = await import('../../app/_components/swipe-to-delete');
  const h = React.createElement;

  const bubble = (i: number) =>
    h(
      'li',
      { key: i, className: i % 2 ? 'flex justify-end' : 'flex', 'data-test-bubble': '' },
      // `children` in the props object — the component REQUIRES it, and the 3rd-argument form fails tsc's overloads.
      h(SwipeToDelete, {
        label: `Delete message ${i}`,
        onDelete: () => {},
        surfaceClass: 'bg-terracotta',
        radiusClass: 'rounded-2xl',
        children: h('p', { className: 'max-w-[16rem] px-3 py-2 text-white' }, `TEST message ${i} — a line long enough to wrap once.`),
      }),
    );

  const thread = h(ChatThreadFrame, {
    children: h(ChatBox, {
      header: h(ChatThreadHead, {
        back: h('a', { href: '#' }, '‹'),
        name: 'TEST’s Birthday (Dec 20)',
        initials: 'TO',
        actions: h('button', { type: 'button' }, '⋯'),
      }),
      notice: h('p', { className: 'px-4 py-3 text-sm' }, 'Everything you need for this event is already in Setnayan.'),
      pinned: h('div', { className: 'm-4 h-[22rem] rounded-2xl border border-ink/10 p-4', 'data-test-pinned': '' }, 'Payment plan'),
      composer: h(
        'form',
        { className: 'flex min-h-11 items-center gap-2', 'data-test-composer': '' },
        h('input', { className: 'h-11 flex-1 rounded-full px-4', placeholder: 'Message' }),
        h('button', { type: 'submit', className: 'h-11 w-11' }, '➤'),
      ),
      children: h('ul', { className: 'space-y-2 py-2' }, Array.from({ length: 24 }, (_, i) => bubble(i))),
    }),
  });

  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  const panes = renderToStaticMarkup(
    h(
      AppRouterContext.Provider,
      { value: router as never },
      h(ChatPanes, { open: true, list: h('div', { className: 'p-4', 'data-test-list': '' }, 'Chats'), children: thread }),
    ),
  );
  const phone = renderToStaticMarkup(thread);
  process.stdout.write(JSON.stringify({ panes, phone }));
}

void main();
