## 2026-11-26 · fix(chat): a send raises no "Saving your changes" cover

Owner, supplier walk 26 Nov: every chat send covered the screen with the app-wide save veil and read as a page refresh ("this kind of refresh doesn't happen on messenger"). The composer's Send is now `overlay={false}`; the message's own delivery line (Sending… / Sent / Not sent) says what is happening. One composer, so host, supplier and group chats all change. Guard: `app/_components/a-chat-send-raises-no-veil.test.ts`.
