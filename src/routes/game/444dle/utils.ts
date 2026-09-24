import common from "./words/common.ts";

export const NUM_WORDS = 3;
export const NUM_LETTERS = 4;
/** Nine, so every solved board scores a digit and the three read as a number. */
export const NUM_GUESSES = 9;

export type Eval = 0 | 1 | 2;
export const MISS = 0;
export const COW = 1;
export const BULL = 2;

export const EMOJIS = ["⚪", "🟠", "🟢"];
/** Stands in for a board that was already solved on an earlier guess. */
export const SOLVED_EMOJI = "⚫";

export function requestDay(request: Request) {
  const timeZone = (request as { cf?: { timezone?: string } }).cf?.timezone;
  // `T00:00` keeps the parse local, so the date does not slip a day when it is
  // read back somewhere behind UTC.
  return new Date(
    `${new Date().toLocaleDateString("en-CA", { timeZone })}T00:00`,
  );
}

export function dailySolutions(day: Date): string[] {
  let seed = Math.floor(+day / 100000);
  return Array.from({ length: NUM_WORDS }, () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return common[Math.floor((seed / 0x100000000) * common.length)];
  });
}

/** Scores a guess, spending each solution letter on at most one position. */
export function evaluate(guess: string, solution: string): Eval[] {
  const unspent = solution.split("");
  const result: Eval[] = Array(guess.length).fill(MISS);
  for (let i = guess.length - 1; i >= 0; i--) {
    if (unspent[i] === guess[i]) {
      unspent.splice(i, 1);
      result[i] = BULL;
    }
  }
  for (let i = guess.length - 1; i >= 0; i--) {
    if (result[i] !== BULL) {
      const found = unspent.indexOf(guess[i]);
      if (found !== -1) {
        unspent.splice(found, 1);
        result[i] = COW;
      }
    }
  }
  return result;
}
