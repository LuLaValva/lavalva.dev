import { dailyPicker } from "../utils.ts";
import common from "./words/common.ts";

export const NUM_WORDS = 3;
export const NUM_LETTERS = 4;
export const NUM_GUESSES = 9;

const EVALS = ["miss", "cow", "bull"] as const;
export type Eval = (typeof EVALS)[number];

export const EMOJIS: Record<Eval, string> = {
  miss: "⚪",
  cow: "🟠",
  bull: "🟢",
};

export const COLORS: Record<Eval, string> = {
  miss: "grey",
  cow: "orange",
  bull: "green",
};

export const SOLVED_EMOJI = "⚫";

export const bestEval = (scores: Eval[]) =>
  EVALS[Math.max(0, ...scores.map((score) => EVALS.indexOf(score)))];

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
    letter === solution[i] ? "bull" : "miss",
  );
  const unspent = [...solution].filter((_, i) => result[i] !== "bull");
  for (let i = 0; i < result.length; i++) {
    if (result[i] === "bull") continue;
    const found = unspent.indexOf(guess[i]);
    if (found === -1) continue;
    unspent.splice(found, 1);
    result[i] = "cow";
  }
  return result;
}
