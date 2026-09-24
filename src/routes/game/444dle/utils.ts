import common from "./words/common.ts";

export const NUM_WORDS = 3;
export const NUM_LETTERS = 4;
/* Nine, so a board that is solved at all is solved in a single digit and the
   three of them read as one number. */
export const NUM_GUESSES = 9;

/** A letter's score against one solution. */
export type Eval = 0 | 1 | 2;
export const MISS = 0;
export const COW = 1;
export const BULL = 2;

/** Emoji used in the shareable score summary, indexed by `Eval`. */
export const EMOJIS = ["⚪", "🟠", "🟢"];
/** Stands in for a board that was already solved on an earlier guess. */
export const SOLVED_EMOJI = "⚫";

export function requestDay(request: Request) {
  const timeZone = (request as { cf?: { timezone?: string } }).cf?.timezone;
  // `T00:00` keeps the parse local, so the date does not slip a day when the
  // page is read back in a timezone behind UTC.
  return new Date(
    `${new Date().toLocaleDateString("en-CA", { timeZone })}T00:00`,
  );
}

/** Picks today's solutions. The same day always yields the same words. */
export function dailySolutions(day: Date): string[] {
  let seed = Math.floor(+day / 100000);
  return Array.from({ length: NUM_WORDS }, () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return common[Math.floor((seed / 0x100000000) * common.length)];
  });
}

/** Scores a guess against a solution, handling duplicate letters. */
export function evaluate(guess: string, solution: string): Eval[] {
  const remaining = solution.split("");
  const result: Eval[] = Array(guess.length).fill(MISS);
  for (let i = guess.length - 1; i >= 0; i--) {
    if (remaining[i] === guess[i]) {
      remaining.splice(i, 1);
      result[i] = BULL;
    }
  }
  for (let i = guess.length - 1; i >= 0; i--) {
    if (result[i] !== BULL) {
      const found = remaining.indexOf(guess[i]);
      if (found !== -1) {
        remaining.splice(found, 1);
        result[i] = COW;
      }
    }
  }
  return result;
}

export function binarySearch(list: string[], word: string) {
  let low = 0;
  let high = list.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (list[mid] === word) return true;
    if (list[mid] < word) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return false;
}
