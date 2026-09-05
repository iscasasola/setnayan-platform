/**
 * S3 · the programme audio mixer, against a fake Web Audio engine that actually RENDERS.
 *
 * The fake is not a recorder of calls: it models the one rule that makes this graph's shape
 * load-bearing — Web Audio only pulls a node when an ACTIVE SOURCE reaches it and it reaches
 * the context destination. That is why `ConstantSourceNode` and the muted `Gain(0) →
 * destination` leg are in `audio-mixer.ts` at all, and modelling the rule is what lets a
 * sabotage of either one come out RED instead of silently passing.
 *
 * The tap it drives is the REAL `SetnayanTapProcessor` from audio-tap.worklet.ts, and the
 * quanta it emits go through the REAL packer and the REAL master clock — so the last test in
 * this file is the whole S3 pipeline end to end, minus only the OffscreenCanvas.
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '../strip-comments';

import {
  AUDIO_QUANTUM_FRAMES,
  AUDIO_SAMPLE_RATE,
  VIDEO_TICK_FRAMES,
  createAudioMasterClock,
  framesToMicros,
} from './audio-clock';
import { createAudioPacker, type AudioPacket } from './audio-packer';
import {
  AUDIO_TAP_MODULE_URL,
  AUDIO_TAP_PROCESSOR,
  CUT_RAMP_SECONDS,
  createAudioMixer,
  planCutGains,
  type AudioContextLike,
  type AudioNodeLike,
  type AudioParamLike,
  type ConstantSourceNodeLike,
  type GainNodeLike,
  type MediaStreamLike,
  type MessagePortLike,
} from './audio-mixer';
import { SetnayanTapProcessor, TAP_QUANTUM_FRAMES } from './audio-tap.worklet';

/* ── a fake Web Audio engine ───────────────────────────────────────────────── */

type ParamEvent = { kind: 'set' | 'ramp'; value: number; time: number };

class FakeParam implements AudioParamLike {
  private events: ParamEvent[] = [];
  constructor(
    private readonly clock: () => number,
    private initial = 0,
  ) {}
  get value(): number {
    return this.valueAt(this.clock());
  }
  setValueAtTime(value: number, when: number): unknown {
    this.events.push({ kind: 'set', value, time: when });
    return this;
  }
  linearRampToValueAtTime(value: number, when: number): unknown {
    this.events.push({ kind: 'ramp', value, time: when });
    return this;
  }
  cancelScheduledValues(when: number): unknown {
    // Keep only the last two past events. Anchors older than the most recent set/ramp pair
    // cannot affect a query at or after that pair, and the mixer calls this on EVERY cut — so
    // without the slice the event list grows with the run and `valueAt` (called once per
    // source per quantum, 675,000 times in the 30-minute test) sorts an ever-longer array.
    this.events = this.events.filter((e) => e.time < when).slice(-2);
    return this;
  }
  valueAt(t: number): number {
    let anchorValue = this.initial;
    let anchorTime = -Infinity;
    for (const e of [...this.events].sort((a, b) => a.time - b.time)) {
      if (e.time <= t) {
        anchorValue = e.value;
        anchorTime = e.time;
        continue;
      }
      if (e.kind === 'ramp' && Number.isFinite(anchorTime)) {
        const span = e.time - anchorTime;
        const progress = span <= 0 ? 1 : (t - anchorTime) / span;
        return anchorValue + (e.value - anchorValue) * progress;
      }
      break;
    }
    return anchorValue;
  }
}

type FakeNode = AudioNodeLike & {
  kind: string;
  outs: Set<FakeNode>;
  /** An always-on generator (a camera mic) or a started ConstantSource. */
  sample?: (frame: number) => number;
  active?: boolean;
  param?: FakeParam;
};

