import { encodeGif, type GifOptions } from "./gif-encoder";

export interface EncodeRequest {
  frames: Uint8ClampedArray[];
  options: Omit<GifOptions, "onProgress">;
}

/** The whole protocol, in one place, so both ends agree by type rather than by
 * two lists of string literals that happen to match. */
export type EncodeResponse =
  | { type: "progress"; fraction: number }
  | { type: "done"; bytes: Uint8Array<ArrayBuffer> }
  | { type: "error"; message: string };

// Typed by hand rather than pulling in the webworker lib, which fights the DOM
// lib the rest of this project is built against.
const worker = self as unknown as {
  postMessage(message: EncodeResponse, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<EncodeRequest>) => void) | null;
};

worker.onmessage = (event) => {
  const { frames, options } = event.data;
  try {
    const bytes = encodeGif(frames, {
      ...options,
      onProgress: (fraction) =>
        worker.postMessage({ type: "progress", fraction }),
    });
    worker.postMessage({ type: "done", bytes }, [bytes.buffer]);
  } catch (error) {
    worker.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
