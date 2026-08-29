// Lazy loudness inputs for expressions: `s` = room sound (microphone),
// `m` = music playing on this computer (tab/screen share audio — the only
// way browsers expose computer audio). Nothing is requested until start().

export type AudioState = "off" | "pending" | "on";

// Shared context; created without a gesture it may sit "suspended", so
// level() keeps nudging resume() until the browser lets it run.
let ctx: AudioContext | null = null;

function makeInput(getStream: () => Promise<MediaStream>) {
  let stream: MediaStream | null = null;
  let analyser: AnalyserNode | null = null;
  let data: Uint8Array<ArrayBuffer> | null = null;
  let smoothed = 0;
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
        ctx.createMediaStreamSource(media).connect(analyser);
        data = new Uint8Array(analyser.fftSize);
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
      smoothed = 0;
      input.value = 0;
      input.state = "off";
    },
    // 0..1 loudness: RMS with fast attack / slow release so beats pulse.
    level() {
      if (!analyser || !data) return 0;
      if (ctx?.state === "suspended") void ctx.resume();
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) {
        const x = (v - 128) / 128;
        sum += x * x;
      }
      const now = Math.min(1, Math.sqrt(sum / data.length) * 4);
      smoothed = now > smoothed ? now : smoothed * 0.9 + now * 0.1;
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
