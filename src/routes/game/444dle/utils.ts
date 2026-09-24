import common from "./words/common.ts";

export const NUM_WORDS = 3;
export const NUM_LETTERS = 4;
export const NUM_GUESSES = 9;

export type Eval = 0 | 1 | 2;
export const MISS = 0;
export const COW = 1;
export const BULL = 2;

export const EMOJIS = ["⚪", "🟠", "🟢"];
export const COLORS = ["grey", "orange", "green"];
export const SOLVED_EMOJI = "⚫";

export function requestDay(request: Request) {
  const timeZone = (request as { cf?: { timezone?: string } }).cf?.timezone;
  return new Date(
    `${new Date().toLocaleDateString("en-CA", { timeZone })}T00:00`,
  );
}

export function dailySolutions(day: Date): string[] {
  let seed = Math.floor(+day / 100000);
  const draw = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return common[Math.floor((seed / 0x100000000) * common.length)];
  };
  const solutions: string[] = [];
  while (solutions.length < NUM_WORDS) {
    const word = draw();
    if (!solutions.includes(word)) solutions.push(word);
  }
  return solutions;
}

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
