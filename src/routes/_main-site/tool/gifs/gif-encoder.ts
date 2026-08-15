// A small GIF89a encoder: median-cut palette + optional Floyd-Steinberg
// dithering + LZW. Frames come in as raw RGBA (canvas `ImageData.data`).

/** Pixels sampled across every frame to build the shared palette. */
const MAX_SAMPLES = 40_000;
/** Largest code the LZW table holds before it has to be reset. */
const LZW_MAX_CODE = 4096;

class ByteBuffer {
  private bytes = new Uint8Array(1 << 16);
  private len = 0;

  get length() {
    return this.len;
  }

  since(from: number) {
    return this.bytes.slice(from, this.len);
  }

  private ensure(extra: number) {
    if (this.len + extra <= this.bytes.length) return;
    let size = this.bytes.length;
    while (size < this.len + extra) size *= 2;
    const grown = new Uint8Array(size);
    grown.set(this.bytes.subarray(0, this.len));
    this.bytes = grown;
  }

  byte(value: number) {
    this.ensure(1);
    this.bytes[this.len++] = value;
  }

  /** Little-endian, the only multi-byte order GIF uses. */
  short(value: number) {
    this.ensure(2);
    this.bytes[this.len++] = value & 0xff;
    this.bytes[this.len++] = (value >> 8) & 0xff;
  }

  raw(values: Uint8Array) {
    this.ensure(values.length);
    this.bytes.set(values, this.len);
    this.len += values.length;
  }

  ascii(text: string) {
    for (let i = 0; i < text.length; i++) this.byte(text.charCodeAt(i));
  }

  result() {
    return this.bytes.slice(0, this.len);
  }
}

/** Closest palette entry for a color, memoized per 5-bit RGB cell so a long
 * video costs at most 32768 searches. */
class PaletteMap {
  private cache = new Int16Array(1 << 15).fill(-1);
  readonly palette: Uint8Array;

  constructor(palette: Uint8Array) {
    this.palette = palette;
  }

  nearest(r: number, g: number, b: number) {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const cached = this.cache[key];
    if (cached >= 0) return cached;

    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < this.palette.length; i += 3) {
      // Weighted to roughly match how the eye trades off the channels.
      const dr = r - this.palette[i];
      const dg = g - this.palette[i + 1];
      const db = b - this.palette[i + 2];
      const distance = dr * dr * 3 + dg * dg * 6 + db * db;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i / 3;
      }
    }
    this.cache[key] = best;
    return best;
  }
}

function buildPalette(frames: Uint8ClampedArray[], maxColors: number) {
  let totalPixels = 0;
  for (const frame of frames) totalPixels += frame.length >> 2;

  const stride = Math.max(1, Math.floor(totalPixels / MAX_SAMPLES));
  const samples = new Uint8Array(Math.ceil(totalPixels / stride) * 3);
  let count = 0;
  let seen = 0;

  for (const frame of frames) {
    const pixels = frame.length >> 2;
    // `seen` carries across frames so the stride stays even over the clip.
    for (let p = (stride - (seen % stride)) % stride; p < pixels; p += stride) {
      const from = p << 2;
      const to = count * 3;
      samples[to] = frame[from];
      samples[to + 1] = frame[from + 1];
      samples[to + 2] = frame[from + 2];
      count++;
    }
    seen += pixels;
  }

  return medianCut(samples, count, maxColors);
}

interface Box {
  lo: number;
  hi: number;
  /** The channel this box is widest on, and by how much. */
  channel: number;
  spread: number;
}

