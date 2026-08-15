import { type Crop, cropPixels, outputSize } from "./crop";
import type { EncodeResponse } from "./encode-worker";
import type { GifOptions } from "./gif-encoder";
import { type GifMode, playbackOrder } from "./playback";

const SEEK_TIMEOUT = 5000;
const PREVIEW_SEEK_TIMEOUT = 500;
const FRAME_SAMPLES = 8;
const DETECT_TIMEOUT = 1500;
/** Snap targets. A percent of error drifts a whole frame over a few hundred. */
const COMMON_RATES = [
  8,
  10,
  12,
  15,
  20,
  24000 / 1001,
  24,
  25,
  30000 / 1001,
  30,
  48,
  50,
  60000 / 1001,
  60,
  100,
  120,
];

/**
 * iOS Safari holds no frames until playback happens once, so seeking has
 * nothing to paint. Muted inline playback is exempt from autoplay rules.
 */
export async function primeVideo(video: HTMLVideoElement) {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;
  video.muted = true;
  try {
    await video.play();
  } catch {
    // Refused. The user's first real play() will load it.
    return;
  }
  video.pause();
}

/**
 * Seconds per source frame, or null where the browser won't say (Firefox has
 * no `requestVideoFrameCallback`). Counts presented frames, not callbacks, so
 * dropped frames don't skew it.
 */
export async function detectFrameRate(video: HTMLVideoElement) {
  if (!video.requestVideoFrameCallback) return null;

  const resumeAt = video.currentTime;
  video.muted = true;
  try {
    await video.play();
  } catch {
    return null;
  }

  const measured = await new Promise<number | null>((resolve) => {
    let first: VideoFrameCallbackMetadata | undefined;
    let last: VideoFrameCallbackMetadata | undefined;
    const stop = new AbortController();

    const finish = () => {
      clearTimeout(timer);
      stop.abort();
      const frames =
        first && last ? last.presentedFrames - first.presentedFrames : 0;
      const elapsed = first && last ? last.mediaTime - first.mediaTime : 0;
      resolve(frames > 0 && elapsed > 0 ? elapsed / frames : null);
    };

    const onFrame = (_now: number, meta: VideoFrameCallbackMetadata) => {
      first ??= meta;
      last = meta;
      if (meta.presentedFrames - first.presentedFrames >= FRAME_SAMPLES)
        finish();
      else video.requestVideoFrameCallback(onFrame);
    };

    // A clip too short to present that many would hang.
    const timer = setTimeout(finish, DETECT_TIMEOUT);
    video.addEventListener("ended", finish, {
      signal: stop.signal,
      once: true,
    });
    video.requestVideoFrameCallback(onFrame);
  });

  video.pause();
  video.currentTime = resumeAt;
  if (measured === null) return null;

  const rate = 1 / measured;
  let closest = COMMON_RATES[0]!;
  for (const candidate of COMMON_RATES) {
    if (Math.abs(candidate - rate) < Math.abs(closest - rate))
      closest = candidate;
  }
  return Math.abs(closest - rate) / rate < 0.02 ? 1 / closest : measured;
}

/**
 * Readies a loaded video and reports its frame rate. One call, not three:
 * priming must precede any frame read, and measuring plays the video.
 */
export async function prepareVideo(video: HTMLVideoElement, showAt: number) {
  await primeVideo(video);
  const frameSeconds = await detectFrameRate(video).catch(() => null);
  previewSeek(video, showAt);
  return frameSeconds;
}

interface PreviewSeek {
  target?: number;
  waiting?: ReturnType<typeof setTimeout>;
}

const previewSeeks = new WeakMap<HTMLVideoElement, PreviewSeek>();

function seekState(video: HTMLVideoElement) {
  let state = previewSeeks.get(video);
  if (!state) previewSeeks.set(video, (state = {}));
  return state;
}

/**
 * Seeks the preview, collapsing a burst of scrubbing to the latest target.
 * Mobile WebKit drops `currentTime` assigned mid-seek.
 */
export function previewSeek(video: HTMLVideoElement, time: number) {
  seekState(video).target = time;
  flushSeek(video);
}

function flushSeek(video: HTMLVideoElement, force = false) {
  const state = seekState(video);
  if (state.target === undefined) return;
  if (force || !video.seeking) {
    video.currentTime = state.target;
    state.target = undefined;
  }
  watchSeek(video);
}

/**
 * Holds the queue until the in-flight seek lands. The timeout is the point:
 * `seeking` can stick on after a render, stranding every later scrub.
 */
