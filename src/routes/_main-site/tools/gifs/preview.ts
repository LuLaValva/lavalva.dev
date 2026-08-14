/** `HTMLMediaElement.HAVE_CURRENT_DATA` — enough data to paint the current frame. */
const HAVE_CURRENT_DATA = 2;

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
