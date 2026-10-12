# Luke LaValva

It's my website! About time I made one in Marko.

## kbd training data

`POST` and `DELETE` `/app/kbd/training/<token>` take the swipes the kbd app's "help me train" screen
donates (`src/routes/app/kbd/training/`). They are held in an R2 bucket, `KBD_TRAINING`, until they are
released as a dataset. A token is 128 random bits the app makes; deleting by it removes everything it
donated. The routes keep no log of who called; a caller's address is only counted against a limit of
twelve calls a minute (`KBD_TRAINING_LIMIT`).

One-time setup: `npx wrangler r2 bucket create kbd-training`. To try the routes locally, `npm run build`
then `npx wrangler dev --local` (R2 is simulated).
