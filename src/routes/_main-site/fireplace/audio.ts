// Lazy loudness inputs for expressions: `s` = room sound (microphone),
// `m` = music playing on this computer (tab/screen share audio — the only
// way browsers expose computer audio). Nothing is requested until start().

export type AudioState = "off" | "pending" | "on";

// Shared context; created without a gesture it may sit "suspended", so
// level() keeps nudging resume() until the browser lets it run.
let ctx: AudioContext | null = null;

// A-weighting: emphasize the mids/highs the ear hears as "loud" and
// discount sub-bass rumble, which dominates raw RMS. Normalized to 1kHz.
function aWeight(f: number) {
  const f2 = f * f;
  const ra =
    (12194 ** 2 * f2 * f2) /
    ((f2 + 20.6 ** 2) *
      Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) *
      (f2 + 12194 ** 2));
  return ra / 0.7943; // Ra(1000Hz)
}

function makeInput(getStream: () => Promise<MediaStream>) {
  let stream: MediaStream | null = null;
  let analyser: AnalyserNode | null = null;
  let data: Uint8Array<ArrayBuffer> | null = null;
  let weights: Float32Array | null = null;
  let smoothed = 0;
  let lo = 0;
  let hi = 0.1;
  let gen = 0;

  const input = {
    state: "off" as AudioState,
    err: "",
    value: 0,
    async start() {
      if (input.state !== "off") return;
      input.state = "pending";
      input.err = "";
      const started = gen;
      try {
        const media = await getStream();
        if (gen !== started) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        ctx ??= new AudioContext();
        void ctx.resume();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.5;
        ctx.createMediaStreamSource(media).connect(analyser);
        data = new Uint8Array(analyser.frequencyBinCount);
        const hz = ctx.sampleRate / analyser.fftSize;
        weights = Float32Array.from(data, (_, i) => aWeight((i + 0.5) * hz));
        // browser UI can end a share ("Stop sharing") without us asking
        for (const track of media.getTracks()) {
          track.addEventListener("ended", () => input.stop());
        }
        stream = media;
        input.state = "on";
      } catch (e: unknown) {
        input.err = e instanceof Error ? e.message : String(e);
        input.state = "off";
      }
    },
    stop() {
      gen++;
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      analyser = null;
      data = null;
      weights = null;
      smoothed = 0;
      lo = 0;
      hi = 0.1;
      input.value = 0;
      input.state = "off";
    },
    // 0..1 loudness: A-weighted spectral energy (raw RMS over-counts bass
    // and misses snares/vocals), auto-ranged to the last ~20s of dynamics
    // so any track spans 0..1, with fast attack / slow release for pulse.
    level() {
      if (!analyser || !data || !weights) return 0;
      if (ctx?.state === "suspended") void ctx.resume();
      analyser.getByteFrequencyData(data);
      let sum = 0;
      let wsum = 0;
      for (let i = 0; i < data.length; i++) {
        const a = data[i] / 255;
        sum += weights[i] * a * a;
        wsum += weights[i];
      }
      const loud = Math.sqrt(sum / wsum);
      lo += (loud - lo) * (loud < lo ? 0.05 : 0.002);
      hi += (loud - hi) * (loud > hi ? 0.05 : 0.002);
      // minimum span so silence doesn't get auto-gained into flicker
      const now = Math.max(
        0,
        Math.min(1, (loud - lo) / Math.max(hi - lo, 0.03)),
      );
      smoothed = now > smoothed ? now : smoothed * 0.85 + now * 0.15;
      input.value = smoothed;
      return smoothed;
    },
  };
  return input;
}

export const mic = makeInput(() =>
  navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  }),
);

export const music = makeInput(async () => {
  // Chrome requires video in the getDisplayMedia picker; drop it right away.
  // The extra fields preselect "Entire Screen" with system audio where the
  // platform supports it (macOS Chrome only offers audio on tab shares).
  const media = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: "monitor" },
    audio: true,
    // @ts-expect-error Chrome-only picker hints, not yet in lib.dom
    systemAudio: "include",
    monitorTypeSurfaces: "include",
    selfBrowserSurface: "exclude",
  });
  for (const track of media.getVideoTracks()) {
    track.stop();
    media.removeTrack(track);
  }
  if (!media.getAudioTracks().length) {
    media.getTracks().forEach((t) => t.stop());
    throw new Error(
      'no audio shared — pick a tab and check "Also share tab audio"',
    );
  }
  return media;
});
