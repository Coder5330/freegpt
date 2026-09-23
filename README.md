# GPT Chat (single HTML file + one API function)

Two files total:
- `index.html` — the whole UI, plain HTML/CSS/JS, no build step.
- `api/chat.js` — a tiny Vercel serverless function that holds your API key
  and calls OpenAI. Vercel auto-detects the `/api` folder even without a
  framework, so no `package.json`/build config is needed.

## Deploy to Vercel

1. Push this folder to a GitHub repo (or run `vercel` from inside it with the
   Vercel CLI — no build step required, just deploy as-is).
2. Import the repo at https://vercel.com/new.
3. In Settings → Environment Variables, add:
   - `OPENAI_API_KEY` = your key
4. Deploy.

## Run locally

```bash
npm install -g vercel
vercel dev
```

Vercel's dev server serves `index.html` and runs `api/chat.js` together, so
`fetch("/api/chat")` works the same locally as in production. Add your key to
a `.env` file first:

```
OPENAI_API_KEY=your-key-here
```

## Notes

- The model name `gpt-6-sol` in `api/chat.js` is carried over from your
  notebook — double check it's still correct for your account.
- The key is read server-side only (`process.env.OPENAI_API_KEY` inside the
  function), never sent to the browser.
