import { encodeGif, type GifOptions } from "./gif-encoder";

export interface EncodeRequest {
  frames: Uint8ClampedArray[];
  options: Omit<GifOptions, "onProgress">;
}

/** Both ends agree by type, not by two lists of string literals. */
export type EncodeResponse =
  | { type: "progress"; fraction: number }
  | { type: "done"; bytes: Uint8Array<ArrayBuffer> }
  | { type: "error"; message: string };

// Hand-typed: the webworker lib fights the DOM lib this project builds against.
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
