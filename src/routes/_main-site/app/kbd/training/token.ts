import * as v from "valibot";

/** 128 random bits the kbd app makes and shows as its ID: holding it is all it takes to delete what it sent. */
export const Token = v.pipe(
  v.string(),
  v.trim(),
  v.toLowerCase(),
  v.regex(/^[0-9a-f]{32}$/),
);
