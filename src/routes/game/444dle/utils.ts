import { dailyPicker } from "../utils.ts";
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

export function dailySolutions(day: Date): string[] {
  const pick = dailyPicker(day);
  const solutions: string[] = [];
  while (solutions.length < NUM_WORDS) {
    const word = pick(common);
    if (!solutions.includes(word)) solutions.push(word);
  }
  return solutions;
}

export function evaluate(guess: string, solution: string): Eval[] {
  const result = [...guess].map((letter, i): Eval =>
    letter === solution[i] ? BULL : MISS,
  );
  const unspent = [...solution].filter((_, i) => result[i] !== BULL);
  for (let i = 0; i < result.length; i++) {
    if (result[i] === BULL) continue;
    const found = unspent.indexOf(guess[i]);
    if (found === -1) continue;
    unspent.splice(found, 1);
    result[i] = COW;
  }
  return result;
}
