import type { Crop } from "./crop";
import type { GifOptions } from "./gif-encoder";

export type GifMode = "loop" | "pingpong" | "once";

/** `HTMLMediaElement.HAVE_CURRENT_DATA` — enough data to paint the current frame. */
const HAVE_CURRENT_DATA = 2;
/** Give up on a `seeked` event that never arrives and use whatever is painted. */
const SEEK_TIMEOUT = 5000;
/** Frames to watch go by before calling the source's frame rate measured. */
const FRAME_SAMPLES = 8;
/** Stop watching for frames on a video that isn't producing any. */
const DETECT_TIMEOUT = 1500;
/**
 * Capture rates worth snapping a measurement to, including the 1000/1001 "NTSC"
 * variants. A frame interval that's off by even a fraction of a percent drifts a
 * whole frame over a few hundred of them, so a measurement landing next to one
 * of these is taken to be it.
 */
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
 * iOS Safari ignores `preload` and refuses to buffer media data until playback
 * has happened once, so the element sits at HAVE_METADATA: it knows the video's
 * size and duration but holds no frames. Seeking then has nothing to paint and
 * the scrub preview stays blank — while hitting play works, because playing is
 * what loads the data.
 *
 * A muted inline play/pause gets that data flowing without the user noticing.
 * Muted + `playsinline` is exempt from the autoplay restrictions on iOS 10+.
 */
export async function primeVideo(video: HTMLVideoElement) {
  if (video.readyState >= HAVE_CURRENT_DATA) return;
  video.muted = true;
  try {
    await video.play();
  } catch {
    // Autoplay refused. The first real play() the user triggers will load it.
    return;
  }
  video.pause();
}

/**
 * Measures how long a single source frame lasts, in seconds.
 *
 * `requestVideoFrameCallback` hands back the media timestamp of each frame as
 * it reaches the compositor, so playing for a moment and dividing the media
 * time covered by the number of frames presented gives the interval directly.
 * Counting *presented* frames rather than callbacks keeps the answer right even
 * when the compositor drops some.
 *
 * Firefox has never shipped the API; there this returns null and the caller has
 * to assume a rate.
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

    const finish = () => {
      clearTimeout(timer);
      video.removeEventListener("ended", finish);
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

    // A clip too short to present that many frames would otherwise hang here.
    const timer = setTimeout(finish, DETECT_TIMEOUT);
    video.addEventListener("ended", finish, { once: true });
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

const pendingSeek = new WeakMap<HTMLVideoElement, number>();

/**
 * Seeks the preview, collapsing a burst of scrubbing down to the latest target.
 * Assigning `currentTime` while a seek is already in flight is dropped on
 * mobile WebKit, which leaves the preview showing a stale frame.
 */
export function previewSeek(video: HTMLVideoElement, time: number) {
  if (video.seeking) {
    pendingSeek.set(video, time);
    return;
  }

  pendingSeek.delete(video);
  video.currentTime = time;

  video.addEventListener(
    "seeked",
    () => {
      const next = pendingSeek.get(video);
      if (next === undefined) return;
      pendingSeek.delete(video);
      previewSeek(video, next);
    },
    { once: true },
  );
}

/** Seeks and waits for the frame to be ready to draw. */
function seek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    if (
      video.readyState >= HAVE_CURRENT_DATA &&
      Math.abs(video.currentTime - time) < 1e-3
    ) {
      resolve();
      return;
    }

    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("The browser could not seek this video"));
    };
    const timer = setTimeout(onSeeked, SEEK_TIMEOUT);

    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = time;
  });
}

interface RenderRequest {
  video: HTMLVideoElement;
  crop: Crop;
  /** Seconds into the video where the first frame is taken. */
  start: number;
  /** How long one source frame lasts, in seconds. */
  frameSeconds: number;
  /** Seconds of source between two captured frames — a whole number of frames. */
  sourceStep: number;
  /** Frame delay in hundredths of a second — GIF's native unit. */
  delay: number;
  mode: GifMode;
  frameCount: number;
  /** Output width in pixels; height follows the crop's aspect ratio. */
  width: number;
  dither: boolean;
  /** Palette size. Fewer colors means a smaller file. */
  colors: number;
  onProgress?: (stage: string, fraction: number) => void;
}

export interface RenderResult {
  blob: Blob;
  width: number;
  height: number;
  frames: number;
}

/**
 * Quantizing and LZW-coding every frame is the slow part, and it's pure
 * computation, so it runs off the main thread and the page stays responsive.
 * Frame buffers are transferred rather than copied.
 */
function encodeOffThread(
  frames: Uint8ClampedArray[],
  options: Omit<GifOptions, "onProgress">,
  onProgress: (fraction: number) => void,
) {
  return new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
    const worker = new Worker(new URL("./encode-worker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (event) => {
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

    // Ping-pong repeats frame objects, so the same buffer can appear twice —
    // listing one twice in the transfer list is an error.
    const buffers = [...new Set(frames.map((frame) => frame.buffer))];
    worker.postMessage({ frames, options }, buffers as Transferable[]);
  });
}

export async function renderGif(request: RenderRequest): Promise<RenderResult> {
  const {
    video,
    crop,
    start,
    frameSeconds,
    sourceStep,
    delay,
    mode,
    frameCount,
    dither,
    colors,
  } = request;

  // Without this, a browser that hasn't buffered any media data (iOS Safari
  // until something plays) hands back blank or repeated frames.
  await primeVideo(video);
  video.pause();
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  if (!videoWidth || !videoHeight) {
    throw new Error("This video hasn't reported its dimensions yet");
  }

  const sx = Math.round(crop.x * videoWidth);
  const sy = Math.round(crop.y * videoHeight);
  const sw = Math.max(1, Math.round(crop.width * videoWidth));
  const sh = Math.max(1, Math.round(crop.height * videoHeight));
  const width = Math.max(1, Math.round(request.width));
  const height = Math.max(1, Math.round((width * sh) / sw));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not get a 2d canvas context");

  // Seeking to a frame boundary is a coin flip between that frame and the one
  // before it, so aim at the middle of the frame we actually want.
  const center = frameSeconds / 2;
  const lastMoment = Math.max(0, video.duration - 1e-3);
  const frames: Uint8ClampedArray[] = [];
  for (let i = 0; i < frameCount; i++) {
    await seek(video, Math.min(start + i * sourceStep + center, lastMoment));
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
    frames.push(ctx.getImageData(0, 0, width, height).data);
    request.onProgress?.("Capturing frames", (i + 1) / frameCount);
  }

  // Ping-pong replays the middle frames backwards; the ends aren't repeated so
  // the turnaround doesn't stutter.
  const ordered =
    mode === "pingpong" && frames.length > 2
      ? frames.concat(frames.slice(1, -1).reverse())
      : frames;

  const bytes = await encodeOffThread(
    ordered,
    { width, height, delay, loop: mode !== "once", dither, colors },
    (fraction) => request.onProgress?.("Encoding GIF", fraction),
  );

  return {
    blob: new Blob([bytes], { type: "image/gif" }),
    width,
    height,
    frames: ordered.length,
  };
}
