/**
 * camera-comes-back.test.ts — the camera reopens when the page comes back, when
 * a track ends or stays muted, and when the screen turns or changes width —
 * and never twice, never while hidden, never mid-take, never in a tight loop.
 *
 * Runs `watchCamera` against a fake document, window, clock and a fake
 * MediaDevices whose tracks can be ended or muted from the test. The "page" in
 * each test is the same shape every real camera page has: `open()` asks the
 * fake MediaDevices for a stream, `restart()` stops the old tracks and opens
 * again, and the watch re-arms when the page goes live on the new stream.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMERA_HOLD_POLL_MS,
  CAMERA_MUTE_GRACE_MS,
  CAMERA_QUICK_DEATH_MS,
  CAMERA_RESIZE_SETTLE_MS,
  CAMERA_RESTART_LIMIT,
  CAMERA_RESTART_WINDOW_MS,
  isCameraScreenChange,
  watchCamera,
  type CameraRestartReason,
  type KeepAliveEnv,
} from '@/lib/camera-comes-back';

class Target {
  private ls = new Map<string, Set<() => void>>();
  addEventListener(type: string, l: () => void) {
    if (!this.ls.has(type)) this.ls.set(type, new Set());
    this.ls.get(type)!.add(l);
  }
  removeEventListener(type: string, l: () => void) {
    this.ls.get(type)?.delete(l);
  }
  emit(type: string) {
    for (const l of [...(this.ls.get(type) ?? [])]) l();
  }
  count(type: string) {
    return this.ls.get(type)?.size ?? 0;
  }
}

class FakeTrack extends Target {
  readyState: 'live' | 'ended' = 'live';
  muted = false;
  /** Like the real thing: stop() ends the track WITHOUT firing 'ended'. */
  stop() {
    this.readyState = 'ended';
  }
  /** The OS ends it (background, another app took the camera, Duo moved). */
  die() {
    this.readyState = 'ended';
    this.emit('ended');
  }
  mute() {
    this.muted = true;
    this.emit('mute');
  }
  unmute() {
    this.muted = false;
    this.emit('unmute');
  }
}

class FakeStream {
  constructor(readonly track: FakeTrack) {}
  getVideoTracks() {
    return [this.track];
  }
  getTracks() {
    return [this.track];
  }
}

