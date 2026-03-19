# Committee Review Draft Worker

Cloudflare Worker that accepts Zoom transcript context and returns strict JSON drafts for:

- `strengths`
- `weaknesses`
- `opportunities`
- `keyTakeaways`

## 1) Install and login

```bash
npm i -g wrangler
wrangler login
```

## 2) Create KV namespace for rate limit

```bash
wrangler kv namespace create RATE_LIMIT_KV
```

Copy the returned namespace ID into `wrangler.toml` for `id` and `preview_id`.

## 3) Configure vars and secrets

Update `wrangler.toml`:

- `ALLOWED_ORIGIN`: your GitHub Pages origin, e.g. `https://ericb.github.io`
- `GEMINI_MODEL`: default model (e.g. `gemini-2.5-flash`)
- `RATE_LIMIT_PER_MINUTE`: per-IP limit

Set secrets:

```bash
wrangler secret put GEMINI_API_KEY
wrangler secret put TURNSTILE_SECRET
```

## 4) Deploy

```bash
cd worker
wrangler deploy
```

Copy the deployed worker URL.

## 5) Configure frontend (GitHub Pages app)

In `../config.js` set:

- `draftApiUrl`: your worker endpoint URL
- `turnstileSiteKey`: your Cloudflare Turnstile site key

No secrets should be placed in `config.js`.