function watchSeek(video: HTMLVideoElement) {
  const state = seekState(video);
  if (state.waiting) return;

  const stop = new AbortController();
  const done = (force: boolean) => {
    clearTimeout(state.waiting);
    state.waiting = undefined;
    stop.abort();
    flushSeek(video, force);
  };

  state.waiting = setTimeout(() => done(true), PREVIEW_SEEK_TIMEOUT);
  video.addEventListener("seeked", () => done(false), {
    signal: stop.signal,
    once: true,
  });
}

/** Seeks and waits for a drawable frame. Drops any queued preview seek, which
 * would otherwise land mid-capture and shift a frame. */
function seek(video: HTMLVideoElement, time: number) {
  seekState(video).target = undefined;
  return new Promise<void>((resolve, reject) => {
    if (
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      Math.abs(video.currentTime - time) < 1e-3
    ) {
      resolve();
      return;
    }

    const stop = new AbortController();
    const settle = (finish: () => void) => () => {
      clearTimeout(timer);
      stop.abort();
      finish();
    };
    const timer = setTimeout(settle(resolve), SEEK_TIMEOUT);

    video.addEventListener("seeked", settle(resolve), { signal: stop.signal });
    video.addEventListener(
      "error",
      settle(() => reject(new Error("The browser could not seek this video"))),
      { signal: stop.signal },
    );
    video.currentTime = time;
  });
}

interface RenderRequest {
  video: HTMLVideoElement;
  crop: Crop;
  /** Seconds in, where the first frame is taken. */
  start: number;
  frameSeconds: number;
  /** Take every nth source frame. A stride, not a duration: capture aims at
   * frame midpoints, which needs whole frames. */
  stride: number;
  /** Hundredths of a second, GIF's native unit. */
  delay: number;
  mode: GifMode;
  frameCount: number;
  /** Pixels. Height follows the crop's aspect ratio. */
  width: number;
  dither: boolean;
  colors: number;
  onProgress?: (stage: string, fraction: number) => void;
}

export interface RenderResult {
  blob: Blob;
  width: number;
  height: number;
  frames: number;
}

/** Encoding is the slow part and pure computation, so it runs off-thread.
 * Frame buffers are transferred, not copied. */
function encodeOffThread(
  frames: Uint8ClampedArray[],
  options: Omit<GifOptions, "onProgress">,
  onProgress: (fraction: number) => void,
) {
  return new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
    const worker = new Worker(new URL("./encode-worker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (event: MessageEvent<EncodeResponse>) => {
      const message = event.data;
      if (message.type === "progress") {
        onProgress(message.fraction);
        return;
      }
      worker.terminate();
      if (message.type === "done") resolve(message.bytes);
      else reject(new Error(message.message));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "The GIF encoder crashed"));
    };

    // Ping-pong repeats frame objects, and a transfer list can't name one twice.
    const buffers = [...new Set(frames.map((frame) => frame.buffer))];
    worker.postMessage({ frames, options }, buffers as Transferable[]);
  });
}

export async function renderGif(request: RenderRequest): Promise<RenderResult> {
  const { video, crop, start, frameSeconds, stride, delay, mode } = request;
  const { frameCount, dither, colors, onProgress } = request;

  await primeVideo(video);
  video.pause();
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  if (!videoWidth || !videoHeight) {
    throw new Error("This video hasn't reported its dimensions yet");
  }

  const { sx, sy, sw, sh } = cropPixels(crop, videoWidth, videoHeight);
  const { width, height } = outputSize(
    crop,
    videoWidth,
    videoHeight,
    request.width,
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not get a 2d canvas context");

  // A boundary seek is a coin flip between two frames. Aim at the midpoint.
  const center = frameSeconds / 2;
  const sourceStep = stride * frameSeconds;
  const lastMoment = Math.max(0, video.duration - 1e-3);
  const frames: Uint8ClampedArray[] = [];
  try {
    for (let i = 0; i < frameCount; i++) {
      await seek(video, Math.min(start + i * sourceStep + center, lastMoment));
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
      frames.push(ctx.getImageData(0, 0, width, height).data);
      onProgress?.("Capturing frames", (i + 1) / frameCount);
    }
  } finally {
    // Capture parks the element on the last frame, and iOS reclaims the media
    // data it just read. Both need undoing.
    void primeVideo(video).then(() => previewSeek(video, start));
  }

  const ordered = playbackOrder(frames, mode);
  const bytes = await encodeOffThread(
    ordered,
    { width, height, delay, loop: mode !== "once", dither, colors },
    (fraction) => onProgress?.("Encoding GIF", fraction),
  );

  return {
    blob: new Blob([bytes], { type: "image/gif" }),
    width,
    height,
    frames: ordered.length,
  };
}