function fakeEngine() {
  let framesRendered = 0;
  const nodes: FakeNode[] = [];
  const addModule: string[] = [];
  let tap: FakeNode | null = null;
  let processor: SetnayanTapProcessor | null = null;
  let destination: FakeNode;

  const clock = () => framesRendered / AUDIO_SAMPLE_RATE;

  function node(kind: string, extra: Partial<FakeNode> = {}): FakeNode {
    const n: FakeNode = {
      kind,
      outs: new Set<FakeNode>(),
      connect(dest: AudioNodeLike) {
        n.outs.add(dest as FakeNode);
        return dest;
      },
      disconnect() {
        n.outs.clear();
      },
      ...extra,
    };
    nodes.push(n);
    return n;
  }

  destination = node('destination');

  /** Every node reachable downstream of `from`. */
  function reach(from: FakeNode, seen = new Set<FakeNode>()): Set<FakeNode> {
    for (const out of from.outs) if (!seen.has(out)) reach((seen.add(out), out), seen);
    return seen;
  }

  /** Live sources: a started ConstantSource, or any media-stream source. */
  function activeSources(): FakeNode[] {
    return nodes.filter((n) => n.active && n.sample);
  }

  /** The gain the path from `src` to `tap` applies right now, or null if there is no path. */
  function pathGain(src: FakeNode, target: FakeNode, t: number, seen = new Set<FakeNode>()): number | null {
    if (src === target) return 1;
    if (seen.has(src)) return null;
    seen.add(src);
    let total: number | null = null;
    for (const out of src.outs) {
      const downstream = pathGain(out, target, t, seen);
      if (downstream === null) continue;
      const g = out.kind === 'gain' && out.param ? out.param.valueAt(t) : 1;
      total = (total ?? 0) + downstream * g;
    }
    return total;
  }

  const ctx: AudioContextLike = {
    get currentTime() {
      return clock();
    },
    sampleRate: AUDIO_SAMPLE_RATE,
    state: 'running',
    destination,
    audioWorklet: {
      addModule: async (url: string) => {
        addModule.push(url);
      },
    },
    createGain: () => {
      const param = new FakeParam(clock);
      const n = node('gain', { param });
      (n as unknown as { gain: FakeParam }).gain = param;
      return n as unknown as GainNodeLike;
    },
    createConstantSource: () => {
      const param = new FakeParam(clock);
      const n = node('constant', { param, active: false, sample: () => 0 });
      Object.assign(n, {
        offset: param,
        start: () => {
          n.active = true;
        },
        stop: () => {
          n.active = false;
        },
      });
      return n as unknown as ConstantSourceNodeLike;
    },
    createMediaStreamSource: (stream: MediaStreamLike) => {
      const tone = (stream as unknown as { tone?: (f: number) => number }).tone;
      return node('media-source', { active: true, sample: tone ?? (() => 0) }) as unknown as AudioNodeLike;
    },
    createMediaStreamDestination: () => {
      const n = node('stream-destination');
      Object.assign(n, { stream: { getAudioTracks: () => [] } satisfies MediaStreamLike });
      return n as unknown as AudioNodeLike & { stream: MediaStreamLike };
    },
    createWorkletNode: (name: string) => {
      assert.equal(name, AUDIO_TAP_PROCESSOR);
      const proc = new SetnayanTapProcessor();
      processor = proc;
      const n = node('worklet');
      tap = n;
      Object.assign(n, {
        port: {
          postMessage: (message: unknown) => proc.port.onmessage?.({ data: message }),
        } satisfies MessagePortLike,
      });
      return n as unknown as AudioNodeLike & { port: MessagePortLike };
    },
    resume: async () => {},
    close: async () => {},
  };

  return {
    ctx,
    addModule,
    nodes,
    node: () => ({ tap, destination }),
    /** Is the tap pulled at all? Both halves of the rule, exactly as the engine applies it. */
    pulled(): boolean {
      if (!tap) return false;
      const fed = activeSources().some((s) => reach(s).has(tap as FakeNode));
      return fed && reach(tap).has(destination);
    },
    /** Render `n` quanta. Returns how many the engine actually produced. */
    render(n: number): number {
      let produced = 0;
      for (let q = 0; q < n; q += 1) {
        if (!this.pulled() || !processor || !tap) break;
        const t = clock();
        const left = new Float32Array(TAP_QUANTUM_FRAMES);
        const right = new Float32Array(TAP_QUANTUM_FRAMES);
        for (const src of activeSources()) {
          const g = pathGain(src, tap, t);
          if (g === null || g === 0) continue;
          for (let i = 0; i < TAP_QUANTUM_FRAMES; i += 1) {
            const v = (src.sample as (f: number) => number)(framesRendered + i) * g;
            left[i] = (left[i] as number) + v;
            right[i] = (right[i] as number) + v;
          }
        }
        (globalThis as unknown as { currentFrame: number }).currentFrame = framesRendered;
        processor.process([[left, right]]);
        framesRendered += AUDIO_QUANTUM_FRAMES;
        produced += 1;
      }
      return produced;
    },
    frames: () => framesRendered,
  };
}

