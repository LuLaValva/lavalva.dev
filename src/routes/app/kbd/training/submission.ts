/**
 * What the kbd app's "help me train" screen sends: timed sets of swipes on a prompted sentence, and
 * nothing else. Anything else in a body is dropped, so a stored object holds only what is listed here.
 */

export const MAX_BODY_BYTES = 1_000_000;

const MAX_SETS = 10;
const MAX_SWIPES = 500;
const MAX_SAMPLES = 2000;
const MAX_SENTENCES = 100;
const MAX_MS = 60_000;

const GRIPS = ["right-thumb", "left-thumb", "two-thumbs", "finger"] as const;
const SETTINGS = ["sitting", "standing", "walking", "transit"] as const;
const MODES = ["accept", "live"] as const;

export interface Swipe {
  word: string;
  sentence: number;
  index: number;
  attempt: number;
  /** Whether the swipe passed the loose geometric gate that says it was aimed at the word. */
  gate: boolean;
  /** `[x, y, ms]`: x and y across the letter area, ms from the swipe's first sample. */
  samples: [number, number, number][];
}

export interface TrainingSet {
  id: string;
  mode: (typeof MODES)[number];
  grip: (typeof GRIPS)[number];
  setting: (typeof SETTINGS)[number];
  app: string;
  device: string;
  /** Points of the screen's width and height. */
  screen: [number, number];
  sentences: string[];
  swipes: Swipe[];
}

export interface Submission {
  v: 1;
  sets: TrainingSet[];
}

type Json = Record<string, unknown>;

class Invalid extends Error {}

function object(value: unknown, what: string): Json {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Invalid(`${what} is not an object`);
  }
  return value as Json;
}

function array(value: unknown, what: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) {
    throw new Invalid(`${what} is not a list of at most ${max}`);
  }
  return value;
}

function text(
  value: unknown,
  what: string,
  pattern: RegExp,
  max: number,
): string {
  if (typeof value !== "string" || value.length > max || !pattern.test(value)) {
    throw new Invalid(`${what} is not valid`);
  }
  return value;
}

function oneOf<T extends string>(
  value: unknown,
  what: string,
  options: readonly T[],
): T {
  if (!options.includes(value as T))
    throw new Invalid(`${what} is not one of ${options.join(", ")}`);
  return value as T;
}

function number(
  value: unknown,
  what: string,
  min: number,
  max: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    throw new Invalid(`${what} is out of range`);
  }
  return value;
}

function integer(
  value: unknown,
  what: string,
  min: number,
  max: number,
): number {
  if (!Number.isInteger(value)) throw new Invalid(`${what} is not an integer`);
  return number(value, what, min, max);
}

function swipe(value: unknown, sentences: number): Swipe {
  const input = object(value, "swipe");
  const samples = array(input.samples, "samples", MAX_SAMPLES).map((sample) => {
    const [x, y, t] = array(sample, "sample", 3);
    return [
      number(x, "x", -2, 3),
      number(y, "y", -2, 3),
      number(t, "t", 0, MAX_MS),
    ] as [number, number, number];
  });
  if (samples.length < 2) throw new Invalid("a swipe has under two samples");
  return {
    word: text(input.word, "word", /^[a-zA-Z'’-]+$/, 40),
    sentence: integer(input.sentence, "sentence", 0, sentences - 1),
    index: integer(input.index, "index", 0, 200),
    attempt: integer(input.attempt, "attempt", 1, 50),
    gate: input.gate === true,
    samples,
  };
}

function trainingSet(value: unknown): TrainingSet {
  const input = object(value, "set");
  const sentences = array(input.sentences, "sentences", MAX_SENTENCES).map(
    (sentence) => text(sentence, "sentence", /^[^\u0000-\u001f]+$/, 300),
  );
  const screen = array(input.screen, "screen", 2);
  if (screen.length !== 2)
    throw new Invalid("screen needs a width and a height");
  return {
    id: text(input.id, "id", /^[0-9a-f]{32}$/, 32),
    mode: oneOf(input.mode, "mode", MODES),
    grip: oneOf(input.grip, "grip", GRIPS),
    setting: oneOf(input.setting, "setting", SETTINGS),
    app: text(input.app, "app", /^[0-9A-Za-z.+-]+$/, 24),
    device: text(input.device, "device", /^[0-9A-Za-z,._ -]+$/, 40),
    screen: [
      number(screen[0], "width", 100, 5000),
      number(screen[1], "height", 100, 5000),
    ],
    sentences,
    swipes: array(input.swipes, "swipes", MAX_SWIPES).map((s) =>
      swipe(s, sentences.length),
    ),
  };
}

/** The submission a body holds, or why it holds none. */
export function parseSubmission(
  body: string,
): { submission: Submission } | { error: string } {
  try {
    const input = object(JSON.parse(body), "submission");
    if (input.v !== 1) throw new Invalid("unknown version");
    const sets = array(input.sets, "sets", MAX_SETS).map(trainingSet);
    if (sets.length === 0) throw new Invalid("no sets");
    return { submission: { v: 1, sets } };
  } catch (error) {
    if (error instanceof Invalid) return { error: error.message };
    if (error instanceof SyntaxError) return { error: "not JSON" };
    throw error;
  }
}
