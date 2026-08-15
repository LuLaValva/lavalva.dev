// Apart from `video.ts`: the page needs these during server render, where
// nothing touching a video element can load.

export type GifMode = "loop" | "pingpong" | "once";

/** Ping-pong replays the middle frames backwards. The ends aren't repeated, so
 * the turnaround doesn't stutter. */
export function playbackOrder<T>(frames: T[], mode: GifMode) {
  return mode === "pingpong" && frames.length > 2
    ? frames.concat(frames.slice(1, -1).reverse())
    : frames;
}

/** What `playbackOrder` yields for `count` captured frames. */
export function playedFrameCount(count: number, mode: GifMode) {
  return mode === "pingpong" && count > 2 ? count * 2 - 2 : count;
}
