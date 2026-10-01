import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const NUM_LETTERS = 4;

// Guesses come from the Letterpress word list (github.com/atebits/Words, CC0)
// that reduce already ships. It is made for word games, so it has the plurals
// and variant spellings players try without the acronyms and names.
const DICTIONARY =
  "src/routes/game/reduce/tags/lazy-english-dictionary/words.json";
const VALID = "src/routes/game/444dle/words/valid.json";
// A player's report of a missing word goes here.
const ALSO_VALID = ["vape"];

const root = fileURLToPath(new URL("..", import.meta.url));

const dictionary = JSON.parse(await readFile(join(root, DICTIONARY), "utf8"));
const guesses = dictionary.filter((word) => word.length === NUM_LETTERS);
const valid = [...new Set([...guesses, ...ALSO_VALID])].sort();

await writeFile(join(root, VALID), JSON.stringify(valid));
console.log(`${VALID} — ${valid.length} words`);
