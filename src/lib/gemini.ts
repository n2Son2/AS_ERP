import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

export const getAI = (): GoogleGenAI => {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY || "";
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        fetch: (url: any, init?: any) => window.fetch(url, init),
      },
    } as any);
  }
  return aiInstance;
};

export const ai = new Proxy({} as GoogleGenAI, {
  get(_target, prop) {
    const instance = getAI();
    const val = Reflect.get(instance, prop);
    return typeof val === 'function' ? val.bind(instance) : val;
  }
});

export const MODELS = {
  FLASH: "gemini-3-flash-preview",
  PRO: "gemini-3.1-pro-preview",
};