/** A fake clock + document + window. `tick(ms)` runs due timers in order. */
function makeEnv() {
  let now = 1_000_000;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const doc = Object.assign(new Target(), { hidden: false });
  const win = Object.assign(new Target(), { innerWidth: 375, innerHeight: 812 });
  const env: KeepAliveEnv = {
    doc,
    win,
    setTimeout: (fn, ms) => {
      const id = ++seq;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (h) => {
      timers.delete(h as number);
    },
    now: () => now,
  };
  const tick = (ms: number) => {
    const end = now + ms;
    for (;;) {
      let next: [number, { at: number; fn: () => void }] | null = null;
      for (const e of timers) if (e[1].at <= end && (!next || e[1].at < next[1].at)) next = e;
      if (!next) break;
      timers.delete(next[0]);
      now = next[1].at;
      next[1].fn();
    }
    now = end;
  };
  const setHidden = (hidden: boolean) => {
    doc.hidden = hidden;
    doc.emit('visibilitychange');
  };
  const resize = (w: number, h: number) => {
    win.innerWidth = w;
    win.innerHeight = h;
    win.emit('resize');
  };
  return { env, doc, win, tick, setHidden, resize };
}

/**
 * A camera page in miniature, wired the way the real pages are: a mocked
 * `mediaDevices.getUserMedia`, a stream ref, a `live` flag, and a watch that is
 * armed while live (the hook's `useEffect([live])`).
 */
function makePage(e: ReturnType<typeof makeEnv>, opts: { held?: () => boolean } = {}) {
  const opened: FakeStream[] = [];
  const reasons: CameraRestartReason[] = [];
  const history: number[] = [];
  const mediaDevices = {
    getUserMedia: (constraints: { video: { facingMode: string } }) => {
      constraintsSeen.push(constraints.video.facingMode);
      const s = new FakeStream(new FakeTrack());
      opened.push(s);
      return s;
    },
  };
  const constraintsSeen: string[] = [];
  let stream: FakeStream | null = null;
  let live = false;
  let unwatch: (() => void) | null = null;
  const facing = 'environment';

  const setLive = (next: boolean) => {
    if (next === live) return;
    live = next;
    unwatch?.();
    unwatch = null;
    if (live) {
      unwatch = watchCamera({
        getStream: () => stream,
        restart: (r) => {
          reasons.push(r);
          restart();
        },
        isHeld: () => opts.held?.() ?? false,
        history,
        env: e.env,
      });
    }
  };
  const open = () => {
    stream = mediaDevices.getUserMedia({ video: { facingMode: facing } });
    setLive(true);
  };
  const restart = () => {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    setLive(false); // the page's "starting the camera" state
    open();
  };
  const liveStreams = () => opened.filter((s) => s.track.readyState === 'live').length;
  return {
    open,
    opened,
    reasons,
    constraintsSeen,
    liveStreams,
    current: () => stream!,
    unmount: () => setLive(false),
  };
}

test('the page coming back reopens the camera, with the same facing', () => {
  const e = makeEnv();
  const page = makePage(e);
  page.open();
  e.setHidden(true);
  assert.equal(page.opened.length, 1, 'nothing reopens while the page is hidden');
  e.setHidden(false);
  assert.deepEqual(page.reasons, ['visible']);
  assert.equal(page.opened.length, 2);
  assert.deepEqual(page.constraintsSeen, ['environment', 'environment']);
  assert.equal(page.liveStreams(), 1, 'the old stream is stopped — never two cameras');
});

test('a visible page that was never hidden is left alone', () => {
  const e = makeEnv();
  const page = makePage(e);
  page.open();
  e.doc.emit('visibilitychange'); // a spurious event while visible
  assert.equal(page.opened.length, 1);
});

test('a track that ends reopens the camera at once', () => {
  const e = makeEnv();
  const page = makePage(e);
  page.open();
  page.current().track.die();
  assert.deepEqual(page.reasons, ['ended']);
  assert.equal(page.opened.length, 2);
  assert.equal(page.liveStreams(), 1);
});

test('a track that ends WHILE HIDDEN waits, then reopens once on the way back', () => {
  const e = makeEnv();
  const page = makePage(e);
  page.open();
  e.setHidden(true);
  page.current().track.die();
  assert.equal(page.opened.length, 1, 'iOS refuses getUserMedia in the background');
  e.setHidden(false);
  assert.equal(page.opened.length, 2, 'ended + visible are ONE reopen, not two');
  assert.equal(page.reasons.length, 1);
});

test('a short mute is left alone; a lasting mute reopens', () => {
  const e = makeEnv();
  const page = makePage(e);
  page.open();
  const t = page.current().track;
  t.mute();
  e.tick(CAMERA_MUTE_GRACE_MS / 2);
  t.unmute();
  e.tick(CAMERA_MUTE_GRACE_MS * 2);
  assert.equal(page.opened.length, 1, 'the OS borrowed it and gave it back');
  t.mute();
  e.tick(CAMERA_MUTE_GRACE_MS + 1);
  assert.deepEqual(page.reasons, ['muted']);
  assert.equal(page.opened.length, 2);
});

test('the screen turning or the Duo opening reopens; a keyboard does not', () => {
  const e = makeEnv();
  const page = makePage(e);
  page.open();
  e.resize(375, 480); // keyboard: height only
  e.tick(CAMERA_RESIZE_SETTLE_MS + 1);
  e.resize(390, 812); // a few px of width
  e.tick(CAMERA_RESIZE_SETTLE_MS + 1);
  assert.equal(page.opened.length, 1);
  e.resize(812, 375); // turned to landscape
  e.tick(CAMERA_RESIZE_SETTLE_MS + 1);
  assert.deepEqual(page.reasons, ['resize']);
  e.resize(900, 1000); // Duo opens: portrait again AND wider
  e.tick(CAMERA_RESIZE_SETTLE_MS + 1);
  assert.equal(page.opened.length, 3);
  assert.equal(page.liveStreams(), 1);
});

test('a burst of resize events while the window moves is ONE reopen', () => {
  const e = makeEnv();
  const page = makePage(e);
  page.open();
  for (let w = 375; w <= 812; w += 40) {
    e.resize(w, 812 - (w - 375));
    e.tick(20);
  }
  e.tick(CAMERA_RESIZE_SETTLE_MS + 1);
  assert.equal(page.opened.length, 2);
});

test('never double-opens: every trigger at once is one getUserMedia', () => {
  const e = makeEnv();
  // A page whose restart is slow to answer: it does not go live again at once.
  const opened: FakeStream[] = [];
  let calls = 0;
  const s = new FakeStream(new FakeTrack());
  const stop = watchCamera({
    getStream: () => s,
    restart: () => {
      calls += 1;
      opened.push(new FakeStream(new FakeTrack()));
    },
    isHeld: () => false,
    history: [],
    env: e.env,
  });
  e.setHidden(true);
  e.setHidden(false);
  s.track.die();
  s.track.mute();
  e.resize(812, 375);
  e.tick(CAMERA_MUTE_GRACE_MS + CAMERA_RESIZE_SETTLE_MS + 10);
  assert.equal(calls, 1, 'visible + ended + muted + resize must not open four cameras');
  stop();
});

test('a reopen waits for the take to finish — a restart is never a new shot', () => {
  const e = makeEnv();
  let recording = true;
  const page = makePage(e, { held: () => recording });
  page.open();
  page.current().track.die();
  e.tick(CAMERA_HOLD_POLL_MS * 5);
  assert.equal(page.opened.length, 1, 'mid-clip, the stream is not swapped out');
  recording = false;
  e.tick(CAMERA_HOLD_POLL_MS + 1);
  assert.deepEqual(page.reasons, ['ended']);
  assert.equal(page.opened.length, 2);
});

test('a camera that keeps dying is retried slowly, not in a tight loop', () => {
  const e = makeEnv();
  const page = makePage(e);
  page.open();
  for (let i = 0; i < CAMERA_RESTART_LIMIT + 2; i++) page.current().track.die();
  assert.equal(page.opened.length, 1 + CAMERA_RESTART_LIMIT, 'capped inside the window');
  e.tick(CAMERA_RESTART_WINDOW_MS + 1);
  assert.equal(page.opened.length, 2 + CAMERA_RESTART_LIMIT, 'and retried once the window frees');
  assert.equal(page.liveStreams(), 1);
});

test('a camera that lived is never throttled — turning a phone five times is five reopens', () => {
  const e = makeEnv();
  const page = makePage(e);
  page.open();
  for (let i = 0; i < CAMERA_RESTART_LIMIT + 3; i++) {
    e.tick(CAMERA_QUICK_DEATH_MS + 500); // it lived a few seconds each time
    e.resize(i % 2 === 0 ? 812 : 375, i % 2 === 0 ? 375 : 812);
    e.tick(CAMERA_RESIZE_SETTLE_MS + 1);
  }
  assert.equal(page.opened.length, 1 + CAMERA_RESTART_LIMIT + 3);
  assert.equal(page.liveStreams(), 1);
});

test('a page that leaves its camera stops listening', () => {
  const e = makeEnv();
  const page = makePage(e);
  page.open();
  const t = page.current().track;
  page.unmount();
  assert.equal(e.doc.count('visibilitychange'), 0);
  assert.equal(e.win.count('resize'), 0);
  assert.equal(t.count('ended'), 0);
  e.setHidden(true);
  e.setHidden(false);
  t.die();
  assert.equal(page.opened.length, 1);
});

test('a page whose restart never answers is re-armed, not left without recovery', () => {
  const e = makeEnv();
  let calls = 0;
  const s = new FakeStream(new FakeTrack());
  const stop = watchCamera({
    getStream: () => s,
    restart: () => {
      calls += 1;
    },
    isHeld: () => false,
    history: [],
    env: e.env,
  });
  s.track.die();
  assert.equal(calls, 1);
  e.tick(10_001);
  // re-armed on the (still dead) stream → it asks again
  assert.equal(calls, 2);
  stop();
});

test('isCameraScreenChange: turns and big width moves only', () => {
  assert.equal(isCameraScreenChange({ width: 375, height: 812 }, { width: 812, height: 375 }), true);
  assert.equal(isCameraScreenChange({ width: 375, height: 812 }, { width: 900, height: 1000 }), true);
  assert.equal(isCameraScreenChange({ width: 375, height: 812 }, { width: 375, height: 400 }), false);
  assert.equal(isCameraScreenChange({ width: 1280, height: 800 }, { width: 1200, height: 760 }), false);
});
