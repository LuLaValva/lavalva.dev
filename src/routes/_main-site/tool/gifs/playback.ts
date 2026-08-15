// Apart from `video.ts` because the page needs these while rendering on the
// server, where nothing that touches a video element can be loaded.

export type GifMode = "loop" | "pingpong" | "once";

/** Ping-pong replays the middle frames backwards; the ends aren't repeated, so
 * the turnaround doesn't stutter. */
export function playbackOrder<T>(frames: T[], mode: GifMode) {
  return mode === "pingpong" && frames.length > 2
    ? frames.concat(frames.slice(1, -1).reverse())
    : frames;
}

/** What `playbackOrder` will yield for a capture of `count` frames. */
export function playedFrameCount(count: number, mode: GifMode) {
  return mode === "pingpong" && count > 2 ? count * 2 - 2 : count;
}
