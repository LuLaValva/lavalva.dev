import { encodeGif, type GifOptions } from "./gif-encoder";

interface EncodeMessage {
  frames: Uint8ClampedArray[];
  options: Omit<GifOptions, "onProgress">;
}

// Typed by hand rather than pulling in the webworker lib, which fights the DOM
// lib the rest of this project is built against.
const worker = self as unknown as {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<EncodeMessage>) => void) | null;
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