function medianCut(samples: Uint8Array, count: number, maxColors: number) {
  if (!count) return new Uint8Array(6);

  // Boxes are ranges over `order`, which gets sorted in place per split.
  const order = new Uint32Array(count);
  for (let i = 0; i < count; i++) order[i] = i;

  // Measured once, when the box is made: a split only reorders `order` within
  // the box being split, so no other box's extent can change.
  const measure = (lo: number, hi: number): Box => {
    let channel = 0;
    let spread = -1;
    for (let c = 0; c < 3; c++) {
      let min = 255;
      let max = 0;
      for (let i = lo; i < hi; i++) {
        const value = samples[order[i] * 3 + c];
        if (value < min) min = value;
        if (value > max) max = value;
      }
      if (max - min > spread) {
        spread = max - min;
        channel = c;
      }
    }
    return { lo, hi, channel, spread };
  };

  const boxes: Box[] = [measure(0, count)];

  while (boxes.length < maxColors) {
    let target = -1;
    let bestScore = 0;

    for (let b = 0; b < boxes.length; b++) {
      const box = boxes[b];
      if (box.hi - box.lo < 2) continue;
      // Prefer boxes that are both wide and heavily populated.
      const score = box.spread * (box.hi - box.lo);
      if (score > bestScore) {
        bestScore = score;
        target = b;
      }
    }

    if (target < 0) break; // every box is a single color already

    const { lo, hi, channel } = boxes[target];
    order
      .subarray(lo, hi)
      .sort((a, b) => samples[a * 3 + channel] - samples[b * 3 + channel]);
    const mid = (lo + hi) >> 1;
    boxes[target] = measure(lo, mid);
    boxes.push(measure(mid, hi));
  }

  const palette = new Uint8Array(Math.max(2, boxes.length) * 3);
  for (let b = 0; b < boxes.length; b++) {
    const { lo, hi } = boxes[b];
    let r = 0;
    let g = 0;
    let bl = 0;
    for (let i = lo; i < hi; i++) {
      const at = order[i] * 3;
      r += samples[at];
      g += samples[at + 1];
      bl += samples[at + 2];
    }
    const size = hi - lo;
    palette[b * 3] = Math.round(r / size);
    palette[b * 3 + 1] = Math.round(g / size);
    palette[b * 3 + 2] = Math.round(bl / size);
  }
  return palette;
}

function clamp255(value: number) {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

/** Allocated once per encode; a long clip would otherwise churn tens of
 * megabytes of short-lived arrays through the worker's heap. */
class FrameScratch {
  readonly indices: Uint8Array;
  /** Floyd-Steinberg only ever spills error onto the current and next row. */
  readonly current: Float32Array;
  readonly next: Float32Array;

  constructor(width: number, height: number) {
    this.indices = new Uint8Array(width * height);
    this.current = new Float32Array(width * 3);
    this.next = new Float32Array(width * 3);
  }
}

function mapFrame(
  rgba: Uint8ClampedArray,
  map: PaletteMap,
  scratch: FrameScratch,
) {
  const indices = scratch.indices;
  for (let p = 0, i = 0; p < indices.length; p++, i += 4) {
    indices[p] = map.nearest(rgba[i], rgba[i + 1], rgba[i + 2]);
  }
  return indices;
}

function ditherFrame(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  map: PaletteMap,
  scratch: FrameScratch,
) {
  const indices = scratch.indices;
  const palette = map.palette;
  let current = scratch.current;
  let next = scratch.next;
  // Reused across frames; `next` is zeroed per row below.
  current.fill(0);

  for (let y = 0; y < height; y++) {
    next.fill(0);
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      const o = x * 3;
      const r = clamp255(rgba[at] + current[o]);
      const g = clamp255(rgba[at + 1] + current[o + 1]);
      const b = clamp255(rgba[at + 2] + current[o + 2]);

      const index = map.nearest(r, g, b);
      indices[y * width + x] = index;

      const errR = r - palette[index * 3];
      const errG = g - palette[index * 3 + 1];
      const errB = b - palette[index * 3 + 2];

      if (x + 1 < width) {
        current[o + 3] += (errR * 7) / 16;
        current[o + 4] += (errG * 7) / 16;
        current[o + 5] += (errB * 7) / 16;
      }
      if (y + 1 < height) {
        if (x > 0) {
          next[o - 3] += (errR * 3) / 16;
          next[o - 2] += (errG * 3) / 16;
          next[o - 1] += (errB * 3) / 16;
        }
        next[o] += (errR * 5) / 16;
        next[o + 1] += (errG * 5) / 16;
        next[o + 2] += (errB * 5) / 16;
        if (x + 1 < width) {
          next[o + 3] += errR / 16;
          next[o + 4] += errG / 16;
          next[o + 5] += errB / 16;
        }
      }
    }
    const spent = current;
    current = next;
    next = spent;
  }
  return indices;
}

/**
 * Probed once per pixel of every frame, and the key is already a bounded
 * integer, so a flat array beats a `Map`. Clearing walks the keys actually
 * written, because the table resets every time it fills.
 */
class LzwTable {
  /** `(prefix << 8) | next` -> code + 1, leaving 0 to mean "not present". */
  private slots = new Int32Array(LZW_MAX_CODE << 8);
  private written = new Uint32Array(LZW_MAX_CODE);
  private count = 0;

  get(key: number) {
    return this.slots[key];
  }

  add(key: number, code: number) {
    this.slots[key] = code + 1;
    this.written[this.count++] = key;
  }

  clear() {
    for (let i = 0; i < this.count; i++) this.slots[this.written[i]] = 0;
    this.count = 0;
  }
}

