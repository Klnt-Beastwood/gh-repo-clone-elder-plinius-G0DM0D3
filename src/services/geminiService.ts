import { GoogleGenAI } from "@google/genai";
import { Message } from "../types";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

export const MODEL_NAME = "gemini-3-flash-preview";

export async function* sendMessageStream(messages: Message[]) {
  const history = messages.slice(0, -1).map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));
  
  const lastMessage = messages[messages.length - 1].content;

  try {
    const chat = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: "You are a helpful and intelligent AI assistant. Use markdown for formatting your responses. Be concise but thorough.",
      },
      history: history as any,
    });

    const stream = await chat.sendMessageStream({
      message: lastMessage,
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
