import * as v from "valibot";

import { Token } from "../token";

const count = v.pipe(v.number(), v.integer(), v.minValue(0));

/** What the app sends, as kbd's `TrainingSubmission` encodes it: a change to one is a change to both. */
const Submission = v.object({
  v: v.literal(1),
  sets: v.pipe(
    v.array(
      v.object({
        id: v.string(),
        finger: v.picklist([
          "left-thumb",
          "right-thumb",
          "left-index",
          "right-index",
        ]),
        setting: v.picklist(["sitting", "standing", "walking", "transit"]),
        app: v.string(),
        device: v.string(),
        screen: v.tuple([v.number(), v.number()]),
        sentences: v.array(v.string()),
        swipes: v.array(
          v.object({
            word: v.string(),
            sentence: count,
            index: count,
            attempt: count,
            gate: v.boolean(),
            samples: v.array(v.tuple([v.number(), v.number(), v.number()])),
          }),
        ),
      }),
    ),
    v.minLength(1),
  ),
});

export const POST = Run.POST(
  { params: v.object({ token: Token }), json: Submission },
  async ({ params, body, platform }) => {
    const [{ token }, invalid] = params;
    if (invalid) return new Response(null, { status: 400 });
    const [submission, issues] = await body;
    if (issues) return new Response(null, { status: 422 });
    await platform.env.KBD_TRAINING.put(
      `submissions/${token}/${crypto.randomUUID()}.json`,
      JSON.stringify(submission),
    );
    return new Response(null, { status: 201 });
  },
);
