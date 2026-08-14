import type { Crop } from "./crop";
import { encodeGif } from "./gif-encoder";

export type GifMode = "loop" | "pingpong" | "once";

/** Give up on a `seeked` event that never arrives and use whatever is painted. */
const SEEK_TIMEOUT = 5000;

export interface RenderRequest {
  video: HTMLVideoElement;
  crop: Crop;
  /** Seconds into the video where the first frame is taken. */
  start: number;
  fps: number;
  /** Playback multiplier — 2 skips twice as far through the source per frame. */
  speed: number;
  mode: GifMode;
  frameCount: number;
  /** Output width in pixels; height follows the crop's aspect ratio. */
  width: number;
  dither: boolean;
  onProgress?: (stage: string, fraction: number) => void;
}

export interface RenderResult {
  blob: Blob;
  width: number;
  height: number;
  frames: number;
}

function seek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    if (video.readyState >= 2 && Math.abs(video.currentTime - time) < 1e-3) {
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

export async function renderGif(request: RenderRequest): Promise<RenderResult> {
  const { video, crop, start, fps, speed, mode, frameCount, dither } = request;

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

  // How far to walk through the source video between two output frames.
  const sourceStep = speed / fps;
  const frames: Uint8ClampedArray[] = [];
  for (let i = 0; i < frameCount; i++) {
    await seek(video, start + i * sourceStep);
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

  const bytes = await encodeGif(ordered, {
    width,
    height,
    // Most browsers clamp anything under 2/100s back up to 10/100s.
    delay: Math.max(2, Math.round(100 / fps)),
    loop: mode !== "once",
    dither,
    onProgress: (fraction) => request.onProgress?.("Encoding GIF", fraction),
  });

  return {
    blob: new Blob([bytes], { type: "image/gif" }),
    width,
    height,
    frames: ordered.length,
  };
}
