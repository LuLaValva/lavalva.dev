/** A crop rectangle in normalized (0-1) video coordinates. */
export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Corner = "nw" | "ne" | "sw" | "se";
export type Handle = "move" | Corner;

export const HANDLES: Corner[] = ["nw", "ne", "sw", "se"];

/** The whole frame — the starting crop, and what "reset" goes back to. */
export const FULL_CROP: Crop = { x: 0, y: 0, width: 1, height: 1 };

/** Smallest crop the drag handles will let you make, as a fraction. */
const MIN_SIZE = 0.05;

/** Narrowest GIF worth offering; anything less is unreadable. */
export const MIN_OUTPUT_WIDTH = 80;
/** Beyond this a GIF is enormous for what it is, whatever the source. */
const MAX_OUTPUT_WIDTH = 720;

export function clamp(value: number, min: number, max: number) {
  return value < min ? min : value > max ? max : value;
}

/** A crop as whole source pixels — the rectangle to copy off the video. */
export function cropPixels(
  crop: Crop,
  videoWidth: number,
  videoHeight: number,
) {
  return {
    sx: Math.round(crop.x * videoWidth),
    sy: Math.round(crop.y * videoHeight),
    sw: Math.max(1, Math.round(crop.width * videoWidth)),
    sh: Math.max(1, Math.round(crop.height * videoHeight)),
  };
}

/**
 * The GIF's pixel size for a given crop and requested width.
 *
 * Both the page (to say what it is about to make) and the renderer (to actually
 * make it) go through here, so the promised size is the produced size by
 * construction rather than by two copies of the same rounding agreeing.
 */
export function outputSize(
  crop: Crop,
  videoWidth: number,
  videoHeight: number,
  requestedWidth: number,
) {
  const { sw, sh } = cropPixels(crop, videoWidth, videoHeight);
  const limit = Math.max(MIN_OUTPUT_WIDTH, Math.min(sw, MAX_OUTPUT_WIDTH));
  const width = Math.max(1, Math.round(Math.min(requestedWidth, limit)));
  return { width, height: Math.max(1, Math.round((width * sh) / sw)), limit };
}

/**
 * Applies a pointer drag to a crop rect. `dx`/`dy` are the pointer's total
 * movement since the drag started, as a fraction of the video's displayed size.
 */
export function dragCrop(crop: Crop, handle: Handle, dx: number, dy: number) {
  if (handle === "move") {
    return {
      x: clamp(crop.x + dx, 0, 1 - crop.width),
      y: clamp(crop.y + dy, 0, 1 - crop.height),
      width: crop.width,
      height: crop.height,
    };
  }

  let { x, y, width, height } = crop;

  if (handle === "nw" || handle === "sw") {
    const left = clamp(x + dx, 0, x + width - MIN_SIZE);
    width = x + width - left;
    x = left;
  } else {
    width = clamp(width + dx, MIN_SIZE, 1 - x);
  }

  if (handle === "nw" || handle === "ne") {
    const top = clamp(y + dy, 0, y + height - MIN_SIZE);
    height = y + height - top;
    y = top;
  } else {
    height = clamp(height + dy, MIN_SIZE, 1 - y);
  }

  return { x, y, width, height };
}
