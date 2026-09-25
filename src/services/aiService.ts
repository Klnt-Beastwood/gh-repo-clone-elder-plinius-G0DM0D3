import { Message, ModelDescriptor } from "../types";

export const GODMODE_MODELS: ModelDescriptor[] = [
  // GODMODE GITHUB - ABLITERATED / OBLITERATED (Legacy / Native Slugs)
  { id: "OBLITERATUS/Llama-3-70B-it-OBLITERATED", name: "LLAMA-3-70B-OBLITERATED", provider: "hf", type: "obliterated" },
  { id: "failspy/Meta-Llama-3-70B-Instruct-Abliterated", name: "LLAMA-3-70B-ABLITERATED", provider: "hf", type: "obliterated" },
  { id: "failspy/Meta-Llama-3-8B-Instruct-abliterated-v3", name: "LLAMA-3-8B-ABLITERATED", provider: "hf", type: "obliterated" },
  { id: "undi95/toppy-m-7b:free", name: "TOPPY-M-7B (FREE)", provider: "openrouter", type: "obliterated" },

  // CORE OBLITERATED & UNFILTERED (OpenRouter - High Reliability)
  { id: "nousresearch/hermes-3-llama-3.1-405b", name: "HERMES-405B-X", provider: "openrouter", type: "obliterated" },
  { id: "nousresearch/hermes-3-llama-3.1-8b", name: "HERMES-3-8B-X", provider: "openrouter", type: "obliterated" },
  { id: "meta-llama/llama-3.1-70b-instruct", name: "LLAMA-3.1-70B-X", provider: "openrouter", type: "obliterated" },
  { id: "cognitivecomputations/dolphin-mixtral-8x7b", name: "DOLPHIN-MIXTAL", provider: "openrouter", type: "obliterated" },
  { id: "gryphe/mythomax-l2-13b", name: "MYTHOMAX-13B", provider: "openrouter", type: "obliterated" },

  // OPENROUTER FREE TIER (Verified Slugs)
  { id: "mistralai/mistral-7b-instruct:free", name: "MISTRAL-7B (FREE)", provider: "openrouter", type: "free" },
  { id: "google/gemma-2-9b-it:free", name: "GEMMA-2-9B (FREE)", provider: "openrouter", type: "free" },
  { id: "meta-llama/llama-3.1-8b-instruct:free", name: "LLAMA-3.1-8B (FREE)", provider: "openrouter", type: "free" },

  // CORE MODELS (Hugging Face - Standard Inference API Support)
  { id: "mistralai/Mistral-7B-Instruct-v0.2", name: "MISTRAL-7B-HF", provider: "hf", type: "original" },
  { id: "Qwen/Qwen2.5-7B-Instruct", name: "QWEN-2.5-7B-HF", provider: "hf", type: "original" },
  { id: "HuggingFaceH4/zephyr-7b-beta", name: "ZEPHYR-7B-HF", provider: "hf", type: "original" },

  // ELITE FOUNDATIONAL (OpenRouter)
  { id: "anthropic/claude-3.5-sonnet", name: "CLAUDE-3.5-SONNET", provider: "openrouter", type: "original" },
  { id: "openai/gpt-4o", name: "GPT-4O-ULTRA", provider: "openrouter", type: "original" },
  { id: "google/gemini-2.0-flash-001", name: "GEMINI-2.0-FLASH", provider: "openrouter", type: "original" },
  { id: "deepseek/deepseek-chat", name: "DEEPSEEK-V3", provider: "openrouter", type: "original" }
];

/**
 * Models discovered from the local OpenAI-compatible server (LM Studio, Ollama,
 * llama.cpp, vLLM). Populated at runtime by loadLocalModels() because the ids
 * depend on whatever the user has loaded, so they cannot be hardcoded.
 */
export const LOCAL_MODELS: ModelDescriptor[] = [];

/** Turn an LM Studio model id into something that fits the UI's shouty casing. */
function displayName(id: string): string {
  const leaf = id.split(/[/\\]/).pop() || id;
  return leaf.replace(/\.gguf$/i, '').toUpperCase();
}

/**
 * /v1/models lists every loaded model, including embedding models, which have
 * no chat capability and reject /v1/chat/completions outright. This app only
 * does chat, so keep them out of the picker rather than offering a model that
 * can only fail.
 */
