import * as v from "valibot";

/**
 * 128 random bits the kbd app makes and shows as its ID: it stands for a person without naming
 * one, and holding it is all it takes to delete what they sent.
 */
export const Token = v.pipe(
  v.string(),
  v.trim(),
  v.toLowerCase(),
  v.regex(/^[0-9a-f]{32}$/),
);