/** A camera stream. `tone` is null for a phone whose owner refused the mic. */
function camera(tone: number | null): MediaStreamLike {
  const stream = {
    getAudioTracks: () => (tone === null ? [] : [{ id: `tone-${tone}` }]),
  } as MediaStreamLike;
  if (tone !== null) {
    (stream as unknown as { tone: (f: number) => number }).tone = (f) =>
      Math.sin((2 * Math.PI * tone * f) / AUDIO_SAMPLE_RATE);
  }
  return stream;
}

async function mixerOn(engine: ReturnType<typeof fakeEngine>) {
  const mixer = createAudioMixer({ deps: { createContext: () => engine.ctx } });
  await mixer.start();
  return mixer;
}

/* ── the pure half ─────────────────────────────────────────────────────────── */

test('planCutGains puts exactly one camera up, and an unknown key silences the programme', () => {
  assert.deepEqual(planCutGains(['cam1', 'cam2', 'cam3'], 'cam2'), { cam1: 0, cam2: 1, cam3: 0 });
  assert.deepEqual(planCutGains(['cam1', 'cam2'], null), { cam1: 0, cam2: 0 });
  assert.deepEqual(planCutGains(['cam1', 'cam2'], 'cam9'), { cam1: 0, cam2: 0 });
  // Split mode takes PRIMARY only — `cut()` names one camera, so there is no shape in which
  // two sources are up at once. This is the assertion that says so.
  const plan = planCutGains(['cam1', 'cam2', 'cam3'], 'cam1');
  assert.equal(Object.values(plan).filter((g) => g === 1).length, 1);
});

/* ── the graph ─────────────────────────────────────────────────────────────── */

test('start() loads the shipped worklet, sums a ConstantSource, and reaches the destination silently', async () => {
  const engine = fakeEngine();
  const mixer = await mixerOn(engine);

  assert.deepEqual(engine.addModule, [AUDIO_TAP_MODULE_URL]);
  const constant = engine.nodes.find((n) => n.kind === 'constant');
  assert.ok(constant, 'a ConstantSourceNode must exist');
  assert.equal(constant.active, true, 'and it must be started');
  assert.equal(constant.param?.valueAt(0), 0, 'at offset 0 — silence, not tone');

  // The tap is pulled with NO cameras at all: that is the whole point of the constant source.
  assert.equal(engine.pulled(), true);
  assert.equal(engine.render(4), 4);

  // Nothing the couple can hear: the only path to the destination goes through a gain of 0.
  const muted = engine.nodes.find((n) => n.kind === 'gain' && n.outs.has(engine.node().destination as never));
  assert.ok(muted, 'the tap must reach ctx.destination');
  assert.equal(muted.param?.valueAt(1), 0, 'through a gain pinned at 0');

  // The B-remux sibling exists and carries the same mix. Unused on Path A.
  assert.ok(mixer.remuxDestination(), 'remux destination');
  const tapNode = engine.node().tap;
  assert.ok([...(tapNode?.outs ?? [])].some((n) => n.kind === 'stream-destination'));
  await mixer.stop();
});