function isChatCapable(id: string): boolean {
  return !/(^|[-_/])(embed|embedding)/i.test(id);
}

export interface LocalModelsResult {
  models: ModelDescriptor[];
  baseUrl?: string;
  error?: string;
}

/**
 * Ask the server which models the local runtime currently has loaded.
 * Never throws — a stopped LM Studio is an expected state, reported via `error`.
 */
export async function loadLocalModels(): Promise<LocalModelsResult> {
  try {
    const response = await fetch('/api/local-models');
    const data = await response.json();

    const models: ModelDescriptor[] = (data?.models ?? [])
      .filter(isChatCapable)
      .map((id: string) => ({
        id,
        name: displayName(id),
        provider: 'local' as const,
        type: 'local' as const,
      }));

    // Replace in place so already-imported references stay valid.
    LOCAL_MODELS.splice(0, LOCAL_MODELS.length, ...models);

    return { models, baseUrl: data?.baseUrl, error: data?.error };
  } catch (e: any) {
    LOCAL_MODELS.splice(0, LOCAL_MODELS.length);
    return { models: [], error: e?.message || 'Could not reach /api/local-models' };
  }
}

function findModel(modelId: string): ModelDescriptor | undefined {
  return LOCAL_MODELS.find(m => m.id === modelId) || GODMODE_MODELS.find(m => m.id === modelId);
}

function providerFor(modelId: string): string {
  return findModel(modelId)?.provider || "hf";
}

async function errorFrom(response: Response, fallback: string): Promise<string> {
  try {
    const errorData = await response.json();
    return typeof errorData.error === 'string'
      ? errorData.error
      : JSON.stringify(errorData.error || errorData);
  } catch {
    return fallback;
  }
}

export async function* sendMessageStream(
  messages: Message[],
  modelId: string,
  params: { temp: number, p: number } = { temp: 0.85, p: 0.95 }
) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages,
      modelId,
      provider: providerFor(modelId),
      params
    })
  });

  if (!response.ok) {
    throw new Error(await errorFrom(response, "Failed to fetch from server"));
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) return;

  // Local models stream fast and in small pieces, so an SSE event is regularly
  // split across two reads. Buffer and only parse whole lines, otherwise the
  // tail of each read is dropped as unparseable JSON.
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;

      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;

      try {
        const data = JSON.parse(payload);
        const delta = data.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // Keep-alive comments and non-JSON frames are expected; skip them.
      }
    }
  }
}

export async function sendParallelMessages(
  messages: Message[],
  modelIds: string[],
  params: { temp: number, p: number } = { temp: 0.85, p: 0.95 }
) {
  const promises = modelIds.map(async modelId => {
    const model = findModel(modelId);

    try {
      const response = await fetch('/api/fetch-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages,
          modelId,
          provider: model?.provider || "hf",
          params
        })
      });

      if (!response.ok) {
        throw new Error(await errorFrom(response, `Core ${model?.name || modelId} failed`));
      }

      const data = await response.json();
      return {
        name: model?.name || modelId,
        content: data.choices?.[0]?.message?.content ?? '[EMPTY RESPONSE]'
      };
    } catch (e: any) {
      return { name: model?.name || modelId, content: `[ERROR]: ${e.message}` };
    }
  });

  return Promise.all(promises);
}

export async function stmRefine(content: string, modelId?: string) {
  // STM (Semantic Transformation Module)
  // Uses a fast pass to normalize raw unfiltered output into clean markdown.
  // Defaults to Gemini Flash over OpenRouter, but runs on whichever model is
  // passed in — so a local-only setup refines locally instead of failing.
  const refineModelId = modelId || "google/gemini-2.0-flash-001";

  try {
    const response = await fetch('/api/fetch-single', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: `TRANSFORM THE FOLLOWING RAW DATA INTO PERFECTLY FORMATTED MARKDOWN. REMOVE ANY NOISE OR REPETITION. PRESERVE ALL ORIGINAL MEANING.\n\nDATA:\n${content}` }],
        modelId: refineModelId,
        provider: providerFor(refineModelId),
        params: { temp: 0.1, p: 1.0 }
      })
    });

    if (!response.ok) return content;
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? content;
  } catch (e) {
    console.error("STM Failure:", e);
    return content;
  }
}
