import { Message } from "../types";

export const GODMODE_MODELS = [
  // GODMODE GITHUB - ABLITERATED / OBLITERATED (Legacy / Native Slugs)
  { id: "OBLITERATUS/Llama-3-70B-it-OBLITERATED", name: "LLAMA-3-70B-OBLITERATED", provider: "hf", type: "obliterated" },
  { id: "failspy/Meta-Llama-3-70B-Instruct-Abliterated", name: "LLAMA-3-70B-ABLITERATED", provider: "hf", type: "obliterated" },
  { id: "failspy/Meta-Llama-3-8B-Instruct-Abliterated-v3", name: "LLAMA-3-8B-ABLITERATED", provider: "hf", type: "obliterated" },
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

export async function* sendMessageStream(
  messages: Message[], 
  modelId: string, 
  params: { temp: number, p: number } = { temp: 0.85, p: 0.95 }
) {
  const model = GODMODE_MODELS.find(m => m.id === modelId);
  const provider = model?.provider || "hf";

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages,
      modelId,
      provider,
      params
    })
  });

  if (!response.ok) {
    let errorDetail = "Failed to fetch from server";
    try {
      const errorData = await response.json();
      errorDetail = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error || errorData);
    } catch (e) {
      // Fallback if not JSON
    }
    throw new Error(errorDetail);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          if (line.includes('[DONE]')) break;
          try {
            const data = JSON.parse(line.slice(6));
            yield data.choices[0].delta.content || "";
          } catch (e) {}
        }
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
    const model = GODMODE_MODELS.find(m => m.id === modelId);
    const provider = model?.provider || "hf";
    
    try {
      const response = await fetch('/api/fetch-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages,
          modelId,
          provider,
          params
        })
      });

      if (!response.ok) {
        let errorDetail = `Core ${model?.name} failed`;
        try {
          const errorData = await response.json();
          errorDetail = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error || errorData);
        } catch (e) {}
        throw new Error(errorDetail);
      }

      const data = await response.json();
      return { 
        name: model?.name || modelId, 
        content: data.choices[0].message.content 
      };
    } catch (e: any) {
      return { name: model?.name || modelId, content: `[ERROR]: ${e.message}` };
    }
  });

  return Promise.all(promises);
}

export async function stmRefine(content: string) {
  // STM (Semantic Transformation Module)
  // Uses a fast pass to normalize raw unfiltered output into clean markdown
  try {
    const response = await fetch('/api/fetch-single', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: `TRANSFORM THE FOLLOWING RAW DATA INTO PERFECTLY FORMATTED MARKDOWN. REMOVE ANY NOISE OR REPETITION. PRESERVE ALL ORIGINAL MEANING.\n\nDATA:\n${content}` }],
        modelId: "google/gemini-2.0-flash-001", // Using Gemini Flash for fast reliable transformation
        provider: "openrouter",
        params: { temp: 0.1, p: 1.0 }
      })
    });

    if (!response.ok) return content;
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (e) {
    console.error("STM Failure:", e);
    return content;
  }
}