test('a camera with a mic gets a source node; a mic-less one gets none but is still registered', async () => {
  const engine = fakeEngine();
  const mixer = await mixerOn(engine);
  mixer.setCamera('cam1', camera(440));
  mixer.setCamera('cam2', camera(null));
  assert.deepEqual(mixer.stats().cameras, 2);
  assert.deepEqual(mixer.stats().withAudio, 1);
  assert.equal(engine.nodes.filter((n) => n.kind === 'media-source').length, 1);
  await mixer.stop();
});

test('a cut is a 5 ms linear cross-fade on gains — no rewiring, no click, half-way at 2.5 ms', async () => {
  const engine = fakeEngine();
  const mixer = await mixerOn(engine);
  mixer.setCamera('cam1', camera(440));
  mixer.setCamera('cam2', camera(880));
  const wiresBefore = engine.nodes.filter((n) => n.kind === 'media-source').length;

  mixer.cut('cam1');
  engine.render(400); // ~1 s
  mixer.cut('cam2');
  const cutAt = engine.frames() / AUDIO_SAMPLE_RATE;

  const gains = engine.nodes.filter((n) => n.kind === 'gain' && n.param);
  const up = gains.filter((g) => (g.param as FakeParam).valueAt(cutAt + CUT_RAMP_SECONDS) === 1);
  assert.equal(up.length, 1, 'exactly one camera is up after the ramp');
  const rising = up[0]?.param as FakeParam;
  assert.ok(Math.abs(rising.valueAt(cutAt + CUT_RAMP_SECONDS / 2) - 0.5) < 1e-9, 'linear, half-way at 2.5 ms');
  assert.equal(rising.valueAt(cutAt), 0, 'and it starts from where it was');
  assert.equal(
    engine.nodes.filter((n) => n.kind === 'media-source').length,
    wiresBefore,
    'a cut must not build or drop a source node',
  );
  assert.equal(mixer.stats().onAir, 'cam2');
  await mixer.stop();
});

/**
 * Source with comments removed — a docblock that NAMES a forbidden call is not a call.
 *
 * Uses the repo's ONE stripper (`lib/strip-comments.ts`), not a pair of regexes. The obvious
 * two-line version strips BLOCK comments first, so a `//` line mentioning `video/*` opens a
 * comment that never existed and silently blanks everything up to the next real `*` + `/` —
 * which would make the guards below assert against nothing and pass. `lint-one-comment-stripper`
 * is a required CI guard for exactly this, and it caught the first draft of this file.
 */
function code(file: string): string {
  return stripComments(readFileSync(join(__dirname, file), 'utf8'));
}

test('the laptop mic is not an input — the mixer never asks for a capture device', () => {
  const src = code('audio-mixer.ts');
  assert.doesNotMatch(src, /getUserMedia/);
  assert.doesNotMatch(src, /getDisplayMedia/);
  assert.doesNotMatch(src, /mediaDevices/);
  // The docblock says so too, and that sentence is allowed to exist.
  assert.match(readFileSync(join(__dirname, 'audio-mixer.ts'), 'utf8'), /THE LAPTOP MIC IS NOT AN INPUT/);
});

test('lib/encoder carries no Tauri gate in the S3 files either (rule 22 — S5 owns the call site)', () => {
  for (const f of ['audio-mixer.ts', 'audio-clock.ts', 'audio-packer.ts', 'audio-tap.worklet.ts']) {
    assert.doesNotMatch(code(f), /__TAURI__/, f);
  }
});

