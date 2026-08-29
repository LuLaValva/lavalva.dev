// Lazy loudness inputs for expressions: `s` = room sound (microphone),
// `m` = music playing on this computer (tab/screen share audio — the only
// way browsers expose computer audio). Nothing is requested until start().

export type AudioState = "off" | "pending" | "on";

// Loudness flavors, pickable per input. "rms" is plain energy (bass-heavy
// but direct), "a-weighted" follows the ear's frequency response,
// "auto-ranged" stretches recent dynamics across 0..1, "beat flux" spikes
// on spectral change (drum hits) rather than sustained volume.
export const ALGORITHMS = [
  "rms",
  "a-weighted",
  "auto-ranged",
  "beat flux",
] as const;
export type Algorithm = (typeof ALGORITHMS)[number];

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
  let time: Uint8Array<ArrayBuffer> | null = null;
  let freq: Uint8Array<ArrayBuffer> | null = null;
  let prev: Uint8Array<ArrayBuffer> | null = null;
  let prevValid = false;
  let weights: Float32Array | null = null;
  let smoothed = 0;
  let lo = 0;
  let hi = 0.1;
  let gen = 0;

  const input = {
    state: "off" as AudioState,
    err: "",
    value: 0,
    algo: "rms" as Algorithm,
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
        time = new Uint8Array(analyser.fftSize);
        freq = new Uint8Array(analyser.frequencyBinCount);
        prev = new Uint8Array(analyser.frequencyBinCount);
        prevValid = false;
        const hz = ctx.sampleRate / analyser.fftSize;
        weights = Float32Array.from(freq, (_, i) => aWeight((i + 0.5) * hz));
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
      time = null;
      freq = null;
      prev = null;
      weights = null;
      smoothed = 0;
      lo = 0;
      hi = 0.1;
      input.value = 0;
      input.state = "off";
    },
    // 0..1 loudness per the selected algorithm, with fast attack and slow
    // release so beats read as pulses.
    level() {
      if (!analyser || !time || !freq || !prev || !weights) return 0;
      if (ctx?.state === "suspended") void ctx.resume();
      let now = 0;
      if (input.algo === "rms") {
        analyser.getByteTimeDomainData(time);
        let sum = 0;
        for (const v of time) {
          const x = (v - 128) / 128;
          sum += x * x;
        }
        now = Math.min(1, Math.sqrt(sum / time.length) * 4);
      } else if (input.algo === "beat flux") {
        analyser.getByteFrequencyData(freq);
        let flux = 0;
        for (let i = 0; i < freq.length; i++) {
          flux += Math.max(0, freq[i] - prev[i]) / 255;
        }
        now = prevValid ? Math.min(1, (flux / freq.length) * 12) : 0;
        prev.set(freq);
        prevValid = true;
      } else {
        analyser.getByteFrequencyData(freq);
        let sum = 0;
        let wsum = 0;
        for (let i = 0; i < freq.length; i++) {
          const a = freq[i] / 255;
          sum += weights[i] * a * a;
          wsum += weights[i];
        }
        const loud = Math.sqrt(sum / wsum);
        if (input.algo === "auto-ranged") {
          // stretch the last ~20s of dynamics across 0..1, with a minimum
          // span so silence doesn't get auto-gained into flicker
          lo += (loud - lo) * (loud < lo ? 0.05 : 0.002);
          hi += (loud - hi) * (loud > hi ? 0.05 : 0.002);
          now = Math.max(0, Math.min(1, (loud - lo) / Math.max(hi - lo, 0.03)));
        } else {
          now = Math.min(1, loud * 2.5);
        }
      }
      // flux releases faster so consecutive hits stay distinct
      const keep = input.algo === "beat flux" ? 0.75 : 0.9;
      smoothed = now > smoothed ? now : smoothed * keep + now * (1 - keep);
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
