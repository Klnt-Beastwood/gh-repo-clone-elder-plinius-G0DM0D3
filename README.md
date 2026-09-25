<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/ba92593a-50e2-48c3-b657-51542c2896da

## Run with a local model (no API key)

**Prerequisites:** Node.js, and [LM Studio](https://lmstudio.ai) or another
OpenAI-compatible runtime.

1. In LM Studio: download a model, open the **Developer** tab, and click
   **Start Server**. It listens on port 1234 by default.
2. Install dependencies: `npm install`
3. Run the app: `npm run dev`
4. Open http://localhost:3000

No `.env.local` is needed for the local path. On startup the app queries
`GET /v1/models` on your runtime and lists whatever is loaded under **Local
Runtime (No Key)** in the model picker, selecting the first one automatically.
Embedding models are filtered out, since they reject chat requests. The sidebar
shows a live status dot so you can tell whether the runtime was found.

> **Why `127.0.0.1` and not `localhost`?** LM Studio binds the IPv4 wildcard
> (`0.0.0.0`) and does not listen on `[::]`. Node resolves hostnames verbatim,
> and on Windows `localhost` typically resolves to IPv6 `::1` first — which
> nothing is listening on. Using `localhost` there gives `ECONNREFUSED` against
> a server that is demonstrably running. Verify yours with
> `netstat -ano | findstr LISTENING | findstr "1234"`.

### Pointing at something other than LM Studio

Set `LOCAL_BASE_URL` in `.env.local`:

| Runtime | `LOCAL_BASE_URL` |
| --- | --- |
| LM Studio (default) | `http://127.0.0.1:1234/v1` |
| Ollama | `http://127.0.0.1:11434/v1` |
| llama.cpp (`llama-server`) | `http://127.0.0.1:8080/v1` |
| vLLM | `http://127.0.0.1:8000/v1` |

To change the system prompt without editing `server.ts`, set
`GODMODE_SYSTEM_PROMPT` in `.env.local`.

## Hosted providers (optional)

The other models in the picker need keys — see [.env.example](.env.example) for
`HUGGING_FACE_TOKEN` and `OPENROUTER_API_KEY`. Two caveats:

- HF serverless inference for the listed models now routes through **paid**
  Inference Providers, so a free account will see 402/404 on most of them.
- Two of the hardcoded HF model ids no longer exist upstream
  (`OBLITERATUS/Llama-3-70B-it-OBLITERATED`,
  `failspy/Meta-Llama-3-70B-Instruct-Abliterated`) and will 404.

## Note on `parseltongue.ts`

The perturbation modes (Base64, ROT13, Zalgo, token splitting, byte reversal)
encode your prompt before it is sent. Against a local model these mostly just
degrade comprehension — a 7B model asked to decode Base64 in-context will
usually produce noise. `Raw (None)` is the default for a reason.