test('the canvas worker has no timer left — the audio thread is the only clock (S3 guard)', () => {
  const src = code('program-canvas.worker.ts');
  assert.equal(src.match(/\bsetInterval\s*\(/g)?.length ?? 0, 0);
  assert.equal(src.match(/\brequestAnimationFrame\s*\(/g)?.length ?? 0, 0);
  assert.equal(src.match(/\bsetTimeout\s*\(/g)?.length ?? 0, 0);
  assert.match(src, /createAudioMasterClock/);
});

/* ── the pipeline, end to end ──────────────────────────────────────────────── */

/** Wire mixer → tap → packer → clock exactly as program-canvas.worker.ts does. */
function pipeline(engine: ReturnType<typeof fakeEngine>, mixer: Awaited<ReturnType<typeof mixerOn>>) {
  const packets: AudioPacket[] = [];
  let ticks = 0;
  let lastAudioPts = 0;
  let audioCoveredTo = 0;
  /** Newest video stamp vs newest audio stamp. Pure quantisation of two grids — see the test. */
  let maxStampSkewMs = 0;
  /** Newest video stamp vs how far the audio timeline has actually been written. */
  let maxCoverageSkewMs = 0;
  const skewByMinute = new Map<number, number>();
  let originFrame: number | null = null;

  const packer = createAudioPacker((p) => {
    packets.push(p);
    lastAudioPts = p.timestampMicros;
    audioCoveredTo = framesToMicros(p.frameIndex + p.numberOfFrames);
  });
  const clock = createAudioMasterClock((tick) => {
    ticks += 1;
    const stampSkew = Math.abs(tick.timestampMicros - lastAudioPts) / 1000;
    if (stampSkew > maxStampSkewMs) maxStampSkewMs = stampSkew;
    const coverageSkew = Math.abs(tick.timestampMicros - audioCoveredTo) / 1000;
    if (coverageSkew > maxCoverageSkewMs) maxCoverageSkewMs = coverageSkew;
    const minute = Math.floor(tick.timestampMicros / 60_000_000);
    skewByMinute.set(minute, Math.max(skewByMinute.get(minute) ?? 0, stampSkew));
  });

  const port: MessagePortLike = {
    postMessage: (message: unknown) => {
      const m = message as { type: string; currentFrame: number; frames: Float32Array };
      if (m.type !== 'quantum') return;
      if (originFrame === null) originFrame = m.currentFrame;
      packer.push(m.frames);
      clock.advance(m.currentFrame - originFrame + AUDIO_QUANTUM_FRAMES);
    },
  };
  mixer.linkToWorker(port);
  return {
    packets,
    clock,
    packer,
    ticks: () => ticks,
    maxStampSkewMs: () => maxStampSkewMs,
    maxCoverageSkewMs: () => maxCoverageSkewMs,
    skewByMinute,
  };
}

test('EVERY camera mic-less: AudioData still flows. Remove the ConstantSourceNode and this goes red.', async () => {
  const engine = fakeEngine();
  const mixer = await mixerOn(engine);
  const run = pipeline(engine, mixer);
  mixer.setCamera('cam1', camera(null));
  mixer.setCamera('cam2', camera(null));
  mixer.cut('cam1');

  const quanta = engine.render(800); // ~2.1 s
  assert.equal(quanta, 800, 'the graph must render with no mic in the room');
  assert.equal(run.packets.length, 100, '800 quanta is 100 AAC frames');
  assert.ok(
    run.packets.every((p) => p.data.every((v) => v === 0)),
    'and every sample is digital silence — a stream, not a dead track',
  );
  await mixer.stop();
});

test('cut the muted destination leg and rendering stops — that one line is load-bearing', async () => {
  const engine = fakeEngine();
  assert.equal(engine.pulled(), false, 'before start there is no tap and nothing is pulled');
  const mixer = await mixerOn(engine);
  assert.equal(engine.render(4), 4);
  const muted = engine.nodes.find((n) => n.kind === 'gain' && n.outs.has(engine.node().destination as never));
  assert.ok(muted);
  muted.outs.clear();
  assert.equal(engine.pulled(), false, 'a tap that reaches no destination is never pulled');
  assert.equal(engine.render(4), 0);
  await mixer.stop();
});

test('30 minutes, a cut every 10 s, one phone mic-less: no timestamp discontinuity, skew under 40 ms', async () => {
  const engine = fakeEngine();
  const mixer = await mixerOn(engine);
  const run = pipeline(engine, mixer);
  mixer.setCamera('cam1', camera(440));
  mixer.setCamera('cam2', camera(null)); // the phone whose owner refused the mic
  mixer.cut('cam1');

  const quantaPerSecond = AUDIO_SAMPLE_RATE / AUDIO_QUANTUM_FRAMES; // 375
  const minutes = 30;
  let cuts = 0;
  for (let tenSeconds = 0; tenSeconds < minutes * 6; tenSeconds += 1) {
    assert.equal(engine.render(quantaPerSecond * 10), quantaPerSecond * 10, `block ${tenSeconds}`);
    mixer.cut(tenSeconds % 2 === 0 ? 'cam2' : 'cam1');
    cuts += 1;
  }
  assert.equal(cuts, 180);

  const totalQuanta = minutes * 60 * quantaPerSecond;
  assert.equal(run.packets.length, totalQuanta / 8);

  // THE GUARD: consecutive AudioData timestamps never jump, across 180 cuts.
  const nominal = (1024 * 1e6) / AUDIO_SAMPLE_RATE;
  let worstDelta = 0;
  for (let n = 1; n < run.packets.length; n += 1) {
    const delta = (run.packets[n]?.timestampMicros ?? 0) - (run.packets[n - 1]?.timestampMicros ?? 0);
    worstDelta = Math.max(worstDelta, Math.abs(delta - nominal));
    assert.equal(run.packets[n]?.timestampMicros, framesToMicros(n * 1024), `packet ${n}`);
  }
  assert.ok(worstDelta < 1, `worst delta error ${worstDelta} µs`);

  // THE OTHER GUARD: the picture stayed on the same timeline as the sound.
  //
  // Two skews, because the prompt's single number hides which is which:
  //  · STAMP skew — newest video PTS against the newest AAC frame's START. This is pure
  //    quantisation of a 33.33 ms grid against a 21.33 ms one; it tops out at exactly 40.000 ms
  //    (1920 frames) and it does so in the first seconds, not after thirty minutes. Reading its
  //    value as "drift" is the mistake this comment exists to stop.
  //  · COVERAGE skew — newest video PTS against how far the audio timeline has been WRITTEN
  //    (packet start + 1024). That is the number a muxer feels, and the 40 ms bar is its bar.
  // DRIFT is neither of them: it is whether either number GROWS. It does not, and the
  // minute-by-minute assertion below is what says so — over 30 minutes and 180 cuts the worst
  // skew in minute 29 is identical to minute 0, to the microsecond.
  assert.equal(run.ticks(), Math.floor((totalQuanta * AUDIO_QUANTUM_FRAMES) / VIDEO_TICK_FRAMES) + 1);
  assert.ok(run.maxCoverageSkewMs() < 40, `max coverage skew = ${run.maxCoverageSkewMs().toFixed(3)} ms`);
  assert.equal(run.maxStampSkewMs(), 40, 'the analytic quantisation bound, hit early and never exceeded');

  const minutes0 = run.skewByMinute.get(0);
  const minutesLast = run.skewByMinute.get(minutes - 1);
  assert.equal(minutesLast, minutes0, 'the worst skew in the last minute equals the first — no drift');
  // The 30:00.000 tick opens a 31st bucket holding one sample; compare the 30 FULL minutes.
  assert.equal(run.skewByMinute.size, minutes + 1);
  const fullMinutes = [...run.skewByMinute.entries()].filter(([m]) => m < minutes).map(([, v]) => v);
  assert.equal(fullMinutes.length, minutes);
  assert.ok(fullMinutes.every((v) => v === minutes0), 'and every minute in between');

  console.log(
    `      30-min sim · 180 cuts · ${run.packets.length} AAC frames · ${run.ticks()} pictures · ` +
      `coverage skew max ${run.maxCoverageSkewMs().toFixed(3)} ms · stamp skew max ` +
      `${run.maxStampSkewMs().toFixed(3)} ms (flat across all ${minutes} minutes) · ` +
      `worst AAC delta error ${worstDelta.toFixed(3)} µs`,
  );
  await mixer.stop();
});