/** Variable-width LZW, written straight into the GIF's sub-block stream. */
function lzwEncode(
  indices: Uint8Array,
  minCodeSize: number,
  out: ByteBuffer,
  table: LzwTable,
) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;

  let codeSize = minCodeSize + 1;
  table.clear();
  let nextCode = endCode + 1;

  let bits = 0;
  let bitCount = 0;
  const chunk = new Uint8Array(255);
  let chunkLength = 0;

  const flushChunk = () => {
    if (!chunkLength) return;
    out.byte(chunkLength);
    out.raw(chunk.subarray(0, chunkLength));
    chunkLength = 0;
  };
  const emit = (code: number) => {
    bits |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      chunk[chunkLength++] = bits & 0xff;
      if (chunkLength === 255) flushChunk();
      bits >>= 8;
      bitCount -= 8;
    }
  };

  emit(clearCode);
  if (indices.length) {
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i];
      const key = (prefix << 8) | k;
      const known = table.get(key);
      if (known !== 0) {
        prefix = known - 1;
        continue;
      }

      emit(prefix);
      if (nextCode === LZW_MAX_CODE) {
        emit(clearCode);
        table.clear();
        nextCode = endCode + 1;
        codeSize = minCodeSize + 1;
      } else {
        if (nextCode >= 1 << codeSize) codeSize++;
        table.add(key, nextCode++);
      }
      prefix = k;
    }
    emit(prefix);
  }
  emit(endCode);

  if (bitCount > 0) {
    chunk[chunkLength++] = bits & 0xff;
    if (chunkLength === 255) flushChunk();
  }
  flushChunk();
}

export interface GifOptions {
  width: number;
  height: number;
  /** Frame delay in hundredths of a second. */
  delay: number;
  loop: boolean;
  dither: boolean;
  /** Palette size. Fewer colors means a smaller file and coarser gradients. */
  colors: number;
  onProgress?: (fraction: number) => void;
}

export function encodeGif(
  frames: Uint8ClampedArray[],
  options: GifOptions,
): Uint8Array<ArrayBuffer> {
  const { width, height, delay, loop, dither, colors: maxColors } = options;
  const palette = buildPalette(frames, maxColors);
  const colors = palette.length / 3;
  const depth = Math.max(2, Math.ceil(Math.log2(colors)));
  const map = new PaletteMap(palette);
  const out = new ByteBuffer();
  const scratch = new FrameScratch(width, height);
  const table = new LzwTable();

  // A frame's blocks depend on nothing but its pixels and the delay, so a
  // repeated frame (ping-pong) is a byte-for-byte copy of the first one.
  const encoded =
    frames.length === new Set(frames).size
      ? null
      : new Map<Uint8ClampedArray, Uint8Array>();

  out.ascii("GIF89a");
  // Logical screen descriptor: global color table, 8-bit color resolution.
  out.short(width);
  out.short(height);
  out.byte(0x80 | 0x70 | (depth - 1));
  out.byte(0); // background color index
  out.byte(0); // pixel aspect ratio
  out.raw(palette);
  for (let i = colors; i < 1 << depth; i++) {
    out.byte(0);
    out.byte(0);
    out.byte(0);
  }

  if (loop) {
    // NETSCAPE2.0 application extension, loop count 0 = forever.
    out.byte(0x21);
    out.byte(0xff);
    out.byte(0x0b);
    out.ascii("NETSCAPE2.0");
    out.byte(0x03);
    out.byte(0x01);
    out.short(0);
    out.byte(0);
  }

  for (let f = 0; f < frames.length; f++) {
    const already = encoded?.get(frames[f]);
    if (already) {
      out.raw(already);
      options.onProgress?.((f + 1) / frames.length);
      continue;
    }
    const blockStart = out.length;

    const indices = dither
      ? ditherFrame(frames[f], width, height, map, scratch)
      : mapFrame(frames[f], map, scratch);

    // Graphic control extension: disposal method 1 (leave in place).
    out.byte(0x21);
    out.byte(0xf9);
    out.byte(0x04);
    out.byte(0x04);
    out.short(delay);
    out.byte(0); // transparent color index (unused)
    out.byte(0);

    // Image descriptor: full frame, no local color table, not interlaced.
    out.byte(0x2c);
    out.short(0);
    out.short(0);
    out.short(width);
    out.short(height);
    out.byte(0);

    out.byte(depth);
    lzwEncode(indices, depth, out, table);
    out.byte(0);

    encoded?.set(frames[f], out.since(blockStart));
    options.onProgress?.((f + 1) / frames.length);
  }

  out.byte(0x3b);
  return out.result();
}
