import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;
const getAI = () => {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || "",
      httpOptions: {
        fetch: (url: any, init?: any) => window.fetch(url, init),
      },
    } as any);
  }
  return aiClient;
};

export const aiService = {
  getFixSuggestion: async (errorMessage: string, stack?: string, context?: any) => {
    try {
      let contextStr = '';
      try {
        contextStr = context ? JSON.stringify(context, null, 2) : '';
      } catch (e) {
        contextStr = '[Không thể serialize bối cảnh]';
      }

      const prompt = `Bạn là một chuyên gia lập trình Fullstack. Hãy phân tích lỗi sau và đưa ra gợi ý sửa lỗi ngắn gọn, súc tích bằng tiếng Việt.
      
      Thông điệp lỗi: ${errorMessage}
      ${stack ? `\nStack Trace: ${stack}` : ''}
      ${contextStr ? `\nBối cảnh: ${contextStr}` : ''}
      
      Hãy cung cấp:
      1. Nguyên nhân chính (1 câu).
      2. Các bước sửa lỗi (danh sách).
      3. Đoạn code gợi ý (nếu có).`;

      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      return response.text || "Không có phản hồi từ AI";
    } catch (error) {
      console.error('Error getting AI suggestion:', error);
      throw error;
    }
  }
};
