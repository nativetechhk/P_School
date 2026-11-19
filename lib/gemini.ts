// Gemini Developer API（@google/genai）。無 key 時走 MOCK 模式。
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';
import { IS_MOCK_AI } from './config';

let _ai: GoogleGenAI | null = null;

export function ai(): GoogleGenAI {
  if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  return _ai;
}

const SAFETY_SETTINGS = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
].map((category) => ({ category, threshold: 'BLOCK_LOW_AND_ABOVE' })) as never;

export interface GenerateImageArgs {
  model: string;
  prompt: string;
  aspect: string; // '3:4' | '16:9' | '1:1' | 'keep'
  referenceImage?: { mimeType: string; data: string }; // base64，edit 模式
}

function aspectDims(aspect: string): [number, number] {
  if (aspect === '3:4') return [768, 1024];
  if (aspect === '16:9') return [1280, 720];
  return [1024, 1024];
}

async function mockImage(args: GenerateImageArgs): Promise<Buffer> {
  // MOCK：生成含 prompt 文字的佔位圖，令整條管道可離線測試
  const [w, h] = aspectDims(args.aspect === 'keep' ? '1:1' : args.aspect);
  const hue = Math.abs([...args.prompt].reduce((a, c) => a + c.charCodeAt(0), 0)) % 360;
  const text = args.prompt.slice(0, 60).replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue},70%,75%)"/><stop offset="100%" stop-color="hsl(${(hue + 60) % 360},70%,55%)"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="${w / 2}" cy="${h / 2 - 40}" r="${Math.min(w, h) / 5}" fill="rgba(255,255,255,.55)"/>
    <text x="50%" y="${h / 2 - 28}" font-size="${Math.min(w, h) / 6}" text-anchor="middle">🎨</text>
    <text x="50%" y="${h - 60}" font-size="22" fill="#333" text-anchor="middle" font-family="sans-serif">MOCK ${text}</text>
  </svg>`;
  await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2000)); // 模擬生成時間
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** 生成 1 張圖（Gemini 圖像模型每請求只回 1 張，§4.3a）。回傳 PNG buffer。 */
export async function generateImage(args: GenerateImageArgs): Promise<Buffer> {
  if (IS_MOCK_AI) {
    if (args.referenceImage) {
      // mock edit：將原圖染色，模擬風格轉換
      const src = Buffer.from(args.referenceImage.data, 'base64');
      const hue = Math.abs([...args.prompt].reduce((a, c) => a + c.charCodeAt(0), 0)) % 360;
      await new Promise((r) => setTimeout(r, 1500));
      return sharp(src).modulate({ hue, saturation: 1.3 }).png().toBuffer();
    }
    return mockImage(args);
  }

  if (args.model.startsWith('imagen')) {
    const res = await ai().models.generateImages({
      model: args.model,
      prompt: args.prompt,
      config: { numberOfImages: 1, aspectRatio: args.aspect === 'keep' ? '1:1' : args.aspect },
    });
    const b64 = res.generatedImages?.[0]?.image?.imageBytes;
    if (!b64) throw new Error('NO_IMAGE_RETURNED');
    return Buffer.from(b64, 'base64');
  }

  const contents: unknown[] = [{ text: args.prompt }];
  if (args.referenceImage) {
    contents.push({ inlineData: { mimeType: args.referenceImage.mimeType, data: args.referenceImage.data } });
  }
  const res = await ai().models.generateContent({
    model: args.model,
    contents: contents as never,
    config: {
      responseModalities: ['IMAGE'],
      ...(args.aspect !== 'keep' ? { imageConfig: { aspectRatio: args.aspect } } : {}),
      safetySettings: SAFETY_SETTINGS,
    },
  });
  const parts = res.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = (part as { inlineData?: { data?: string } }).inlineData;
    if (inline?.data) return Buffer.from(inline.data, 'base64');
  }
  throw new Error('NO_IMAGE_RETURNED');
}

/** 文字任務（gemini-2.5-flash）。mock 模式回傳簡單結果。 */
export async function generateText(model: string, prompt: string): Promise<string> {
  if (IS_MOCK_AI) {
    if (prompt.includes('JSON')) {
      return JSON.stringify({ title: '我的 AI 故事', pages: ['主角出場啦！', '佢去咗一個神奇地方。', '突然遇到大危機！', '佢勇敢咁解決咗。', ''] });
    }
    return '（MOCK 文字結果）';
  }
  const res = await ai().models.generateContent({ model, contents: prompt });
  return res.text ?? '';
}

/** 語音辨識結果 → 最接近的 3 個選項 id（§4.2）。 */
export async function matchVoiceToOptions(
  transcript: string,
  options: { id: string; label: string }[],
  matchTemplate: string,
  model: string
): Promise<string[]> {
  if (IS_MOCK_AI) {
    const scored = options
      .map((o) => ({ id: o.id, score: [...transcript].filter((ch) => o.label.includes(ch)).length }))
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, 3).filter((s) => s.score > 0).map((s) => s.id);
  }
  const optionsText = options.map((o) => `${o.id}：${o.label}`).join('\n');
  const prompt = matchTemplate.replaceAll('{TRANSCRIPT}', transcript).replaceAll('{OPTIONS}', optionsText);
  const text = await generateText(model, prompt);
  try {
    const arr = JSON.parse(text.replace(/```json?|```/g, '').trim());
    if (Array.isArray(arr)) return arr.slice(0, 3).map(String);
  } catch { /* fallthrough */ }
  return [];
}
