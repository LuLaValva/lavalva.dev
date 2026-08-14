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

/** Smallest crop the drag handles will let you make, as a fraction. */
const MIN_SIZE = 0.05;

export function clamp(value: number, min: number, max: number) {
  return value < min ? min : value > max ? max : value;
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
